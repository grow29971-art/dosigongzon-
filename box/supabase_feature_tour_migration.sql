-- 도시공존 — 최초 1회 "기능 웰컴 투어" 완료 상태 저장 컬럼
--
-- 기존 /onboarding(dosigongzon_onboarded localStorage 게이트)은 로그인 전에 뜨는
-- 감성/미션 소개 슬라이드 + "어디부터 시작할까요" 목적지 선택 화면이라 기능 설명이 없다.
-- 이번에 추가하는 FeatureTourModal은 로그인 후 홈 최초 진입 시 1회, 포획/지도/AI집사/
-- 등급성장/배틀/커뮤니티/가이드 7개 기능을 하나씩 보여주는 별도 레이어다.
-- 이름이 겹치면 헷갈리므로 컬럼명은 feature_tour_completed_at으로 분리한다.

alter table public.profiles
  add column if not exists feature_tour_completed_at timestamptz;
