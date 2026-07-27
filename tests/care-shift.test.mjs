import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const careShiftRouteSource = readFileSync(
  new URL("../app/api/care-shifts/route.ts", import.meta.url),
  "utf8",
);
const careShiftPageSource = readFileSync(
  new URL("../app/(main)/mypage/circle/page.tsx", import.meta.url),
  "utf8",
);

import {
  CARE_SHIFT_LIST_LOOKBACK_MS,
  CARE_SHIFT_MAX_BODY_BYTES,
  CARE_SHIFT_MAX_FUTURE_MS,
  CARE_SHIFT_NOTE_MAX_LENGTH,
  CARE_SHIFT_STATUSES,
  canTransitionCareShift,
  careShiftNoteLength,
  careShiftListWindowStart,
  describeCareShiftError,
  describeCareShiftValidationErrors,
  getNextCareShiftStatus,
  getRequiredCurrentStatus,
  hasCareShiftNoteControlChars,
  isCareShiftBodyObject,
  isCareShiftBodyTooLarge,
  isCareShiftCheckViolationCode,
  isCareShiftContentLengthTooLarge,
  isCareShiftJsonContentType,
  isCareShiftSchemaNotReadyCode,
  isCareShiftTimestamp,
  isCareShiftTransitionViolationCode,
  isCareShiftUuid,
  toDatetimeLocalValue,
  validateCareShiftRequest,
} from "../lib/care-shift.ts";

test("care shift uses the requested, accepted, completed sequence", () => {
  assert.deepEqual(CARE_SHIFT_STATUSES, [
    "requested",
    "accepted",
    "completed",
  ]);
});

test("care shift transition conflict refreshes the stale list", () => {
  assert.match(
    careShiftPageSource,
    /result\.error === "invalid_transition"[\s\S]*?await loadCareShifts\(\)/,
  );
});

test("care shift list ignores stale overlapping responses", () => {
  assert.match(
    careShiftPageSource,
    /const requestId = \+\+careShiftsRequestId\.current/,
  );
  assert.match(
    careShiftPageSource,
    /response\.ok && requestId === careShiftsRequestId\.current/,
  );
  assert.match(
    careShiftPageSource,
    /requestId === careShiftsRequestId\.current[\s\S]*?setCareShiftsLoading\(false\)/,
  );
});

test("care shift list invalidates in-flight responses when auth context changes", () => {
  assert.match(
    careShiftPageSource,
    /if \(!userId \|\| !isCoreJourneyEnabled\("P3"\)\) \{[\s\S]*?careShiftsRequestId\.current \+= 1;[\s\S]*?setCareShifts\(\[\]\)/,
  );
  assert.match(
    careShiftPageSource,
    /return \(\) => \{\s*careShiftsRequestId\.current \+= 1;[\s\S]*?careShiftAuthContextId\.current \+= 1;\s*\}/,
  );
});

test("care shift mutations discard UI effects after auth context changes", () => {
  assert.match(careShiftPageSource, /const careShiftAuthContextId = useRef\(0\)/);
  assert.match(
    careShiftPageSource,
    /return \(\) => \{[\s\S]*?careShiftAuthContextId\.current \+= 1;/,
  );
  assert.match(
    careShiftPageSource,
    /const authContextId = careShiftAuthContextId\.current;[\s\S]*?if \(authContextId !== careShiftAuthContextId\.current\) return;/,
  );
  assert.match(
    careShiftPageSource,
    /if \(authContextId === careShiftAuthContextId\.current\) \{[\s\S]*?setCareShiftTransitioning\(null\)/,
  );
});

test("care shift identifiers accept UUIDs and reject malformed database input", () => {
  assert.equal(isCareShiftUuid("4f01f5fd-1b52-4d63-9bbc-7f6055f7b7cc"), true);
  assert.equal(isCareShiftUuid("not-a-uuid"), false);
  assert.equal(isCareShiftUuid("4f01f5fd-1b52-4d63-9bbc"), false);
});

test("missing care shift schema and stale PostgREST cache are both not ready", () => {
  assert.equal(isCareShiftSchemaNotReadyCode("42P01"), true);
  assert.equal(isCareShiftSchemaNotReadyCode("PGRST204"), true);
  assert.equal(isCareShiftSchemaNotReadyCode("PGRST205"), true);
  assert.equal(isCareShiftSchemaNotReadyCode("42501"), false);
});

test("DB check violations are input errors, not schema readiness gaps", () => {
  assert.equal(isCareShiftCheckViolationCode("23514"), true);
  assert.equal(isCareShiftCheckViolationCode("23505"), false);
  assert.equal(isCareShiftCheckViolationCode("42P01"), false);
  assert.equal(isCareShiftSchemaNotReadyCode("23514"), false);
});

test("DB trigger transition violations are conflicts, not server failures", () => {
  assert.equal(isCareShiftTransitionViolationCode("P0001"), true);
  assert.equal(isCareShiftTransitionViolationCode("23514"), false);
  assert.equal(isCareShiftTransitionViolationCode("PGRST116"), false);
});

test("care shift timestamps require an explicit RFC 3339 timezone", () => {
  assert.equal(isCareShiftTimestamp("2026-07-27T01:30:00Z"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:30:00+09:00"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:30"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27 10:30:00"), false);
  assert.equal(isCareShiftTimestamp("not-a-date"), false);
});

test("care shift timestamps reject normalized calendar and clock overflows", () => {
  assert.equal(isCareShiftTimestamp("2026-02-30T10:00:00Z"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T24:00:00Z"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:60:00+09:00"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00+09:60"), false);
});

test("care shift timestamps reject RFC 3339 offsets beyond 14 hours", () => {
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00+14:00"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00-14:00"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00+14:01"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00-15:00"), false);
});

test("care shift timestamps accept lowercase RFC 3339 z and t", () => {
  assert.equal(isCareShiftTimestamp("2026-07-27T01:30:00z"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27t01:30:00Z"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27t01:30:00z"), true);
  // 소문자만 허용하고 다른 구분자는 여전히 거절해야 한다.
  assert.equal(isCareShiftTimestamp("2026-07-27x01:30:00Z"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T24:00:00z"), false);
});

test("an assignee can accept a request and complete an accepted shift", () => {
  assert.equal(getNextCareShiftStatus("requested", "assignee"), "accepted");
  assert.equal(getNextCareShiftStatus("accepted", "assignee"), "completed");
});

test("requesters, skips, and completed shift rewrites are rejected", () => {
  assert.equal(getNextCareShiftStatus("requested", "requester"), null);
  assert.equal(
    canTransitionCareShift("requested", "completed", "assignee"),
    false,
  );
  assert.equal(
    canTransitionCareShift("completed", "accepted", "assignee"),
    false,
  );
});

test("required current status is derived from the transition contract", () => {
  assert.equal(getRequiredCurrentStatus("accepted", "assignee"), "requested");
  assert.equal(getRequiredCurrentStatus("completed", "assignee"), "accepted");
  assert.equal(getRequiredCurrentStatus("requested", "assignee"), null);
  for (const status of CARE_SHIFT_STATUSES) {
    assert.equal(getRequiredCurrentStatus(status, "requester"), null);
  }
});

test("required current status stays consistent with forward transitions", () => {
  for (const actor of ["requester", "assignee"]) {
    for (const current of CARE_SHIFT_STATUSES) {
      const next = getNextCareShiftStatus(current, actor);
      if (next !== null) {
        assert.equal(getRequiredCurrentStatus(next, actor), current);
      }
    }
  }
});

test("a valid future shift request is accepted", () => {
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: "2026-07-27T02:00:00.000Z",
        note: "저녁 급식 부탁드려요.",
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    [],
  );
});

test("invalid participants, time, and oversized notes are rejected together", () => {
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "same-user",
        assigneeId: "same-user",
        startsAt: "2026-07-27T01:00:00.000Z",
        note: "가".repeat(CARE_SHIFT_NOTE_MAX_LENGTH + 1),
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    ["self_assignment", "starts_at_not_future", "note_too_long"],
  );
});

test("note length counts Unicode characters consistently with PostgreSQL", () => {
  assert.equal(careShiftNoteLength("🐈".repeat(CARE_SHIFT_NOTE_MAX_LENGTH)), 500);
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: "2026-07-27T02:00:00.000Z",
        note: "🐈".repeat(CARE_SHIFT_NOTE_MAX_LENGTH),
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    [],
  );
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: "2026-07-27T02:00:00.000Z",
        note: "🐈".repeat(CARE_SHIFT_NOTE_MAX_LENGTH + 1),
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    ["note_too_long"],
  );
});

test("notes with NUL or other control characters are rejected before the DB", () => {
  const nul = String.fromCharCode(0);
  const escapeChar = String.fromCharCode(27);
  const c1Char = String.fromCharCode(128);
  assert.equal(hasCareShiftNoteControlChars(`저녁 급식${nul}`), true);
  assert.equal(hasCareShiftNoteControlChars(escapeChar), true);
  assert.equal(hasCareShiftNoteControlChars(c1Char), true);
  assert.equal(hasCareShiftNoteControlChars("탭\t줄바꿈\n복귀\r 허용"), false);
  assert.equal(hasCareShiftNoteControlChars("저녁 급식 부탁드려요."), false);

  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: "2026-07-27T02:00:00.000Z",
        note: `저녁 급식${nul}`,
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    ["note_has_control_chars"],
  );
});

test("self assignment rejects UUIDs that differ only by letter case", () => {
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "4f01f5fd-1b52-4d63-9bbc-7f6055f7b7cc",
        assigneeId: "4F01F5FD-1B52-4D63-9BBC-7F6055F7B7CC",
        startsAt: "2026-07-27T02:00:00.000Z",
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    ["self_assignment"],
  );
});

test("shift requests beyond the future horizon are rejected", () => {
  const now = new Date("2026-07-27T01:00:00.000Z");
  assert.equal(CARE_SHIFT_MAX_FUTURE_MS, 60 * 24 * 60 * 60 * 1000);
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: new Date(
          now.getTime() + CARE_SHIFT_MAX_FUTURE_MS + 60_000,
        ).toISOString(),
      },
      now,
    ),
    ["starts_at_too_far"],
  );
});

test("a shift request exactly at the future horizon is accepted", () => {
  const now = new Date("2026-07-27T01:00:00.000Z");
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: new Date(now.getTime() + CARE_SHIFT_MAX_FUTURE_MS).toISOString(),
      },
      now,
    ),
    [],
  );
});

test("known API error codes map to Korean guidance", () => {
  assert.equal(
    describeCareShiftError("rate_limited", "기본 안내"),
    "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
  );
  assert.equal(
    describeCareShiftError("not_ready", "기본 안내"),
    "돌봄 교대 기능을 준비하고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  assert.equal(
    describeCareShiftError("invalid_transition", "기본 안내"),
    "이미 처리된 요청이에요. 목록을 새로고침해 주세요.",
  );
  assert.equal(
    describeCareShiftError("duplicate_request", "기본 안내"),
    "같은 시각에 이미 요청한 돌봄 교대가 있어요.",
  );
});

test("invalid_params details map to specific Korean guidance", () => {
  assert.equal(
    describeCareShiftValidationErrors(["starts_at_not_future"], "기본 안내"),
    "시작 시각은 지금보다 뒤여야 해요.",
  );
  assert.equal(
    describeCareShiftValidationErrors(["starts_at_too_far"], "기본 안내"),
    "시작 시각은 60일 안에서만 선택할 수 있어요.",
  );
  assert.equal(
    describeCareShiftValidationErrors(["note_too_long"], "기본 안내"),
    `메모는 ${CARE_SHIFT_NOTE_MAX_LENGTH}자까지 입력할 수 있어요.`,
  );
  assert.equal(
    describeCareShiftValidationErrors(["self_assignment"], "기본 안내"),
    "자기 자신에게는 교대를 요청할 수 없어요.",
  );
});

test("the first recognized validation detail wins over later ones", () => {
  assert.equal(
    describeCareShiftValidationErrors(
      ["unknown_detail", "note_has_control_chars", "note_too_long"],
      "기본 안내",
    ),
    "메모에 사용할 수 없는 특수 문자가 있어요.",
  );
});

test("missing, empty, or unknown validation details fall back safely", () => {
  assert.equal(describeCareShiftValidationErrors(undefined, "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftValidationErrors(null, "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftValidationErrors("not-an-array", "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftValidationErrors([], "기본 안내"), "기본 안내");
  assert.equal(
    describeCareShiftValidationErrors(["unknown_detail", 42], "기본 안내"),
    "기본 안내",
  );
  assert.equal(describeCareShiftValidationErrors(["toString"], "기본 안내"), "기본 안내");
});

test("unknown or missing error codes fall back to the given Korean message", () => {
  assert.equal(describeCareShiftError("create_failed", "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftError("list_failed", "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftError(undefined, "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftError(42, "기본 안내"), "기본 안내");
});

test("prototype keys as error codes fall back safely", () => {
  assert.equal(describeCareShiftError("toString", "fallback"), "fallback");
  assert.equal(describeCareShiftError("constructor", "fallback"), "fallback");
  assert.equal(describeCareShiftError("hasOwnProperty", "fallback"), "fallback");
});

test("datetime-local min uses local wall-clock time, not UTC", () => {
  assert.equal(
    toDatetimeLocalValue(new Date(2026, 6, 27, 21, 30)),
    "2026-07-27T21:30",
  );
});

test("datetime-local values round-trip through local Date parsing", () => {
  const date = new Date("2026-07-26T12:00:00.000Z");
  const value = toDatetimeLocalValue(date);
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(new Date(value).getTime(), date.getTime());
});

test("care shift list window starts exactly one week before now", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");
  assert.equal(CARE_SHIFT_LIST_LOOKBACK_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(
    careShiftListWindowStart(now),
    "2026-07-19T15:00:00.000Z",
  );
});

test("care shift list window keeps recent shifts and drops stale ones", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");
  const windowStart = careShiftListWindowStart(now);
  assert.ok("2026-07-20T09:00:00.000Z" >= windowStart);
  assert.ok("2026-07-01T09:00:00.000Z" < windowStart);
});

test("only plain object request bodies are accepted", () => {
  assert.equal(isCareShiftBodyObject({}), true);
  assert.equal(isCareShiftBodyObject({ circle_id: "abc" }), true);
});

test("oversized request bodies are rejected before JSON parsing", () => {
  assert.equal(CARE_SHIFT_MAX_BODY_BYTES, 16 * 1024);
  assert.equal(isCareShiftBodyTooLarge("a".repeat(CARE_SHIFT_MAX_BODY_BYTES)), false);
  assert.equal(isCareShiftBodyTooLarge("a".repeat(CARE_SHIFT_MAX_BODY_BYTES + 1)), true);
  assert.equal(
    isCareShiftBodyTooLarge("가".repeat(Math.floor(CARE_SHIFT_MAX_BODY_BYTES / 3))),
    false,
  );
  assert.equal(
    isCareShiftBodyTooLarge("가".repeat(Math.floor(CARE_SHIFT_MAX_BODY_BYTES / 3) + 1)),
    true,
  );
  assert.equal(isCareShiftBodyTooLarge(""), false);
  assert.equal(
    describeCareShiftError("payload_too_large", "기본 안내"),
    "입력한 내용이 너무 길어요. 메모를 줄여 주세요.",
  );
});

test("declared oversized request bodies are rejected before reading the stream", () => {
  assert.equal(
    isCareShiftContentLengthTooLarge(String(CARE_SHIFT_MAX_BODY_BYTES)),
    false,
  );
  assert.equal(
    isCareShiftContentLengthTooLarge(String(CARE_SHIFT_MAX_BODY_BYTES + 1)),
    true,
  );
  assert.equal(isCareShiftContentLengthTooLarge("9".repeat(400)), true);
  assert.equal(isCareShiftContentLengthTooLarge(null), false);
  assert.equal(isCareShiftContentLengthTooLarge("chunked"), false);
  assert.equal(isCareShiftContentLengthTooLarge("-1"), false);
});

test("care shift write requests accept only JSON media types", () => {
  assert.equal(isCareShiftJsonContentType("application/json"), true);
  assert.equal(isCareShiftJsonContentType("Application/JSON; charset=utf-8"), true);
  assert.equal(isCareShiftJsonContentType(" text/plain "), false);
  assert.equal(isCareShiftJsonContentType("application/json-patch+json"), false);
  assert.equal(isCareShiftJsonContentType(null), false);
  assert.equal(
    describeCareShiftError("unsupported_media_type", "기본 안내"),
    "요청 형식이 올바르지 않아요. 다시 시도해 주세요.",
  );
});

test("null, array, and primitive JSON bodies are rejected before field access", () => {
  assert.equal(isCareShiftBodyObject(null), false);
  assert.equal(isCareShiftBodyObject([]), false);
  assert.equal(isCareShiftBodyObject("care"), false);
  assert.equal(isCareShiftBodyObject(42), false);
  assert.equal(isCareShiftBodyObject(undefined), false);
});

test("missing participants and malformed time have stable errors", () => {
  assert.deepEqual(
    validateCareShiftRequest({
      requesterId: " ",
      assigneeId: "",
      startsAt: "not-a-date",
    }),
    ["requester_required", "assignee_required", "invalid_starts_at"],
  );
});

test("care shift success and error responses are not cached", () => {
  assert.match(
    careShiftRouteSource,
    /const PRIVATE_NO_STORE_HEADERS = \{\s*"Cache-Control": "private, no-store",\s*Vary: "Cookie, Authorization",?\s*\} as const;/,
  );
  const getHandlerSource = careShiftRouteSource.slice(
    careShiftRouteSource.indexOf("export async function GET()"),
    careShiftRouteSource.indexOf("export async function POST("),
  );
  assert.equal(
    (getHandlerSource.match(/headers: PRIVATE_NO_STORE_HEADERS/g) ?? []).length,
    7,
  );
  const postHandlerSource = careShiftRouteSource.slice(
    careShiftRouteSource.indexOf("export async function POST("),
    careShiftRouteSource.indexOf("export async function PATCH("),
  );
  assert.equal(
    (postHandlerSource.match(/headers: PRIVATE_NO_STORE_HEADERS/g) ?? []).length,
    18,
  );
  const patchHandlerSource = careShiftRouteSource.slice(
    careShiftRouteSource.indexOf("export async function PATCH("),
  );
  assert.equal(
    (patchHandlerSource.match(/headers: PRIVATE_NO_STORE_HEADERS/g) ?? [])
      .length,
    17,
  );
});

test("care shift transition refreshes are discarded after auth context changes", () => {
  const transitionSource = careShiftPageSource.slice(
    careShiftPageSource.indexOf("const handleCareShiftTransition"),
    careShiftPageSource.indexOf("if (authLoading)"),
  );
  const guardIndex = transitionSource.indexOf(
    "if (authContextId !== careShiftAuthContextId.current) return;",
  );
  const refreshIndex = transitionSource.indexOf("await loadCareShifts()");
  assert.notEqual(guardIndex, -1);
  assert.notEqual(refreshIndex, -1);
  assert.ok(
    guardIndex < refreshIndex,
    "전환 응답의 목록 재조회는 인증 컨텍스트 가드 뒤에 와야 한다",
  );
});

test("care shift auth context tracks the user id, not the user object identity", () => {
  // 토큰 갱신은 같은 사용자여도 새 user 객체를 만든다. 객체 정체성에
  // 걸리면 진행 중 요청의 finally 가드가 어긋나 제출 상태가 영구히 잠긴다.
  assert.match(careShiftPageSource, /const userId = user\?\.id \?\? null;/);
  assert.match(
    careShiftPageSource,
    /if \(!userId \|\| !isCoreJourneyEnabled\("P3"\)\) return;/,
  );
  assert.match(careShiftPageSource, /\}, \[userId\]\);/);
  assert.match(careShiftPageSource, /\}, \[loadCareShifts, userId\]\);/);
  assert.doesNotMatch(careShiftPageSource, /\}, \[loadCareShifts, user\]\);/);
  assert.doesNotMatch(careShiftPageSource, /useCallback\([\s\S]*?\}, \[user\]\);/);
});

test("removing a circle member clears a stale care shift assignee", () => {
  assert.match(
    careShiftPageSource,
    /removeCircleMember\(m\.member_id\);[\s\S]*?setShiftAssigneeId\(\(prev\) => \(prev === m\.member_id \? "" : prev\)\);/,
  );
});
