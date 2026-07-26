import { NextResponse } from "next/server";

import {
  careShiftListWindowStart,
  getRequiredCurrentStatus,
  isCareShiftBodyObject,
  isCareShiftBodyTooLarge,
  isCareShiftCheckViolationCode,
  isCareShiftContentLengthTooLarge,
  isCareShiftJsonContentType,
  isCareShiftSchemaNotReadyCode,
  isCareShiftTransitionViolationCode,
  isCareShiftUuid,
  validateCareShiftRequest,
} from "@/lib/care-shift";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

type CreateCareShiftBody = {
  circle_id?: unknown;
  assignee_id?: unknown;
  starts_at?: unknown;
  note?: unknown;
};

type TransitionCareShiftBody = {
  id?: unknown;
  status?: unknown;
};

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;

export async function GET() {
  if (!isCoreJourneyEnabled("P3")) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!rateLimit(`care-shift:list:${user.id}`, { max: 60, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const { data, error } = await supabase
    .from("care_shifts")
    .select("id, circle_id, requester_id, assignee_id, starts_at, note, status")
    .or(`requester_id.eq.${user.id},assignee_id.eq.${user.id}`)
    .gte("starts_at", careShiftListWindowStart(new Date()))
    .order("starts_at", { ascending: true })
    .limit(50);

  if (error) {
    if (isCareShiftSchemaNotReadyCode(error.code)) {
      return NextResponse.json(
        { error: "not_ready" },
        { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    console.error("[care-shifts] list failed:", error.code);
    return NextResponse.json(
      { error: "list_failed" },
      { status: 502, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    { shifts: data ?? [] },
    { headers: PRIVATE_NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!isCoreJourneyEnabled("P3")) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!rateLimit(`care-shift:create:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (isCareShiftContentLengthTooLarge(request.headers.get("content-length"))) {
    return NextResponse.json(
      { error: "payload_too_large" },
      { status: 413, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!isCareShiftJsonContentType(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: "unsupported_media_type" },
      { status: 415, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (isCareShiftBodyTooLarge(rawBody)) {
    return NextResponse.json(
      { error: "payload_too_large" },
      { status: 413, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!isCareShiftBodyObject(parsed)) {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  const body: CreateCareShiftBody = parsed;

  if (
    typeof body.circle_id !== "string" ||
    typeof body.assignee_id !== "string" ||
    typeof body.starts_at !== "string" ||
    (body.note != null && typeof body.note !== "string")
  ) {
    return NextResponse.json(
      { error: "invalid_params" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!isCareShiftUuid(body.circle_id) || !isCareShiftUuid(body.assignee_id)) {
    return NextResponse.json(
      { error: "invalid_params" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const note = body.note?.trim() || null;
  const validationErrors = validateCareShiftRequest({
    requesterId: user.id,
    assigneeId: body.assignee_id,
    startsAt: body.starts_at,
    note,
  });
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: "invalid_params", details: validationErrors },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const { data, error } = await supabase
    .from("care_shifts")
    .insert({
      circle_id: body.circle_id,
      requester_id: user.id,
      assignee_id: body.assignee_id,
      starts_at: body.starts_at,
      note,
    })
    .select("id, circle_id, requester_id, assignee_id, starts_at, note, status")
    .single();

  if (error) {
    if (isCareShiftSchemaNotReadyCode(error.code)) {
      return NextResponse.json(
        { error: "not_ready" },
        { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    if (error.code === "42501" || error.code === "23503") {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "duplicate_request" },
        { status: 409, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    if (isCareShiftCheckViolationCode(error.code)) {
      return NextResponse.json(
        { error: "invalid_params" },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    console.error("[care-shifts] create failed:", error.code);
    return NextResponse.json(
      { error: "create_failed" },
      { status: 502, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    { shift: data },
    { status: 201, headers: PRIVATE_NO_STORE_HEADERS },
  );
}

export async function PATCH(request: Request) {
  if (!isCoreJourneyEnabled("P3")) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!rateLimit(`care-shift:transition:${user.id}`, { max: 20, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (isCareShiftContentLengthTooLarge(request.headers.get("content-length"))) {
    return NextResponse.json(
      { error: "payload_too_large" },
      { status: 413, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!isCareShiftJsonContentType(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: "unsupported_media_type" },
      { status: 415, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (isCareShiftBodyTooLarge(rawBody)) {
    return NextResponse.json(
      { error: "payload_too_large" },
      { status: 413, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!isCareShiftBodyObject(parsed)) {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  const body: TransitionCareShiftBody = parsed;

  if (
    typeof body.id !== "string" ||
    (body.status !== "accepted" && body.status !== "completed")
  ) {
    return NextResponse.json(
      { error: "invalid_params" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  if (!isCareShiftUuid(body.id)) {
    return NextResponse.json(
      { error: "invalid_params" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const expectedStatus = getRequiredCurrentStatus(body.status, "assignee");
  if (!expectedStatus) {
    return NextResponse.json(
      { error: "invalid_params" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  const { data, error } = await supabase
    .from("care_shifts")
    .update({ status: body.status })
    .eq("id", body.id)
    .eq("assignee_id", user.id)
    .eq("status", expectedStatus)
    .select("id, circle_id, requester_id, assignee_id, starts_at, note, status")
    .single();

  if (error) {
    if (isCareShiftSchemaNotReadyCode(error.code)) {
      return NextResponse.json(
        { error: "not_ready" },
        { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    if (
      error.code === "PGRST116" ||
      isCareShiftTransitionViolationCode(error.code)
    ) {
      return NextResponse.json(
        { error: "invalid_transition" },
        { status: 409, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
    console.error("[care-shifts] transition failed:", error.code);
    return NextResponse.json(
      { error: "transition_failed" },
      { status: 502, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    { shift: data },
    { headers: PRIVATE_NO_STORE_HEADERS },
  );
}
