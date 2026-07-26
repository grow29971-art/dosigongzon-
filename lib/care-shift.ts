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
