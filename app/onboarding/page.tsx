"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Handshake,
  Heart,
  Star,
  Moon,
  PawPrint,
  ChevronRight,
  MapPin,
  BookOpen,
  Compass,
  UserPlus,
  Sparkles,
  Check,
} from "lucide-react";
import { listCats, thumbnailUrl, type Cat } from "@/lib/cats-repo";
import { logFunnelEvent } from "@/lib/funnel-repo";

/* ═══ 온보딩 3단계 ═══
   intro(감성 1장) → pick(마음 가는 아이 고르기 = 첫 행동) → start(시작점 선택)
   설계 근거: box/디자인_벤치마킹_20260718.md — 가입을 첫 행동 뒤로(inverted onboarding).
   가입 전 실제 케어 기록은 RLS상 불가 → "챙길 아이 고르기"로 주인공 의식 커밋을 만들고,
   고른 아이는 localStorage(dosigongzon_pending_care)에 남겨 가입 후 홈에서 이어받는다. */

type Phase = "intro" | "pick" | "start";

const INTRO = {
  bg: "linear-gradient(170deg, #5a3e22 0%, #b87050 25%, #d4906a 50%, #e8c4a8 75%, #f5f0e8 100%)",
  accentColor: "var(--color-primary)",
  title: "우리 동네에도\n밥을 기다리는 아이가 있어요.",
  body: "혼자 하는 돌봄이 외롭지 않도록,\n도시공존이 곁에서 함께 걸을게요.",
  floats: [
    { Icon: Heart, x: "20%", y: "10%", size: 24, opacity: 0.15, rotate: -12 },
    { Icon: PawPrint, x: "75%", y: "12%", size: 22, opacity: 0.12, rotate: 10 },
    { Icon: Star, x: "82%", y: "30%", size: 16, opacity: 0.1, rotate: 0 },
    { Icon: Heart, x: "15%", y: "55%", size: 18, opacity: 0.08, rotate: 15 },
    { Icon: PawPrint, x: "70%", y: "60%", size: 20, opacity: 0.08, rotate: -18 },
    { Icon: Moon, x: "45%", y: "16%", size: 14, opacity: 0.1, rotate: 25 },
  ],
};

const PICK_BG = "linear-gradient(170deg, #3d2e1f 0%, #6b4c2a 35%, #c8956c 75%, #e8c49a 100%)";
const START_BG = "linear-gradient(170deg, var(--color-primary) 0%, var(--color-primary-light) 50%, #F5F0E8 100%)";

/* ═══ 페이지 ═══ */
export default function OnboardingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [fading, setFading] = useState(false);
  const [heartbeat, setHeartbeat] = useState(false);

  const [cats, setCats] = useState<Cat[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [picked, setPicked] = useState<Cat | null>(null);

  // 퍼널 1단: intro 진입 (기기당 1회)
  useEffect(() => {
    logFunnelEvent("onboarding_intro");
  }, []);

  // 미리보기용 실제 고양이 몇 마리 (anon 읽기 — 지도와 동일 경로)
  useEffect(() => {
    let alive = true;
    listCats()
      .then((all) => {
        if (!alive) return;
        const preview = all.filter((c) => c.photo_url && c.visibility === "public").slice(0, 6);
        setCats(preview);
      })
      .catch(() => {
        /* 실패해도 온보딩은 계속 — pick 단계에서 등록 유도로 대체 */
      })
      .finally(() => {
        if (alive) setLoadingCats(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const completeOnboarding = () => {
    try {
      localStorage.setItem("dosigongzon_onboarded", "true");
    } catch {}
  };

  const transition = (next: Phase) => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setPhase(next);
      setFading(false);
    }, 350);
  };

  const goAndComplete = (path: string) => {
    setHeartbeat(true);
    completeOnboarding();
    setTimeout(() => router.push(path), 400);
  };

  // 첫 행동: 마음 가는 아이 고르기 → 커밋을 localStorage에 남기고 start로
  const pickCat = (cat: Cat) => {
    if (picked) return;
    setPicked(cat);
    try {
      localStorage.setItem(
        "dosigongzon_pending_care",
        JSON.stringify({ id: cat.id, name: cat.name, at: new Date().toISOString() }),
      );
    } catch {}
    // 퍼널 2단: 실제 아이 선택 (감정 커밋)
    logFunnelEvent("onboarding_pick", cat.id);
    setTimeout(() => transition("start"), 950);
  };

  const activeBg = phase === "intro" ? INTRO.bg : phase === "pick" ? PICK_BG : START_BG;
  const dark = phase !== "start";

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: activeBg, transition: "background 0.8s ease" }}>
      {/* ── 건너뛰기 ── */}
      <button
        onClick={() => {
          completeOnboarding();
          router.push("/map");
        }}
        className="absolute top-12 right-5 z-20 text-[13px] font-medium px-3 py-1.5 rounded-full active:opacity-50 transition-opacity"
        style={{ color: dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}
      >
        건너뛰기
      </button>

      {/* ── 배경 파티클 (intro만) ── */}
      {phase === "intro" && (
        <div className="absolute inset-0 z-0 transition-opacity duration-700" style={{ opacity: fading ? 0 : 1 }}>
          {INTRO.floats.map((f, i) => (
            <div key={i} className="absolute" style={{ left: f.x, top: f.y, opacity: f.opacity, transform: `rotate(${f.rotate}deg)` }}>
              <f.Icon size={f.size} color={INTRO.accentColor} strokeWidth={1.2} />
            </div>
          ))}
        </div>
      )}

      {/* ══ intro ══ */}
      {phase === "intro" && (
        <div
          className="relative z-10 flex flex-col items-center justify-center h-full px-8 transition-opacity duration-300"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-10"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Handshake size={44} color={INTRO.accentColor} strokeWidth={1.4} />
          </div>
          <h1 className="text-[24px] font-extrabold text-center leading-[1.5] tracking-tight mb-6 whitespace-pre-line" style={{ color: "rgba(255,255,255,0.95)" }}>
            {INTRO.title}
          </h1>
          <p className="text-[15px] text-center leading-[2] whitespace-pre-line max-w-[300px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            {INTRO.body}
          </p>
        </div>
      )}

      {/* ══ pick — 첫 행동: 마음 가는 아이 고르기 ══ */}
      {phase === "pick" && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 transition-opacity duration-300" style={{ opacity: fading ? 0 : 1 }}>
          <h1 className="text-[22px] font-extrabold text-center text-white tracking-tight mb-2 whitespace-pre-line">
            {picked ? `${picked.name}, 잘 부탁해요 🐾` : "마음이 가는 아이를\n한 번 골라볼까요?"}
          </h1>
          <p className="text-[13px] text-center text-white/85 mb-7 px-4">
            {picked ? "가입하면 이 아이의 밥·건강을 기록할 수 있어요." : "지금 도움을 기다리는 우리 동네 아이들이에요."}
          </p>

          {loadingCats ? (
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-[128px] h-[160px] rounded-3xl bg-white/15 animate-pulse shrink-0" />
              ))}
            </div>
          ) : cats.length > 0 ? (
            <div className="w-full max-w-[420px] overflow-x-auto flex gap-3 px-1 pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
              {cats.map((cat) => {
                const isPicked = picked?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => pickCat(cat)}
                    disabled={!!picked}
                    className="relative shrink-0 w-[128px] snap-center rounded-3xl overflow-hidden active:scale-[0.97] transition-all"
                    style={{
                      boxShadow: isPicked ? "0 0 0 3px #fff, 0 10px 28px rgba(0,0,0,0.3)" : "0 6px 20px rgba(0,0,0,0.22)",
                      opacity: picked && !isPicked ? 0.45 : 1,
                    }}
                  >
                    <div className="w-full h-[160px] bg-white/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnailUrl(cat.photo_url, 256) ?? ""}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div
                      className="absolute inset-x-0 bottom-0 px-2.5 py-2 text-left"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent)" }}
                    >
                      <p className="text-[13px] font-extrabold text-white truncate">{cat.name}</p>
                      {cat.region && <p className="text-[10px] text-white/75 truncate">{cat.region}</p>}
                    </div>
                    {isPicked && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--color-primary)" }}>
                          <Check size={24} color="#fff" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="w-full max-w-[360px]">
              <ActionCard
                icon={<MapPin size={20} color="#C47E5A" strokeWidth={2.2} />}
                title="우리 동네 첫 등록자 되기"
                desc="아직 등록된 아이가 없어요 — 첫 아이를 소개해주세요"
                onClick={() => goAndComplete("/signup")}
              />
            </div>
          )}

          {!picked && cats.length > 0 && (
            <button onClick={() => transition("start")} className="mt-7 text-[12.5px] font-bold text-white/75 underline underline-offset-4">
              아직 잘 모르겠어요 — 둘러볼래요
            </button>
          )}
        </div>
      )}

      {/* ══ start — 시작점 선택 ══ */}
      {phase === "start" && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 transition-opacity duration-300" style={{ opacity: fading ? 0 : 1 }}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: "rgba(255,255,255,0.45)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.5)" }}
          >
            <Compass size={38} color="#FFFFFF" strokeWidth={1.6} />
          </div>
          <h1 className="text-[22px] font-extrabold text-center text-white tracking-tight mb-2">어디부터 시작해볼까요?</h1>
          <p className="text-[13px] text-center text-white/85 mb-8">관심 가는 곳부터 천천히 둘러보세요</p>

          <div className="w-full max-w-[360px] space-y-2.5">
            <SignupActionCard pickedName={picked?.name ?? null} onClick={() => goAndComplete("/signup")} />
            <ActionCard
              icon={<MapPin size={20} color="#3182F6" strokeWidth={2.2} />}
              title="가입 없이 지도부터 보기"
              desc="구경만 해도 OK — 나중에 가입할 수 있어요"
              onClick={() => goAndComplete("/map")}
            />
            <ActionCard
              icon={<BookOpen size={20} color="#5BA876" strokeWidth={2.2} />}
              title="보호지침 먼저 익히기"
              desc="응급·먹이·TNR·임시보호 가이드"
              onClick={() => goAndComplete("/protection")}
            />
          </div>

          <button onClick={() => goAndComplete("/login")} className="mt-6 text-[12px] font-bold text-white/80 underline underline-offset-4">
            이미 계정이 있어요 — 로그인
          </button>
        </div>
      )}

      {/* ── 하단 컨트롤 ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-10">
        {/* 인디케이터 3점 */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          {(["intro", "pick", "start"] as Phase[]).map((p) => (
            <div
              key={p}
              aria-current={p === phase ? "step" : undefined}
              className="transition-all duration-500 ease-out"
              style={{
                width: p === phase ? 28 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: p === phase ? (dark ? "#fff" : "var(--color-primary)") : dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)",
              }}
            />
          ))}
        </div>

        {/* intro에서만 다음 버튼. pick/start는 화면 내 선택이 진행 액션. */}
        {phase === "intro" && (
          <button
            onClick={() => transition("pick")}
            className="w-full py-4.5 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2"
            style={{
              backgroundColor: INTRO.accentColor,
              color: "#fff",
              boxShadow: `0 8px 24px ${INTRO.accentColor}44`,
              transform: heartbeat ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.3s ease",
            }}
          >
            <PawPrint size={20} />
            우리 동네 아이들 보기
          </button>
        )}
      </div>

      <style>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          25% { transform: scale(1.06); }
          50% { transform: scale(0.98); }
          75% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function SignupActionCard({ onClick, pickedName }: { onClick: () => void; pickedName: string | null }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl active:scale-[0.98] transition-transform relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #2A2A28 0%, #4A3F36 100%)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,247,196,0.25)",
      }}
    >
      <span aria-hidden="true" className="absolute -top-3 -right-3 w-16 h-16 rounded-full" style={{ background: "rgba(255,247,196,0.10)", filter: "blur(8px)" }} />
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative z-10"
        style={{ background: "linear-gradient(135deg, #FFF7C4 0%, #E8B040 100%)", boxShadow: "0 4px 12px rgba(232,176,64,0.35)" }}
      >
        <UserPlus size={22} color="#2A2A28" strokeWidth={2.4} />
      </div>
      <div className="flex-1 min-w-0 text-left relative z-10">
        <div className="flex items-center gap-1 mb-0.5">
          <Sparkles size={10} color="#FFF7C4" />
          <p className="text-[9.5px] font-extrabold tracking-[0.14em]" style={{ color: "#FFF7C4" }}>
            추천 · 1초 가입
          </p>
        </div>
        <p className="text-[14.5px] font-extrabold text-white tracking-tight leading-tight">
          {pickedName ? `${pickedName} 챙기러 가기` : "지금 가입하고 함께 시작하기"}
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
          {pickedName ? "계정을 만들면 이 아이 기록이 남아요" : "카카오·구글로 1초 · 광고 없음 · 무료"}
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0 relative z-10" color="#FFF7C4" />
    </button>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
      style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 6px 20px rgba(0,0,0,0.10)", border: "1px solid rgba(255,255,255,0.6)" }}
    >
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.05)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[14.5px] font-extrabold text-text-main tracking-tight leading-tight">{title}</p>
        <p className="text-[11.5px] text-text-sub mt-0.5 truncate">{desc}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-text-light" />
    </button>
  );
}
