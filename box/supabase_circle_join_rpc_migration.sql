-- ══════════════════════════════════════════
-- 도시공존 — Circle 초대 링크 자기 가입 RPC
-- 목적: 카카오톡 초대 링크 클릭한 사용자가 직접 owner의 서클에 합류.
--       기존 circle_members_invite RLS는 owner만 insert 허용 → 링크 자기 가입 불가.
--       security definer 함수로 RLS 우회하면서 본인 가입만 허용 (auth.uid() 검증).
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_migration.sql, supabase_circle_recursion_fix.sql
-- ══════════════════════════════════════════

create or replace function public.join_circle_by_owner(p_owner_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_circle_id uuid;
  v_member_id uuid;
  v_existing record;
begin
  v_member_id := auth.uid();
  if v_member_id is null then
    raise exception '로그인이 필요해요.';
  end if;
  if v_member_id = p_owner_id then
    return 'self';
  end if;

  -- owner의 서클 찾기
  select id into v_circle_id
  from public.caretaker_circles
  where owner_id = p_owner_id
  limit 1;

  -- owner의 서클이 없으면 자동 생성 (definer 권한)
  if v_circle_id is null then
    insert into public.caretaker_circles (owner_id, name)
    values (p_owner_id, '내 서클')
    returning id into v_circle_id;
  end if;

  -- 기존 멤버 row 확인
  select id, status into v_existing
  from public.circle_members
  where circle_id = v_circle_id and member_id = v_member_id
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      return 'already';
    end if;
    update public.circle_members
      set status = 'accepted', accepted_at = now()
      where id = v_existing.id;
    return 'accepted';
  end if;

  -- 신규 자기 가입 (accepted로 즉시 등록)
  insert into public.circle_members (circle_id, member_id, status, accepted_at)
  values (v_circle_id, v_member_id, 'accepted', now());
  return 'accepted';
end;
$$;

grant execute on function public.join_circle_by_owner(uuid) to authenticated;
