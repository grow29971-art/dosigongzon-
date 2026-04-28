"use client";

// 1000명 이벤트 — 키링 응모 페이지.
// 응모 자격: 본인이 등록한 고양이 1마리 이상.
// 응모 시 본인이 돌보는 아이 중 1마리를 골라 그 아이 모양으로 커스텀 키링 제작.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Gift, Check, Users, TrendingUp, MapPin, PawPrint, PlusCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { sanitizeImageUrl } from "@/lib/url-validate";
import InviteSection from "@/app/components/InviteSection";

interface MyCat {
  id: string;
  name: string;
  region: string | null;
  photo_url: string | null;
}

export default function KeyringEventPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [alreadyEntered, setAlreadyEntered] = useState(false);
  const [enteredCatName, setEnteredCatName] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const [myCats, setMyCats] = useState<MyCat[] | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // 가입자 수
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .then((res: { count: number | null }) => setMemberCount(res.count ?? 0));
  }, []);

  // 비로그인 가드
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/event/keyring");
    }
  }, [user, authLoading, router]);

  // 이미 응모했는지 + 어떤 고양이로 응모했는지 확인
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("event_keyring_entries")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then((res: { data: { id: string; name: string | null } | null }) => {
        if (res.data) {
          setAlreadyEntered(true);
          setEnteredCatName(res.data.name);
        }
      });
  }, [user]);

  // 내가 등록한 고양이 목록 (caretaker_id = me)
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("cats")
      .select("id, name, region, photo_url")
      .eq("caretaker_id", user.id)
      .order("created_at", { ascending: false })
      .then((res: { data: MyCat[] | null }) => {
        const list = res.data ?? [];
        setMyCats(list);
        if (list.length > 0) setSelectedCatId(list[0].id);
      });
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !selectedCatId) return;
    setError("");
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/event/keyring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ cat_id: selectedCatId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "응모 실패");

      const cat = myCats?.find((c) => c.id === selectedCatId);
      setDone(true);
      setEnteredCatName(cat?.name ?? null);
      toast.success(`${cat?.name ?? "고양이"} 모양 키링 응모 완료! 🎁`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "응모 중 오류 발생");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const hasNoCats = myCats !== null && myCats.length === 0;
  const isLoadingCats = myCats === null;

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[18px] font-extrabold text-text-main flex items-center gap-1.5">
          <Gift size={16} style={{ color: "#C47E5A" }} />
          1000명 이벤트 응모
        </h1>
      </div>

      {/* 안내 카드 — 컨셉 갱신 */}
      <div className="px-4 mt-2 mb-4">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, #FFF8F2 0%, #FCEFD9 100%)",
            border: "1.5px solid rgba(196,126,90,0.25)",
          }}
        >
          <p className="text-[10.5px] font-extrabold tracking-[0.12em] mb-1" style={{ color: "#C47E5A" }}>
            🎁 내가 돌보는 아이 모양 커스텀 키링
          </p>
          <p className="text-[13.5px] font-extrabold text-text-main leading-tight mb-1">
            가입자 1,000명 달성 시 20명 추첨
          </p>
          <p className="text-[11.5px] text-text-sub leading-relaxed">
            당신이 돌보는 길고양이를 직접 등록하고 응모하면, 그 아이 모양의 아크릴 키링을 만들어 보내드려요.
            세상에 하나뿐인 우리 동네 아이의 키링.
          </p>
        </div>
      </div>

      {/* 진행률 */}
      {memberCount !== null && memberCount < 1000 && (
        <div className="px-4 mb-4">
          <div
            className="rounded-2xl p-4"
            style={{ background: "#FFF", border: "1px solid rgba(196,126,90,0.18)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={13} style={{ color: "#C47E5A" }} />
                <span className="text-[12px] font-extrabold text-text-main">이벤트 진행도</span>
              </div>
              <span className="text-[11px] font-extrabold" style={{ color: "#C47E5A" }}>
                {memberCount.toLocaleString()} / 1,000명
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: "rgba(196,126,90,0.15)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((memberCount / 1000) * 100, 100)}%`,
                  background: "linear-gradient(90deg, #C47E5A 0%, #E88D5A 100%)",
                }}
              />
            </div>
            <p className="text-[10.5px] text-text-sub mt-2 leading-relaxed">
              {1000 - memberCount}명만 더 모이면 추첨이 시작돼요. 친구를 초대하면 더 빨리 달성해요 🎁
            </p>
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="px-4">
        {done || alreadyEntered ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: done ? "#E8ECE5" : "#FFF4E0",
              border: `1px solid ${done ? "#D6DCD2" : "#F5DAB0"}`,
            }}
          >
            {done ? (
              <Check size={36} className="mx-auto mb-3" style={{ color: "#6B8E6F" }} />
            ) : (
              <Gift size={36} className="mx-auto mb-3" style={{ color: "#B07A1C" }} />
            )}
            <p className="text-[16px] font-extrabold text-text-main mb-2">
              {done ? "응모 완료!" : "이미 응모하셨어요"}
            </p>
            {enteredCatName && (
              <p className="text-[13px] font-bold mb-1" style={{ color: "#C47E5A" }}>
                🐾 {enteredCatName} 모양 키링 응모
              </p>
            )}
            <p className="text-[13px] text-text-sub leading-relaxed">
              가입자 1,000명 달성 시 추첨해서 쪽지로 안내드릴게요.
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-[11.5px]" style={{ color: "#C47E5A" }}>
              <Users size={12} />
              <b>친구를 초대하면 추첨이 더 빨리 시작돼요!</b>
            </div>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
            >
              홈으로
            </Link>
          </div>
        ) : isLoadingCats ? (
          <div className="py-10 flex justify-center">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : hasNoCats ? (
          // 자격 미달: 등록한 고양이 0마리
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "#FFF", border: "1px dashed rgba(196,126,90,0.35)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
              style={{ background: "rgba(196,126,90,0.12)" }}
            >
              <PawPrint size={26} style={{ color: "#C47E5A" }} />
            </div>
            <p className="text-[15px] font-extrabold text-text-main mb-1.5">
              먼저 돌보는 아이를 등록해주세요
            </p>
            <p className="text-[12.5px] text-text-sub leading-relaxed mb-4">
              이 키링은 <b className="text-text-main">당신이 돌보는 아이 모양</b>으로 제작돼요.
              <br />
              지도에서 + 버튼을 눌러 첫 아이를 등록하면 응모할 수 있어요.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-primary text-white text-[14px] font-extrabold active:scale-[0.97] transition-transform"
              style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.30)" }}
            >
              <PlusCircle size={16} />
              지도에서 첫 아이 등록하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="rounded-xl px-4 py-3" style={{ background: "#FBEAEA" }}>
                <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
              </div>
            )}

            {/* 고양이 선택 */}
            <div>
              <p className="text-[12px] font-extrabold text-text-main mb-2 flex items-center gap-1.5">
                <PawPrint size={13} style={{ color: "#C47E5A" }} />
                키링으로 만들 아이를 골라주세요
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(myCats ?? []).map((cat) => {
                  const photo = sanitizeImageUrl(
                    cat.photo_url,
                    "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F",
                  );
                  const selected = cat.id === selectedCatId;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCatId(cat.id)}
                      className="relative block rounded-2xl overflow-hidden bg-white text-left active:scale-[0.98] transition-transform"
                      style={{
                        boxShadow: selected
                          ? "0 8px 22px rgba(196,126,90,0.35)"
                          : "0 2px 10px rgba(0,0,0,0.06)",
                        border: selected ? "2.5px solid #C47E5A" : "2.5px solid transparent",
                      }}
                    >
                      <div className="relative" style={{ aspectRatio: "1 / 1" }}>
                        <Image
                          src={photo}
                          alt={cat.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 200px"
                          style={{ objectFit: "cover" }}
                        />
                        {selected && (
                          <div
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: "#C47E5A", boxShadow: "0 2px 8px rgba(196,126,90,0.5)" }}
                          >
                            <Check size={13} color="#fff" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-[13px] font-extrabold text-text-main truncate">{cat.name}</p>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <MapPin size={10} className="text-text-light" />
                          <span className="text-[10.5px] text-text-sub truncate">
                            {cat.region ?? "우리 동네"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-text-light mt-2 leading-relaxed">
                · 한 분당 1회만 응모 가능. 응모 후엔 변경할 수 없어요.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedCatId}
              className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-2"
              style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.30)" }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}
              {submitting
                ? "응모 중..."
                : selectedCatId
                  ? `이 아이 모양 키링으로 응모하기`
                  : "키링으로 만들 아이를 골라주세요"}
            </button>

            <p className="text-[10.5px] text-text-light text-center leading-relaxed pt-2">
              · 추첨되시면 쪽지로 키링 제작 진행 상황과 배송 정보를 안내드려요.<br />
              · 더 많은 아이를 돌보고 계시다면 지도에서 추가 등록해주세요.
            </p>
          </div>
        )}
      </div>

      {/* 친구 초대 */}
      <div className="px-4 mt-6">
        <div className="mb-2 flex items-start gap-2">
          <span className="text-[14px]">📣</span>
          <p className="text-[11.5px] text-text-sub leading-relaxed">
            <b className="text-text-main">친구를 초대해주세요.</b> 가입자 1,000명이 빨리 모일수록 추첨이 빨라지고,
            친구가 많으면 동네 길고양이가 더 안전해져요.
          </p>
        </div>
        <InviteSection />
      </div>
    </div>
  );
}
