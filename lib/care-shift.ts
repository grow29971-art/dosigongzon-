export const CARE_SHIFT_STATUSES = [
  "requested",
  "accepted",
  "completed",
] as const;

export type CareShiftStatus = (typeof CARE_SHIFT_STATUSES)[number];

export type CareShiftActor = "requester" | "assignee";

export const CARE_SHIFT_NOTE_MAX_LENGTH = 500;

// 목록 삭제 수단이 없어 비상식적 원미래(예: 수십 년 뒤) 교대는 영구히 남는다.
// 실제 돌봄 조율 범위를 넘는 시작 시각은 요청 단계에서 거절한다.
export const CARE_SHIFT_MAX_FUTURE_MS = 60 * 24 * 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/;

export function isCareShiftUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isCareShiftSchemaNotReadyCode(code: string): boolean {
  return code === "42P01" || code === "PGRST204" || code === "PGRST205";
}

// API 검증을 통과한 요청도 DB 도달 시점에는 CHECK(미래 시작 시각 등)에
// 걸릴 수 있다. check_violation은 서버 장애가 아니라 입력 문제다.
export function isCareShiftCheckViolationCode(code: string): boolean {
  return code === "23514";
}

// 상태 전환 트리거는 stale/concurrent 요청을 P0001로 거절한다.
// 이는 서버 장애가 아니라 이미 처리된 요청과 같은 전이 충돌이다.
export function isCareShiftTransitionViolationCode(code: string): boolean {
  return code === "P0001";
}

// Postgres text는 NUL(U+0000)을 저장할 수 없어 22P05로 실패하고, 나머지
// C0/C1 제어 문자도 목록 표시를 깨뜨린다. 탭·줄바꿈·CR만 서식으로 허용한다.
export function hasCareShiftNoteControlChars(note: string): boolean {
  for (const ch of note) {
    const code = ch.codePointAt(0) ?? 0;
    const isAllowedFormatting = code === 9 || code === 10 || code === 13;
    const isC0 = code < 32;
    const isDelOrC1 = code >= 127 && code <= 159;
    if ((isC0 || isDelOrC1) && !isAllowedFormatting) return true;
  }
  return false;
}

export function isCareShiftTimestamp(value: string): boolean {
  const match = RFC3339_TIMESTAMP_PATTERN.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);
  const daysInMonth =
    month >= 1 && month <= 12
      ? new Date(Date.UTC(year, month, 0)).getUTCDate()
      : 0;

  return (
    day >= 1 &&
    day <= daysInMonth &&
    Number(hourText) <= 23 &&
    Number(minuteText) <= 59 &&
    Number(secondText) <= 59 &&
    (offsetHourText === undefined ||
      (offsetMinute <= 59 &&
        (offsetHour < 14 || (offsetHour === 14 && offsetMinute === 0))))
  );
}

// 메모 500자 계약상 정상 요청 본문은 수 KB를 넘지 않는다. 검증 전에
// 수 MB JSON 본문을 통째로 파싱하며 CPU·메모리를 쓰지 않도록,
// 파싱 전에 원문 길이로 거절한다.
export const CARE_SHIFT_MAX_BODY_BYTES = 16 * 1024;

export function isCareShiftBodyTooLarge(rawBody: string): boolean {
  return new TextEncoder().encode(rawBody).byteLength > CARE_SHIFT_MAX_BODY_BYTES;
}

// JSON.parse는 null·배열·원시값도 유효한 본문으로 통과시키는데,
// null 본문은 필드 접근에서 예외를 던져 500이 된다. 객체 본문만 허용한다.
export function isCareShiftBodyObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type CareShiftRequestInput = {
  requesterId: string;
  assigneeId: string;
  startsAt: string;
  note?: string | null;
};

export type CareShiftRequestValidationError =
  | "requester_required"
  | "assignee_required"
  | "self_assignment"
  | "invalid_starts_at"
  | "starts_at_not_future"
  | "starts_at_too_far"
  | "note_too_long"
  | "note_has_control_chars";

const ALLOWED_TRANSITIONS: Readonly<
  Record<CareShiftStatus, Partial<Record<CareShiftActor, CareShiftStatus>>>
> = {
  requested: { assignee: "accepted" },
  accepted: { assignee: "completed" },
  completed: {},
};

export function getNextCareShiftStatus(
  current: CareShiftStatus,
  actor: CareShiftActor,
): CareShiftStatus | null {
  return ALLOWED_TRANSITIONS[current][actor] ?? null;
}

export function canTransitionCareShift(
  current: CareShiftStatus,
  next: CareShiftStatus,
  actor: CareShiftActor,
): boolean {
  return getNextCareShiftStatus(current, actor) === next;
}

// 목표 상태에 도달하기 위한 유일한 현재 상태를 전이 계약에서 역산한다.
// API가 인라인 매핑을 재작성하면 계약 변경 시 어긋날 수 있어 이 함수만 쓴다.
export function getRequiredCurrentStatus(
  next: CareShiftStatus,
  actor: CareShiftActor,
): CareShiftStatus | null {
  const matches = CARE_SHIFT_STATUSES.filter(
    (current) => ALLOWED_TRANSITIONS[current][actor] === next,
  );
  return matches.length === 1 ? matches[0] : null;
}

// datetime-local 입력은 타임존 없는 로컬 벽시계 문자열을 기대한다.
// toISOString()은 UTC라 KST에서는 9시간 과거가 되어 그대로 쓰면 안 된다.
export function toDatetimeLocalValue(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

// 목록은 시작 시각 오름차순 + 50건 제한이라, 오래된 과거 교대가 창을
// 채우면 새 요청이 목록 밖으로 밀려난다. 최근 1주 이전 시작분은 제외한다.
export const CARE_SHIFT_LIST_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export function careShiftListWindowStart(now: Date): string {
  return new Date(now.getTime() - CARE_SHIFT_LIST_LOOKBACK_MS).toISOString();
}

const CARE_SHIFT_MAX_FUTURE_DAYS = CARE_SHIFT_MAX_FUTURE_MS / (24 * 60 * 60 * 1000);

// invalid_params 한 문구로 뭉개면 사용자는 무엇을 고쳐야 할지 알 수 없다.
// 서버 details의 첫 번째 사유를 구체적 한국어 안내로 바꾼다.
// Record<CareShiftRequestValidationError, ...>라 새 검증 사유가 생기면
// 이 맵도 함께 채워야 컴파일이 통과한다.
const CARE_SHIFT_VALIDATION_MESSAGES: Readonly<
  Record<CareShiftRequestValidationError, string>
> = {
  requester_required: "로그인이 필요한 기능이에요.",
  assignee_required: "교대할 이웃을 선택해 주세요.",
  self_assignment: "자기 자신에게는 교대를 요청할 수 없어요.",
  invalid_starts_at: "시작 시각을 다시 선택해 주세요.",
  starts_at_not_future: "시작 시각은 지금보다 뒤여야 해요.",
  starts_at_too_far: `시작 시각은 ${CARE_SHIFT_MAX_FUTURE_DAYS}일 안에서만 선택할 수 있어요.`,
  note_too_long: `메모는 ${CARE_SHIFT_NOTE_MAX_LENGTH}자까지 입력할 수 있어요.`,
  note_has_control_chars: "메모에 사용할 수 없는 특수 문자가 있어요.",
};

export function describeCareShiftValidationErrors(
  details: unknown,
  fallback: string,
): string {
  if (!Array.isArray(details)) return fallback;
  for (const detail of details) {
    if (
      typeof detail === "string" &&
      Object.prototype.hasOwnProperty.call(CARE_SHIFT_VALIDATION_MESSAGES, detail)
    ) {
      return CARE_SHIFT_VALIDATION_MESSAGES[
        detail as CareShiftRequestValidationError
      ];
    }
  }
  return fallback;
}

const CARE_SHIFT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  unauthorized: "로그인이 필요한 기능이에요.",
  rate_limited: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
  not_ready: "돌봄 교대 기능을 준비하고 있어요. 잠시 후 다시 시도해 주세요.",
  not_found: "지금은 사용할 수 없는 기능이에요.",
  forbidden: "이 돌봄 교대를 처리할 권한이 없어요.",
  invalid_transition: "이미 처리된 요청이에요. 목록을 새로고침해 주세요.",
  duplicate_request: "같은 시각에 이미 요청한 돌봄 교대가 있어요.",
  invalid_params: "입력한 내용을 다시 확인해 주세요.",
  invalid_body: "입력한 내용을 다시 확인해 주세요.",
  payload_too_large: "입력한 내용이 너무 길어요. 메모를 줄여 주세요.",
};

export function describeCareShiftError(
  code: unknown,
  fallback: string,
): string {
  if (typeof code !== "string") return fallback;
  return CARE_SHIFT_ERROR_MESSAGES[code] ?? fallback;
}

export function validateCareShiftRequest(
  input: CareShiftRequestInput,
  now: Date = new Date(),
): CareShiftRequestValidationError[] {
  const errors: CareShiftRequestValidationError[] = [];
  const requesterId = input.requesterId.trim();
  const assigneeId = input.assigneeId.trim();
  const hasValidTimestamp = isCareShiftTimestamp(input.startsAt);
  const startsAt = new Date(input.startsAt);

  if (!requesterId) errors.push("requester_required");
  if (!assigneeId) errors.push("assignee_required");
  if (
    requesterId &&
    assigneeId &&
    requesterId.toLowerCase() === assigneeId.toLowerCase()
  ) {
    errors.push("self_assignment");
  }
  if (!hasValidTimestamp) {
    errors.push("invalid_starts_at");
  } else if (startsAt.getTime() <= now.getTime()) {
    errors.push("starts_at_not_future");
  } else if (startsAt.getTime() > now.getTime() + CARE_SHIFT_MAX_FUTURE_MS) {
    errors.push("starts_at_too_far");
  }
  if ((input.note?.trim().length ?? 0) > CARE_SHIFT_NOTE_MAX_LENGTH) {
    errors.push("note_too_long");
  }
  if (input.note != null && hasCareShiftNoteControlChars(input.note)) {
    errors.push("note_has_control_chars");
  }

  return errors;
}
