-- ══════════════════════════════════════════
-- 관리자(admins) + 뉴스(news) 테이블 + RLS + 시드
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ 번역 기능이 켜져있으면 꺼주세요 (Chrome 자동번역이 SQL을 망가뜨림)
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. admins 테이블
-- ──────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now() not null
);

alter table public.admins enable row level security;

drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self"
  on public.admins
  for select
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- 2. news 테이블
-- ──────────────────────────────────────────
create table if not exists public.news (
  id             uuid primary key default gen_random_uuid(),
  badge_type     text not null default 'notice'
                 check (badge_type in ('event', 'tnr', 'law', 'notice', 'urgent')),
  title          text not null,
  description    text,
  image_url      text,
  date_label     text,
  dday           text,
  body           text,
  external_url   text,
  external_label text,
  pinned         boolean default false not null,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

create index if not exists news_pinned_created_idx
  on public.news (pinned desc, created_at desc);

alter table public.news enable row level security;

drop policy if exists "news_read_public" on public.news;
create policy "news_read_public"
  on public.news
  for select
  using (true);

drop policy if exists "news_insert_admin" on public.news;
create policy "news_insert_admin"
  on public.news
  for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "news_update_admin" on public.news;
create policy "news_update_admin"
  on public.news
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "news_delete_admin" on public.news;
create policy "news_delete_admin"
  on public.news
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 3. 초기 관리자 등록
-- ──────────────────────────────────────────
insert into public.admins (user_id)
  select id from auth.users
  where lower(email) = lower('grow29971@gmail.com')
  on conflict (user_id) do nothing;

-- ──────────────────────────────────────────
-- 4. 시드 데이터 (첫 실행 시에만 insert)
--     이미 뉴스가 있으면 건너뛰도록 감싸서 안전하게.
-- ──────────────────────────────────────────
do $$
begin
  if (select count(*) from public.news) = 0 then
    insert into public.news
      (badge_type, title, description, image_url, date_label, dday, body, external_url, external_label)
    values
      (
        'event',
        '2026 궁디팡팡 캣페스타',
        '전국 최대 고양이 문화 축제가 서울에서 열립니다',
        'https://placehold.co/800x450/EEE8E0/C47E5A?text=CAT+FESTA+2026',
        '5월 15일',
        'D-38',
        E'전국 최대 규모의 고양이 문화 축제가 올해도 서울에서 개최됩니다.\n\n일시: 2026년 5월 15일(금) ~ 5월 17일(일)\n장소: 서울 코엑스 Hall A\n\n주요 프로그램:\n- 전국 길고양이 보호 단체 부스 120여 개\n- 수의사와 함께하는 무료 건강 상담\n- 고양이 용품 나눔 마켓\n- TNR 사업 성과 발표 세미나\n- 길고양이 사진 공모전 시상식\n\n입장료: 무료 (사전 등록 시 기념품 증정)',
        'https://www.catfesta.kr',
        '궁디팡팡 공식 홈페이지'
      ),
      (
        'tnr',
        '인천시 남동구 상반기 길고양이 TNR 접수 안내',
        '남동구 관내 길고양이 중성화 수술 무료 지원',
        'https://placehold.co/800x450/E8ECE5/6B8E6F?text=TNR+Program',
        '4월 10일 시작',
        'D-3',
        E'인천광역시 남동구에서 2026년 상반기 길고양이 TNR(포획-중성화-방사) 사업 접수를 시작합니다.\n\n접수 기간: 2026년 4월 10일(목) ~ 예산 소진 시까지\n대상 지역: 남동구 전 지역\n수술 비용: 전액 무료 (구비 지원)\n\n신청 방법:\n1) 남동구청 동물보호 담당부서 전화 접수 (032-453-2580)\n2) 인천시 동물보호관리시스템 온라인 접수',
        'https://www.namdong.go.kr',
        '남동구청 홈페이지'
      ),
      (
        'law',
        '개정 동물보호법 학대 처벌 강화 안내',
        '상습 학대 시 형의 1/2 가중, 사육 제한 명령 신설',
        'https://placehold.co/800x450/EAE6E8/7A6B8E?text=Animal+Protection+Law',
        '2026.04.01 시행',
        '시행중',
        E'2026년 4월 1일부터 개정된 동물보호법이 시행됩니다. 주요 변경 사항을 안내드립니다.\n\n주요 개정 내용:\n\n학대 처벌 강화 (제8조)\n- 기존: 2년 이하 징역 또는 2000만원 이하 벌금\n- 개정: 3년 이하 징역 또는 3000만원 이하 벌금\n- 상습범: 형의 1/2 가중\n\n사육 제한 명령 신설 (제46조의2)\n- 학대 전력자에 대해 최대 5년간 동물 사육 금지',
        'https://www.law.go.kr',
        '국가법령정보센터'
      );
  end if;
end $$;

-- ──────────────────────────────────────────
-- 5. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
