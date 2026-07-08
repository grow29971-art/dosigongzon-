// 서버 컴포넌트 — 인증 상태에 따라 SEO 랜딩 or 로그인 유저 대시보드 선택
// 비로그인 방문자와 크롤러는 서버 렌더된 HomeLanding 을 받음 → SEO ↑

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import HomeAuthed from "@/app/components/HomeAuthed";
import HomeLanding from "@/app/components/HomeLanding";
import WeeklyHotPosts from "@/app/components/WeeklyHotPosts";
import AdoptionSeekingSection from "@/app/components/AdoptionSeekingSection";
import Event1000Banner from "@/app/components/Event1000Banner";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // HOT 게시글 + 입양·임보 + 1000명 이벤트 — 각각 독립된 쿼리라 Suspense로 감싸서
  // 로그인 확인이 끝나는 대로 셸을 먼저 스트리밍하고, 이 3개는 준비되는 대로 각자
  // 채워 넣는다. 예전엔 이 셋이 페이지 전체 응답을 같이 막고 있어서 홈이 다른
  // 페이지보다 눈에 띄게 느렸음(첫 바이트까지 1.5~3초, 다른 페이지는 0.4~1초).
  const hotSlot = <Suspense fallback={null}><WeeklyHotPosts /></Suspense>;
  const adoptionSlot = <Suspense fallback={null}><AdoptionSeekingSection /></Suspense>;
  const eventSlot = <Suspense fallback={null}><Event1000Banner /></Suspense>;
  if (user) {
    return <HomeAuthed hotSlot={hotSlot} adoptionSlot={adoptionSlot} eventSlot={eventSlot} />;
  }
  return <HomeLanding hotSlot={hotSlot} adoptionSlot={adoptionSlot} eventSlot={eventSlot} />;
}
