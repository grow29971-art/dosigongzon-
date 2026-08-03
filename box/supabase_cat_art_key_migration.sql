-- ══════════════════════════════════════════════════════════════
-- 고양이 마커 캐릭터 팔레트 (art_key) — 2026-08-04
-- AI 카드 생성 시 Gemini가 판독한 features(colors/pattern/traits)에서
-- 지도 마커 캐릭터 팔레트를 파생해 저장한다 (치즈/고등어/턱시도/올블랙 등 15종).
-- 신규 등록: app/api/cats/generate-card가 deriveArtKey()로 저장.
-- 이 파일: 컬럼 추가 + 기존 고양이 백필 (features가 이미 판독돼 있는 행).
-- CASE 로직은 lib/cat-art.ts deriveArtKey()와 일치해야 한다.
-- ══════════════════════════════════════════════════════════════

alter table public.cats add column if not exists art_key text;

-- 백필: features(AI 판독 결과)가 있는 기존 고양이에 art_key 유도.
-- features 컬럼이 아직 없는 환경이면 통째로 건너뜀 (배포 순서 독립).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cats' and column_name = 'features'
  ) then
    update public.cats c
    set art_key = d.key
    from (
      select id,
        case
          when traits_txt like '%odd_eye%' or traits_txt like '%oddeye%' then 'oddeye'
          when pattern = 'calico'
            or (pattern = 'van' and colors_txt similar to '%(orange|ginger|red|cream|apricot)%' and colors_txt like '%black%') then 'calico'
          when pattern in ('tortoiseshell', 'torbie') then 'tortie'
          when pattern = 'tuxedo' then 'tuxedo'
          when pattern = 'colorpoint' then 'siamese'
          when pattern = 'tabby' and colors_txt similar to '%(orange|ginger|red|cream|apricot)%' then 'cheese'
          when pattern = 'tabby' and colors_txt similar to '%(gray|grey|blue|silver)%' then 'mackerel'
          when pattern = 'tabby' and colors_txt similar to '%(brown|beige|tan|sand)%' then 'beigetabby'
          when pattern = 'tabby' then 'mackerel'
          when pattern in ('bicolor', 'van') and colors_txt like '%black%' and colors_txt like '%white%' then 'cowcat'
          when pattern in ('bicolor', 'van') and colors_txt similar to '%(orange|ginger|red|cream|apricot)%' then 'cheese'
          when pattern in ('bicolor', 'van') then 'graytabby'
          when colors_txt like '%black%' and colors_txt not like '%white%' then 'allblack'
          when colors_txt like '%white%' and colors_txt not like '%black%'
            and colors_txt not similar to '%(orange|ginger|red|cream|apricot|gray|grey|blue|silver)%' then 'allwhite'
          when colors_txt like '%black%' and colors_txt like '%white%' then 'cowcat'
          when colors_txt similar to '%(gray|grey|blue|silver)%' then 'russianblue'
          when colors_txt similar to '%(orange|ginger|red|cream|apricot)%' then 'caramel'
          when colors_txt similar to '%(brown|beige|tan|sand)%' then 'beigetabby'
          else null
        end as key
      from (
        select id,
          lower(coalesce(features->>'pattern', '')) as pattern,
          lower(coalesce(features->>'colors', '')) as colors_txt,
          lower(coalesce(features->>'traits', '')) as traits_txt
        from public.cats
        where features is not null and art_key is null
      ) f
    ) d
    where c.id = d.id and d.key is not null;
  end if;
end $$;

-- 검증 (실행 후 확인용):
-- select art_key, count(*) from public.cats group by art_key order by count(*) desc;

-- ── 롤백 ──
-- alter table public.cats drop column if exists art_key;
