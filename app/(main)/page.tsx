// 서버 컴포넌트 — 인증 상태에 따라 SEO 랜딩 or 로그인 유저 대시보드 선택
// 비로그인 방문자와 크롤러는 서버 렌더된 HomeLanding 을 받음 → SEO ↑

import { createClient } from "@/lib/supabase/server";
import HomeAuthed from "@/app/components/HomeAuthed";
import HomeLanding from "@/app/components/HomeLanding";
import WeeklyHotPosts from "@/app/components/WeeklyHotPosts";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // HOT 게시글은 서버에서 계산해서 양쪽 모두에 내려줌 (client 컴포넌트에서
  // 추가 API 라운드트립 없이 SSR 결과를 바로 렌더).
  const hotSlot = <WeeklyHotPosts />;
  if (user) {
    return <HomeAuthed hotSlot={hotSlot} />;
  }
  return <HomeLanding hotSlot={hotSlot} />;
}
