// 접속 팝업 공지 (app_announcements)
// 관리자가 등록한 공지를 사용자 최초 접속 시 모달로 표시.
// 읽기는 anon 포함 누구나(RLS: active=true), 쓰기는 admins 테이블 보유자만(RLS).

import { createClient } from "@/lib/supabase/client";

export interface Announcement {
  id: string;
  body: string;
  created_at: string;
}

/** 현재 활성 공지 1건 (없으면 null). 최신 것 우선. */
export async function getActiveAnnouncement(): Promise<Announcement | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("app_announcements")
    .select("id, body, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Announcement | null) ?? null;
}

/** 새 팝업 공지 등록 (관리자). 기존 활성 공지는 자동으로 내림. */
export async function publishAnnouncement(body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("공지 내용을 입력해주세요.");
  if (trimmed.length > 1000) throw new Error("공지는 1000자 이내로 작성해주세요.");
  const supabase = createClient();
  // 기존 활성 공지 내리기 (한 번에 하나만 노출)
  await supabase.from("app_announcements").update({ active: false }).eq("active", true);
  const { error } = await supabase
    .from("app_announcements")
    .insert({ body: trimmed, active: true });
  if (error) throw new Error(error.message);
}

/** 현재 팝업 공지 내리기 (관리자). */
export async function clearAnnouncements(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("app_announcements")
    .update({ active: false })
    .eq("active", true);
  if (error) throw new Error(error.message);
}
