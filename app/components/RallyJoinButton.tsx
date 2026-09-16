"use client";

// 집회 참여하기 버튼 (RallyPosterBanner 하단)
// 참여 인원 수는 화면에 표시하지 않는다 — 참여자가 적을 때 오히려 역효과라 2026-08-06 제거.
// 집계는 관리자가 DB에서 확인한다(rally_participation_count RPC).
// - 일반 유저: 1인 1회 (DB partial unique index) → 누르면 "참여 완료"로 고정
// - 관리자(admins 등재): 계속 누를 수 있음 (admin_extra=true 행으로 누적)
// - 비로그인: 로그인 페이지로 안내
// - 마이그레이션(supabase_rally_participation_migration.sql) 미실행 시 조용히 숨김

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RallyJoinButton() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // 참여 인원은 화면에 표시하지 않는다(2026-08-06). 이 호출은 테이블·RPC가
      // 실제로 배포됐는지 확인하는 용도 — 실패하면 버튼 자체를 숨겨 홈을 깨뜨리지 않는다.
      const { error: cntErr } = await supabase.rpc("rally_participation_count");
      if (cancelled) return;
      if (cntErr) return;
      setReady(true);

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (cancelled || !user) return;
      setLoggedIn(true);
      const [{ data: mine }, { data: adminRow }] = await Promise.all([
        supabase.from("rally_participations").select("id").eq("user_id", user.id).limit(1),
        supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setJoined((mine?.length ?? 0) > 0);
      setIsAdmin(!!adminRow);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready) return null;

  const done = joined && !isAdmin;

  const handleJoin = async () => {
    if (busy || done) return;
    if (!loggedIn) {
      router.push("/login?next=/");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/"); return; }
      const { error } = await supabase.from("rally_participations").insert({
        user_id: user.id,
        // 관리자의 2번째 클릭부터는 부스트 행 — 일반 유저는 항상 false
        admin_extra: isAdmin && joined,
      });
      if (error) {
        if (error.code === "23505") { setJoined(true); return; } // 이미 참여
        alert("잠시 후 다시 시도해주세요.");
        return;
      }
      setJoined(true);
    } finally {
      setBusy(false);
    }
  };

  // 참여 철회 — 집회 참여 이력은 민감할 수 있는 정보라 반드시 스스로 지울 수 있어야 한다.
  const handleCancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("rally_participations")
        .delete()
        .eq("user_id", user.id)
        .eq("admin_extra", false);
      if (error) {
        alert("취소하지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      setJoined(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <div className="mt-2.5 flex items-center gap-2.5">
      <button
        onClick={handleJoin}
        disabled={busy || done}
        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[15px] font-bold text-white press-strong transition-transform disabled:active:scale-100"
        style={{
          background: done
            ? "linear-gradient(135deg, #6B8E6F 0%, #4F6B53 100%)"
            : "var(--color-primary)",
          boxShadow: done ? "0 8px 20px rgba(107,142,111,0.28)" : "0 8px 20px rgba(176,92,54,0.28)",
        }}
      >
        {done ? (
          <>
            <Check size={16} />
            참여 완료! 8월 8일에 만나요
          </>
        ) : (
          <>
            <Megaphone size={16} />
            {busy ? "잠시만요…" : "집회 참여하기"}
          </>
        )}
      </button>
    </div>

    {/* 수집 고지 + 철회 경로 — 참여 이력은 본인만 볼 수 있고 언제든 지울 수 있어야 한다 */}
    <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-text-light">
      참여 여부는 <b>인원 추산에만</b> 쓰고 명단은 공개하지 않아요. 집회 다음 날 모두 삭제돼요.
      {done && (
        <>
          {" "}
          <button
            onClick={handleCancel}
            disabled={busy}
            className="underline font-bold disabled:opacity-50"
            style={{ color: "var(--color-primary-dark)" }}
          >
            참여 취소하기
          </button>
        </>
      )}
    </p>
    </>
  );
}
