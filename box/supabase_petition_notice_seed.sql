-- ══════════════════════════════════════════
-- 청원 안내 공지 시드 (2026-07-22)
-- 대상 청원: 소유자 없는 고양이 급식 제한 반대 및 인도적 관리체계 마련에 관한 청원
--   (2026-07-22 실측: 동의 30,259/50,000 · 마감 2026-08-15 · 본문 검증 완료)
-- 선행: supabase_petition_notice_migration.sql 실행 후 이 파일 실행
-- 내리기 기준: ① 8/15 청원 마감 시 무조건 ② 8/5 점검에서 클릭 20건 미만 시
-- ══════════════════════════════════════════

-- 기존 활성 공지 내리기 (팝업은 한 번에 하나만)
update public.app_announcements set active = false where active = true;

insert into public.app_announcements (body, active, link_url, link_label)
values (
  E'📋 길고양이 돌봄 관련 국민동의청원이 진행 중입니다\n\n''소유자 없는 고양이 급식 제한 반대 및 인도적 관리체계 마련에 관한 청원''이 8월 15일까지 국회에서 동의를 받고 있어요. 책임 있는 급식 관리, TNR 보완, 돌봄자가 참여하는 협의체 구성을 요구하는 내용이에요.\n\n내용을 직접 읽어보시고, 동의하신다면 국회 사이트에서 간편인증 후 참여할 수 있어요.\n\n※ 동의는 국회 사이트에서만 집계되며, 도시공존은 참여 여부를 수집하지 않아요.',
  true,
  'https://petitions.assembly.go.kr/proceed/onGoingAll/562B4A9C51F069C4E064ECE7A7064E8B',
  '청원 읽어보기'
);

-- ══════════════════════════════════════════
-- 롤백 (공지 내리기 — 데이터 삭제 아님)
-- update public.app_announcements set active = false
--   where link_url like '%562B4A9C51F069C4E064ECE7A7064E8B%';
-- ══════════════════════════════════════════
