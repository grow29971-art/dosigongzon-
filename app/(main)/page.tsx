// 서버 컴포넌트 — 인증 상태에 따라 SEO 랜딩 or 로그인 유저 대시보드 선택
// 비로그인 방문자와 크롤러는 서버 렌더된 HomeLanding 을 받음 → SEO ↑

import { createClient } from "@/lib/supabase/server";
import HomeAuthed from "@/app/components/HomeAuthed";
import HomeLanding from "@/app/components/HomeLanding";
import WeeklyHotPosts from "@/app/components/WeeklyHotPosts";
import AdoptionSeekingSection from "@/app/components/AdoptionSeekingSection";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // HOT 게시글 + 입양·임보 찾는 아이들 — 서버에서 SSR → client에서 즉시 렌더.
  const hotSlot = <WeeklyHotPosts />;
  const adoptionSlot = <AdoptionSeekingSection />;
  if (user) {
    return <HomeAuthed hotSlot={hotSlot} adoptionSlot={adoptionSlot} />;
  }
  return <HomeLanding hotSlot={hotSlot} adoptionSlot={adoptionSlot} />;
}
