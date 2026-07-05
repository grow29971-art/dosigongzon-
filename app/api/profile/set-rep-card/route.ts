import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cat_id } = await req.json();

  if (cat_id) {
    // 내 고양이인지 확인
    const { data: cat } = await supabase
      .from("cats")
      .select("id")
      .eq("id", cat_id)
      .eq("caretaker_id", user.id)
      .not("card_generated_at", "is", null)
      .maybeSingle();
    if (!cat) return NextResponse.json({ error: "cat not found" }, { status: 404 });
  }

  await supabase
    .from("profiles")
    .update({ rep_card_cat_id: cat_id ?? null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
