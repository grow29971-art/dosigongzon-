export const CARE_SHIFT_STATUSES = [
  "requested",
  "accepted",
  "completed",
] as const;

export type CareShiftStatus = (typeof CARE_SHIFT_STATUSES)[number];

export type CareShiftActor = "requester" | "assignee";

export const CARE_SHIFT_NOTE_MAX_LENGTH = 500;

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
  | "note_too_long";

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
  const startsAt = new Date(input.startsAt);

  if (!requesterId) errors.push("requester_required");
  if (!assigneeId) errors.push("assignee_required");
  if (requesterId && assigneeId && requesterId === assigneeId) {
    errors.push("self_assignment");
  }
  if (Number.isNaN(startsAt.getTime())) {
    errors.push("invalid_starts_at");
  } else if (startsAt.getTime() <= now.getTime()) {
    errors.push("starts_at_not_future");
  }
  if ((input.note?.trim().length ?? 0) > CARE_SHIFT_NOTE_MAX_LENGTH) {
    errors.push("note_too_long");
  }

  return errors;
}
