-- 배틀/포획 타이틀 연동을 위한 프로필 카운터 컬럼 추가
-- 고양이학대범 격퇴 횟수 / 역대 최고 연승 / 완벽 포획 횟수
alter table profiles add column if not exists boss_defeats int not null default 0;
alter table profiles add column if not exists best_win_streak int not null default 0;
alter table profiles add column if not exists perfect_catch_count int not null default 0;

select 'battle titles migration done' as status;
