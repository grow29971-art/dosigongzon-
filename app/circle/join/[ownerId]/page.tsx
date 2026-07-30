"use client";

// Private Circle 초대 링크 진입 페이지.
// 링크 형식: /circle/join/[ownerId]
// 동작: 로그인 확인 → owner 정보 조회 → 수락/거절 버튼.
// 본인이 owner면 안내 메시지.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2, ShieldCheck, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { thumbnailUrl } from "@/lib/cats-repo";

export default function CircleJoinPage() {
  const params = useParams<{ ownerId: string }>();
  const ownerId = decodeURIComponent(params.ownerId ?? "");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [ownerProfile, setOwnerProfile] = useState<{
    id: string;
    nickname: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"accepted" | "rejected" | "already" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ownerId) return;
    const supabase = createClient();
    supabase
      .from("profiles_public")
      .select("id, nickname, avatar_url")
      .eq("id", ownerId)
      .maybeSingle()
      .then((res: { data: { id: string; nickname: string | null; avatar_url: string | null } | null }) => {
        setOwnerProfile(res.data);
        setLoading(false);
      });
  }, [ownerId]);

  const isSelf = user?.id === ownerId;

  const handleAccept = async () => {
    if (!user || !ownerProfile || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      // security definer RPC로 RLS 우회 + auth.uid() 본인 검증
      const { data, error: rpcErr } = await supabase.rpc("join_circle_by_owner", {
        p_owner_id: ownerId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (data === "already") setResult("already");
      else if (data === "self") throw new Error("본인의 초대 링크는 가입할 수 없어요.");
      else setResult("accepted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => {
    setResult("rejected");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "#F7F4EE" }}>
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh px-6 pt-20 text-center" style={{ background: "#F7F4EE" }}>
        <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: "#4F6B53" }} />
        <p className="text-[15px] font-extrabold text-text-main mb-2">서클 초대 받기</p>
        <p className="text-[13px] text-text-sub mb-5">로그인하시면 초대를 수락할 수 있어요.</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/circle/join/${ownerId}`)}`}
          className="inline-block px-6 py-2.5 rounded-2xl bg-primary text-white font-extrabold text-[13px] active:scale-95"
        >
          로그인하고 수락하기
        </Link>
      </div>
    );
  }

  if (!ownerProfile) {
    return (
      <div className="min-h-dvh px-6 pt-20 text-center" style={{ background: "#F7F4EE" }}>
        <p className="text-[14px] text-text-sub mb-3">유효하지 않은 초대 링크예요.</p>
        <Link href="/mypage/circle" className="text-primary text-[13px] font-bold">
          내 서클로 이동
        </Link>
      </div>
    );
  }

  if (isSelf) {
    return (
      <div className="min-h-dvh px-6 pt-20 text-center" style={{ background: "#F7F4EE" }}>
        <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: "#4F6B53" }} />
        <p className="text-[14px] text-text-sub mb-3">본인의 초대 링크예요.</p>
        <p className="text-[12.5px] text-text-light mb-5">이 링크를 카카오톡으로 공유해 이웃을 초대해보세요.</p>
        <Link href="/mypage/circle" className="inline-block px-6 py-2.5 rounded-2xl bg-primary text-white font-extrabold text-[13px] active:scale-95">
          내 서클 관리
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-6 pt-14 pb-10" style={{ background: "#F7F4EE" }}>
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/mypage/circle"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[16px] font-extrabold text-text-main">서클 초대</h1>
      </div>

      {result === "accepted" || result === "already" ? (
        <div
          className="rounded-3xl p-6 text-center"
          style={{
            background: "linear-gradient(160deg, #4F6B53 0%, #6B8E6F 70%, #8FAE92 100%)",
            color: "#fff",
          }}
        >
          <Check size={40} className="mx-auto mb-3" color="#FFF7C4" />
          <p className="text-[18px] font-extrabold mb-2">
            {result === "already" ? "이미 멤버예요" : "서클에 합류했어요!"}
          </p>
          <p className="text-[12.5px] mb-5" style={{ color: "rgba(255,255,255,0.85)" }}>
            {ownerProfile.nickname ?? "익명"}님의 Private Circle 멤버로 등록됐어요.
          </p>
          <Link
            href="/map"
            className="inline-block px-6 py-2.5 rounded-2xl bg-white font-extrabold text-[13px] active:scale-95"
            style={{ color: "#4F6B53" }}
          >
            지도로 이동
          </Link>
        </div>
      ) : result === "rejected" ? (
        <div className="rounded-3xl p-6 text-center bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-[15px] font-bold text-text-main mb-3">초대를 거절했어요</p>
          <Link href="/" className="text-primary text-[13px] font-bold">홈으로</Link>
        </div>
      ) : (
        <>
          <div
            className="rounded-3xl p-6 mb-4 text-center bg-white"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
          >
            <div className="flex justify-center mb-3">
              <Avatar url={ownerProfile.avatar_url} size={72} />
            </div>
            <p className="text-[10.5px] font-extrabold tracking-[0.18em] mb-1.5" style={{ color: "#4F6B53" }}>
              PRIVATE CIRCLE 초대
            </p>
            <p className="text-[16px] font-extrabold text-text-main leading-snug mb-2">
              <b style={{ color: "#4F6B53" }}>{ownerProfile.nickname ?? "익명 케어테이커"}</b>
              님이 당신을<br />서클에 초대했어요
            </p>
            <p className="text-[12px] text-text-sub leading-relaxed">
              수락하면 이 분이 "내 서클" 핀으로 등록한 고양이를
              <br />볼 수 있는 신뢰 그룹에 합류하게 돼요.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: "#FBEAEA" }}>
              <p className="text-[12.5px]" style={{ color: "#B84545" }}>{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={busy}
              className="flex-1 py-3 rounded-2xl text-[14px] font-bold active:scale-95 disabled:opacity-50"
              style={{ background: "#EEE8E0", color: "#8B7562" }}
            >
              <X size={14} className="inline mr-1" /> 거절
            </button>
            <button
              onClick={handleAccept}
              disabled={busy}
              className="flex-[1.5] py-3 rounded-2xl text-[14px] font-extrabold text-white active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #4F6B53 0%, #6B8E6F 100%)",
                boxShadow: "0 4px 12px rgba(79,107,83,0.3)",
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin inline" /> : <Check size={14} className="inline mr-1" />}
              수락하기
            </button>
          </div>

          <p className="text-[11px] text-text-light text-center mt-4 leading-relaxed">
            서클 멤버가 되어도 본인 동의 없이 위치가 공유되지 않아요.
            <br />언제든지 마이페이지 → 내 서클에서 나갈 수 있어요.
          </p>
        </>
      )}
    </div>
  );
}

function Avatar({ url, size = 40 }: { url: string | null; size?: number }) {
  const safe = sanitizeImageUrl(url, "");
  if (!safe) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white text-[24px] font-extrabold"
        style={{ width: size, height: size, background: "linear-gradient(135deg, #4F6B53, #6B8E6F)" }}
      >
        🐾
      </div>
    );
  }
  const thumb = thumbnailUrl(safe, size * 2) ?? safe;
  return (
    <Image
      src={thumb}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ border: "3px solid rgba(79,107,83,0.18)" }}
      unoptimized
    />
  );
}
