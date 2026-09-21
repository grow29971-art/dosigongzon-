import HomeAuthed from "@/app/components/HomeAuthed";
import WeeklyHotPosts from "@/app/components/WeeklyHotPosts";
import AdoptionSeekingSection from "@/app/components/AdoptionSeekingSection";
import Event1000Banner from "@/app/components/Event1000Banner";
import AsyncNode from "../AsyncNode";

// 본 앱 app/(main)/page.tsx의 미니앱판 — 미니앱은 항상 로그인 상태라 HomeAuthed만 쓰고,
// 서버 컴포넌트 슬롯 3종은 AsyncNode로 클라이언트에서 채운다.
export default function Home() {
  return (
    <HomeAuthed
      hotSlot={<AsyncNode fn={WeeklyHotPosts} props={{}} />}
      adoptionSlot={<AsyncNode fn={AdoptionSeekingSection} props={{}} />}
      eventSlot={<AsyncNode fn={Event1000Banner} props={{}} />}
    />
  );
}
