"use client";

// 집회 참여하기 버튼 + 참여 인원 추산 (RallyPosterBanner 하단)
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
  const [count, setCount] = useState<number | null>(null);
  const [joined, setJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: cnt, error: cntErr } = await supabase.rpc("rally_participation_count");
      if (cancelled) return;
      // 테이블/RPC 미배포 등 — 버튼 자체를 숨겨서 홈을 깨뜨리지 않음
      if (cntErr) return;
      setCount(Number(cnt ?? 0));
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
      setCount((c) => (c ?? 0) + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 flex items-center gap-2.5">
      <button
        onClick={handleJoin}
        disabled={busy || done}
        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[14px] font-extrabold text-white active:scale-[0.97] transition-transform disabled:active:scale-100"
        style={{
          background: done
            ? "linear-gradient(135deg, #6B8E6F 0%, #4F6B53 100%)"
            : "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
          boxShadow: done ? "0 8px 20px rgba(107,142,111,0.28)" : "0 8px 20px rgba(173,94,59,0.28)",
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
      {count !== null && count > 0 && (
        <div
          className="shrink-0 px-3 py-2 rounded-2xl text-center"
          style={{ background: "#FFF3EC", border: "1px solid #F3D9CB" }}
        >
          <p className="text-[15px] font-extrabold tabular-nums leading-tight" style={{ color: "var(--color-primary-dark)" }}>
            {count.toLocaleString()}명
          </p>
          <p className="text-[9.5px] font-bold leading-tight" style={{ color: "#B07A5C" }}>함께해요</p>
        </div>
      )}
    </div>
  );
}
