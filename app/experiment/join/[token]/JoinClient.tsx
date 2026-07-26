// 초대 랜딩 클라이언트 — 참여 버튼과 상태별 안내.
// 비로그인 사용자는 /login?next=<이 페이지>로 보냈다가 돌아와 이어서 참여한다.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sprout } from "lucide-react";
import { inviteCopy } from "@/lib/experiments-repo";

export type InviteState =
  | { status: "invalid" }
  | {
      status: "valid" | "expired" | "used" | "ended";
      experimentId: string;
      areaName: string;
      startsAt: string;
      endsAt: string;
    };

export default function JoinClient({ token, state }: { token: string; state: InviteState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const openedFired = useRef(false);

  // 계측: 초대 링크 열람 (클라이언트에서만 — 크롤러 제외). 실패 무시.
  useEffect(() => {
    if (state.status === "invalid" || openedFired.current) return;
    openedFired.current = true;
    fetch("/api/experiment/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ experimentId: state.experimentId, event: "invite_link_opened" }),
    }).catch(() => {});
  }, [state]);

  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/experiment/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/experiment/join/${token}`)}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "참여 처리에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      router.replace("/experiment");
    } catch {
      setError("연결이 불안정해요. 네트워크 확인 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const heading =
    state.status === "invalid"
      ? "유효하지 않은 초대예요"
      : state.status === "expired"
        ? "만료된 초대 링크예요"
        : state.status === "used"
          ? "이미 사용된 초대 링크예요"
          : state.status === "ended"
            ? "마무리된 실험이에요"
            : `${state.areaName} 돌봄 기록 실험`;

  return (
    <div className="min-h-dvh flex flex-col items-center px-6 pt-20 pb-10" style={{ background: "#FBF8F3" }}>
      <div
        className="w-full max-w-md rounded-[28px] p-7 text-center"
        style={{ background: "#fff", boxShadow: "0 8px 32px rgba(25,31,40,0.08)" }}
      >
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-full"
          style={{ width: 64, height: 64, background: "var(--color-primary-soft, rgba(173,94,59,0.1))" }}
          aria-hidden
        >
          <Sprout size={30} style={{ color: "var(--color-primary)" }} />
        </div>
        <h1 className="text-[20px] font-extrabold mb-2">{heading}</h1>

        {state.status === "valid" && (
          <>
            <p className="text-[14px] leading-relaxed mb-2" style={{ color: "#4E5968" }}>
              {inviteCopy(state.areaName)}
            </p>
            <p className="text-[12px] mb-5" style={{ color: "var(--color-text-light)" }}>
              기간: {state.startsAt} ~ {state.endsAt} · 하루 한 번, 버튼 하나로 기록해요.
            </p>
            <button
              onClick={join}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-2xl text-white text-[16px] font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ minHeight: 54, background: "var(--color-primary)" }}
            >
              {busy && <Loader2 size={18} className="animate-spin" />}
              함께 기록하기
            </button>
            {error && (
              <p role="alert" className="mt-3 text-[13px] font-semibold" style={{ color: "#C24747" }}>
                {error}
              </p>
            )}
          </>
        )}

        {state.status !== "valid" && (
          <>
            <p className="text-[14px] leading-relaxed mb-5" style={{ color: "var(--color-text-light)" }}>
              {state.status === "invalid" && "링크가 정확한지 확인하거나, 초대한 분께 새 링크를 요청해 주세요."}
              {state.status === "expired" && "초대한 분께 새 초대 링크를 요청해 주세요."}
              {state.status === "used" && "초대 링크는 한 분만 사용할 수 있어요. 초대한 분께 새 링크를 요청해 주세요."}
              {state.status === "ended" && "이번 실험은 끝났지만, 도시공존에서 계속 함께 돌볼 수 있어요."}
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-2xl text-[15px] font-bold"
              style={{ background: "var(--color-surface-alt, #F2F4F6)", color: "#4E5968" }}
            >
              도시공존 둘러보기
            </Link>
          </>
        )}
      </div>
      <p className="mt-6 text-[12px]" style={{ color: "var(--color-text-light)" }}>
        위치 정보는 공개되지 않아요 · 경쟁 순위 없음
      </p>
    </div>
  );
}
