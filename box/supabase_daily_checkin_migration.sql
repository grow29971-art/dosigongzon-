-- 도시공존 — 일일 출석체크 컬럼 추가
-- 하루 1회만 출석체크 보상을 받을 수 있게 마지막 출석 날짜(KST)를 저장.

alter table public.profiles
  add column if not exists last_checkin_date date null;

comment on column public.profiles.last_checkin_date is '마지막으로 일일 출석체크를 완료한 날짜(KST 기준). 오늘 날짜와 다르면 아직 출석 안 함.';
