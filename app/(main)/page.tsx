// 서버 컴포넌트 — 인증 상태에 따라 SEO 랜딩 or 로그인 유저 대시보드 선택
// 비로그인 방문자와 크롤러는 서버 렌더된 HomeLanding 을 받음 → SEO ↑

import { createClient } from "@/lib/supabase/server";
import HomeAuthed from "@/app/components/HomeAuthed";
import HomeLanding from "@/app/components/HomeLanding";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return <HomeAuthed />;
  }
  return <HomeLanding />;
}
