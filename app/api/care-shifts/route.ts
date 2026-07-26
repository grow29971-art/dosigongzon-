import { NextResponse } from "next/server";

import { validateCareShiftRequest } from "@/lib/care-shift";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

type CreateCareShiftBody = {
  circle_id?: unknown;
  assignee_id?: unknown;
  starts_at?: unknown;
  note?: unknown;
};

export async function POST(request: Request) {
  if (!isCoreJourneyEnabled("P3")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`care-shift:create:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: CreateCareShiftBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (
    typeof body.circle_id !== "string" ||
    typeof body.assignee_id !== "string" ||
    typeof body.starts_at !== "string" ||
    (body.note != null && typeof body.note !== "string")
  ) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
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
      { status: 400 },
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
    if (error.code === "42P01") {
      return NextResponse.json({ error: "not_ready" }, { status: 503 });
    }
    if (error.code === "42501" || error.code === "23503") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("[care-shifts] create failed:", error.code);
    return NextResponse.json({ error: "create_failed" }, { status: 502 });
  }

  return NextResponse.json({ shift: data }, { status: 201 });
}
