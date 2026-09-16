"use client";

// 가입 직후 환영 페이지 — 축하 + 사용법 4단계 슬라이드.
// /api/auth/callback 에서 첫 가입자(!nickname_set)일 때 ?next=...로 우회시켜 들어온다.
// 이미 가입한 유저가 이 URL로 와도 그냥 next로 보내준다 (재노출 방지는 nickname_set 플래그로).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PartyPopper,
  Sparkles,
  MapPin,
  PawPrint,
  Heart,
  Bell,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Share,
  PlusSquare,
  Download,
  MessagesSquare,
} from "lucide-react";
import UIListRow from "@/app/components/ui/ListRow";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { trackPixelOnce } from "@/lib/meta-pixel";
import { PUSH_GATE_SEEN_PREFIX } from "@/app/components/PushOnboardInterstitial";

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeContent />
    </Suspense>
  );
}

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

// 마지막 슬라이드 CTA — next가 어디로 가는지에 따라 라벨 변경
function finalCtaLabel(next: string): string {
  if (next === "/" || next === "/map" || next.startsWith("/map?") || next.startsWith("/map#")) {
    return "지도로 시작하기";
  }
  if (next.startsWith("/community")) return "커뮤니티로 가기";
  if (next.startsWith("/messages")) return "쪽지로 가기";
  if (next.startsWith("/mypage")) return "마이페이지로 가기";
  if (next.startsWith("/protection")) return "보호지침으로 가기";
  return "시작하기";
}

// ── iOS 판별 헬퍼 (InstallAppMenuItem과 동일 로직) ──
// iOS 사파리(미설치)는 Notification API가 없어 알림 스텝이 스킵된다.
// 대신 "홈 화면에 추가" 스텝을 보여줘 설치 → 알림 경로를 연다. (2026-09-02)
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return isIos() && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const next = safeNext(searchParams.get("next"));

  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);
  const [earlySupporter, setEarlySupporter] = useState(false);
  // 마지막 슬라이드 후 의도 picker(audience 흡수)
  const [showIntent, setShowIntent] = useState(false);
  // 슬라이드 후 알림 켜기 스텝 — 신규 가입자 전원이 한 번은 통과 (2026-08-19 사장님 지시)
  const [showPush, setShowPush] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // iOS 미설치 유저용 "홈 화면에 추가" 스텝 — 알림 스텝의 iOS 대체재 (2026-09-02)
  const [showIosInstall, setShowIosInstall] = useState(false);
  // 건너뛰기로 온 유저는 알림 스텝 후 intent picker 없이 바로 목적지로 (기존 skip 동선 보존)
  const skippedSlidesRef = useRef(false);

  // 비로그인 시 홈으로
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  // 진입한 순간 "한 번 봤음" 마킹 — 중간 이탈해도 다시 강제 노출되지 않게.
  // Meta Pixel: 가입 완료 이벤트 — welcome은 신규 가입자만 거치므로 컨버전 발사 최적 위치.
  // userId 기반 dedup 키로 동일 사용자가 다시 봐도 중복 발사 X.
  // eventID=user.id로 서버 CAPI 이벤트와 dedup — 양쪽 발사돼도 한 번만 카운트.
  useEffect(() => {
    try { localStorage.setItem("dosigongzon_welcome_seen", "true"); } catch {}
    if (user?.id) {
      trackPixelOnce(
        `fbq_signup_fired_${user.id}`,
        "CompleteRegistration",
        { content_name: "signup_complete" },
        user.id,
      );
    }
  }, [user?.id]);

  // early_supporter 타이틀 조회
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("admin_title")
      .eq("id", user.id)
      .maybeSingle()
      .then((res: { data: { admin_title: string | null } | null }) => {
        if (res.data?.admin_title === "early_supporter") setEarlySupporter(true);
      });
  }, [user]);

  const nickname =
    (user?.user_metadata?.nickname as string | undefined)
    ?? user?.email?.split("@")[0]
    ?? "이웃";

  const goTo = (idx: number) => {
    if (idx === step || fading) return;
    setFading(true);
    setTimeout(() => {
      setStep(idx);
      setFading(false);
    }, 300);
  };

  // 알림 스텝을 띄울 수 있는 환경인지 — 미지원(iOS 비설치 등)·이미 응답한 경우는 조용히 통과
  const canPromptPush = () => {
    if (typeof window === "undefined") return false;
    if (typeof Notification === "undefined") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (Notification.permission !== "default") return false;
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()) return false;
    return true;
  };

  const finishOnboarding = () => {
    setShowPush(false);
    setShowIosInstall(false);
    if (!skippedSlidesRef.current && next === "/") {
      // 기본 목적지일 때만 의도 picker — 가입 전 명시적 URL이 있으면 그대로 존중
      setShowIntent(true);
    } else {
      router.replace(next);
    }
  };

  const goPushOrFinish = () => {
    if (canPromptPush()) {
      // 기존 유저용 전면 게이트(PushOnboardInterstitial)와 seen 키 공유 — 신규 가입자 이중 노출 방지
      try {
        if (user) localStorage.setItem(PUSH_GATE_SEEN_PREFIX + user.id, String(Date.now()));
      } catch { /* no-op */ }
      setShowPush(true);
    } else if (isIos() && !isStandalone()) {
      // iOS 미설치 = 웹푸시 불가 환경. 알림 대신 홈 화면 추가를 안내해 설치 → 알림 경로를 연다.
      setShowIosInstall(true);
    } else {
      finishOnboarding();
    }
  };

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      goTo(step + 1);
    } else {
      goPushOrFinish();
    }
  };

  // 슬라이드 건너뛰기도 알림 스텝은 한 번 거친다 — 신규 가입자 전원 노출 원칙
  const handleSkip = () => {
    skippedSlidesRef.current = true;
    goPushOrFinish();
  };

  // "알림 켜기" 탭(사용자 제스처) → 네이티브 권한 프롬프트 → 구독 + 마케팅 수신 동의.
  // 동의 문구는 버튼 위에 명시 — 구독·동의 통합 플로우 (PushOptInCard와 동일 패턴, 2026-07-22 리텐션 회의)
  const handleEnablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
        if (vapidKey) {
          const reg = await navigator.serviceWorker.ready;
          const existing = await reg.pushManager.getSubscription();
          if (!existing) {
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
            });
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription: sub.toJSON() }),
            });
          }
        }
        if (user) {
          try {
            await createClient()
              .from("profiles")
              .update({ marketing_push_enabled: true })
              .eq("id", user.id);
          } catch { /* 동의 반영 실패는 온보딩 진행을 막지 않음 */ }
        }
      }
    } catch {
      // 권한/구독 실패 — 온보딩은 계속 진행
    } finally {
      setPushBusy(false);
      finishOnboarding();
    }
  };

  // 의도 1문항 — user_metadata.intent에 저장 + 의도별 첫 화면 라우팅.
  // 광고로 들어온 broad audience를 앱 내부에서 흡수하기 위함.
  const pickIntent = async (intent: "caretaker" | "interested" | "browsing", target: string) => {
    try {
      const sb = createClient();
      await sb.auth.updateUser({ data: { intent } });
    } catch {
      /* 분류 저장 실패해도 라우팅은 진행 */
    }
    router.replace(target);
  };

  if (authLoading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface">
        <Sparkles size={28} className="animate-pulse" style={{ color: "var(--color-text-light)" }} />
      </div>
    );
  }

  // 알림 켜기 스텝 — 신규 가입자 전원 통과. "켜기" 탭이 곧 사용자 제스처라 네이티브 프롬프트 즉시 발화.
  if (showPush) {
    return (
      <div className="fixed inset-0 overflow-hidden flex flex-col bg-surface">
        <div className="flex-1 flex flex-col items-center justify-center px-7">
          <Bell size={44} strokeWidth={1.6} className="mb-7" style={{ color: "var(--color-text-main)" }} />

          <h2 className="text-[24px] font-bold text-center text-text-main tracking-tight leading-[1.4] mb-4">
            알림 켜고 시작해요
          </h2>
          <p className="text-[15px] text-center text-text-sub leading-[1.8] max-w-[320px]">
            댓글·쪽지 답장·돌봄 소식을 놓치지 않게 알려드려요.
          </p>
        </div>

        <div className="px-6 pb-10 z-20">
          {/* 정보통신망법 §50 — 마케팅 수신 동의 문구 명시 (구독·동의 통합 플로우) */}
          <p className="text-[11px] text-center mb-3 leading-relaxed text-text-light">
            켜면 돌봄·소식 알림(마케팅 포함) 수신에 동의해요 · 마이페이지에서 언제든 해제
          </p>
          <button
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="w-full h-12 text-[15px] font-semibold flex items-center justify-center gap-1.5 press disabled:opacity-60"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
          >
            <Bell size={17} />
            {pushBusy ? "설정 중..." : "알림 켜기"}
          </button>
          <button
            onClick={finishOnboarding}
            disabled={pushBusy}
            className="w-full py-3 mt-2 text-[13px] font-medium text-text-sub active:opacity-50"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    );
  }

  // iOS 홈 화면 추가 스텝 — 웹푸시가 안 되는 iOS 미설치 유저에게 설치 경로 안내 (2026-09-02).
  // 설치는 브라우저가 대신 해줄 수 없어(beforeinstallprompt 미지원) 안내만 하고 보내준다.
  if (showIosInstall) {
    return (
      <div className="fixed inset-0 overflow-hidden flex flex-col bg-surface">
        <div className="flex-1 flex flex-col items-center justify-center px-7">
          <Download size={44} strokeWidth={1.6} className="mb-7" style={{ color: "var(--color-text-main)" }} />

          <h2 className="text-[24px] font-bold text-center text-text-main tracking-tight leading-[1.4] mb-3">
            홈 화면에 추가해두세요
          </h2>
          <p className="text-[15px] text-center text-text-sub leading-[1.8] max-w-[320px] mb-6">
            아이폰은 홈 화면에 추가해야 댓글·쪽지·돌봄 알림을 받을 수 있어요.
          </p>

          {isIosSafari() ? (
            <div
              className="w-full max-w-[320px] px-4"
              style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div className="flex items-center gap-2.5 text-[15px] font-medium text-text-main py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
                <span className="w-6 h-6 flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: "var(--color-gray-100)", color: "var(--color-text-sub)", borderRadius: "var(--radius-square)" }}>1</span>
                <Share size={15} style={{ color: "var(--color-text-sub)" }} />
                <span>사파리 하단 공유 아이콘 탭</span>
              </div>
              <div className="flex items-center gap-2.5 text-[15px] font-medium text-text-main py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
                <span className="w-6 h-6 flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: "var(--color-gray-100)", color: "var(--color-text-sub)", borderRadius: "var(--radius-square)" }}>2</span>
                <PlusSquare size={15} style={{ color: "var(--color-text-sub)" }} />
                <span>&quot;홈 화면에 추가&quot; 선택</span>
              </div>
              <div className="flex items-center gap-2.5 text-[15px] font-medium text-text-main py-3">
                <span className="w-6 h-6 flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: "var(--color-gray-100)", color: "var(--color-text-sub)", borderRadius: "var(--radius-square)" }}>3</span>
                <span>우측 상단 &quot;추가&quot; 버튼</span>
              </div>
            </div>
          ) : (
            <div
              className="w-full max-w-[320px] px-5 py-4"
              style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <p className="text-[15px] font-medium text-text-main leading-[1.8]">
                <b>사파리</b>로 dosigongzon.com을 열고
                <br />
                공유 → &quot;홈 화면에 추가&quot;를 눌러주세요.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-10 z-20">
          <p className="text-[11px] text-center mb-3 leading-relaxed text-text-light">
            나중에 마이페이지 → 앱으로 설치하기에서도 할 수 있어요
          </p>
          <button
            onClick={finishOnboarding}
            className="w-full h-12 text-[15px] font-semibold flex items-center justify-center gap-1.5 press"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
          >
            확인했어요
          </button>
        </div>
      </div>
    );
  }

  // 마지막 슬라이드 후 의도 picker — 3-way 선택으로 audience 흡수.
  if (showIntent) {
    return (
      <div className="fixed inset-0 overflow-hidden flex flex-col bg-surface">
        <button
          onClick={() => router.replace(next)}
          className="absolute top-12 right-5 z-20 text-[13px] font-medium px-3 py-1.5 text-text-sub active:opacity-50"
        >
          건너뛰기
        </button>

        <div className="flex-1 flex flex-col items-center justify-center px-7">
          <h2 className="text-[24px] font-bold text-center text-text-main tracking-tight leading-[1.4] mb-2">
            어떻게 시작해볼까요?
          </h2>
          <p className="text-[13px] text-center text-text-sub mb-7 leading-relaxed">
            맞는 첫 화면을 보여드릴게요
          </p>

          <div
            className="w-full max-w-sm px-4"
            style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <UIListRow
              icon={<PawPrint size={22} strokeWidth={1.8} />}
              title="이미 돌보고 있어요"
              subtitle="지도·돌봄일지로 바로"
              onClick={() => pickIntent("caretaker", "/map")}
            />
            <UIListRow
              icon={<Heart size={22} strokeWidth={1.8} />}
              title="관심 있어 들어왔어요"
              subtitle="동네 둘러보면서 천천히"
              onClick={() => pickIntent("interested", "/")}
            />
            <UIListRow
              icon={<MessagesSquare size={22} strokeWidth={1.8} />}
              title="그냥 구경하러"
              subtitle="동네 커뮤니티 이야기부터"
              onClick={() => pickIntent("browsing", "/community")}
            />
          </div>
        </div>
      </div>
    );
  }

  const slide = SLIDES[step];
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col bg-surface">
      {/* 건너뛰기 */}
      <button
        onClick={handleSkip}
        className="absolute top-12 right-5 z-20 text-[13px] font-medium px-3 py-1.5 text-text-sub active:opacity-50"
      >
        건너뛰기
      </button>

      {/* 콘텐츠 */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-7 transition-opacity duration-300"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {/* 1번 슬라이드는 닉네임/축하 특수 레이아웃 */}
        {isFirst ? (
          <>
            <PartyPopper size={44} strokeWidth={1.6} className="mb-6" style={{ color: "var(--color-primary)" }} />

            {earlySupporter && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3"
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-square)",
                }}
              >
                <Sparkles size={11} style={{ color: "var(--color-text-sub)" }} />
                <span className="text-[11px] font-semibold text-text-sub">
                  EARLY SUPPORTER · 100명 한정
                </span>
              </div>
            )}

            <h1 className="text-[24px] font-bold text-center text-text-main tracking-tight leading-[1.3] mb-2">
              <span className="text-text-sub">환영합니다,</span>
              <br />
              <span style={{ color: "var(--color-primary)" }}>{nickname}</span>님
            </h1>
            {/* 닉네임 변경 가능 힌트 — 신규 가입자가 random nickname을 마음에 안 들어도 모르는 경우 방지 */}
            <p className="text-[13px] text-text-light mb-4 leading-snug text-center">
              닉네임은 마이페이지에서 바꿀 수 있어요
            </p>
            <p className="text-[15px] text-center text-text-sub leading-[1.85] max-w-[300px]">
              도시공존의 새로운 이웃이 되어주셔서 고마워요.
              {earlySupporter && (
                <>
                  <br />
                  <b className="text-text-main">초기 100명</b>에 들어오신 당신께
                  <br />
                  <b className="text-text-main">어얼리 서포터</b> 뱃지를 드릴게요.
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <slide.Icon size={40} strokeWidth={1.6} className="mb-7" style={{ color: "var(--color-text-main)" }} />
            <h2 className="text-[24px] font-bold text-center text-text-main tracking-tight leading-[1.4] mb-4 whitespace-pre-line">
              {slide.title}
            </h2>
            <p className="text-[15px] text-center text-text-sub leading-[1.8] max-w-[320px] whitespace-pre-line">
              {slide.body}
            </p>
          </>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="px-6 pb-10 z-20">
        {/* 인디케이터 */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-400 ease-out"
              style={{
                width: i === step ? 28 : 7,
                height: 7,
                borderRadius: "var(--radius-square-sm)",
                backgroundColor: i === step ? "var(--color-text-main)" : "var(--color-gray-300)",
              }}
              aria-label={`${i + 1}번째 안내`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => goTo(step - 1)}
              className="w-12 h-12 flex items-center justify-center press-strong"
              style={{
                background: "var(--color-gray-100)",
                borderRadius: "var(--radius-input)",
              }}
              aria-label="이전"
            >
              <ChevronLeft size={18} style={{ color: "var(--color-text-main)" }} />
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 h-12 text-[15px] font-semibold flex items-center justify-center gap-1.5 press"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
          >
            {isLast ? (
              <>
                <PawPrint size={17} />
                {finalCtaLabel(next)}
              </>
            ) : (
              <>
                다음
                <ChevronRight size={17} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// VAPID 공개키 → PushManager.subscribe용 바이트 배열 (PushOptInCard와 동일 헬퍼)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// 슬라이드 3개로 압축 (이전 5개 → 환영 / 지도+등록 / 돌봄+커뮤니티)
// 테스터 피드백상 5개는 끝까지 보지 않는 경우가 있어 핵심 메시지만 남김.
// 리디자인(2026-09-16): 슬라이드별 그라디언트·악센트 색 폐지 — 순백 바탕에 회색 선 아이콘.
const SLIDES = [
  {
    Icon: PartyPopper,
    title: "",
    body: "",
  },
  {
    Icon: MapPin,
    title: "우리 동네 고양이 지도",
    body: "어떤 아이가 어디서 사는지 지도 한 장에 모여요.\n마음에 드는 아이에게 응원 한 번이 가장 쉬운 첫 걸음이에요.",
  },
  {
    Icon: Heart,
    title: "돌봄에 필요한 도구",
    body: "밥·물·건강 한 줄 돌봄일지, AI집사 질문, 가까운 동물병원 찾기까지 한곳에.",
  },
  {
    Icon: ShieldCheck,
    title: "안전하게 돌보는 도구",
    body: "걱정되는 아이는 '내 서클·나만 보기'로 비공개 등록.\n응급 상황엔 단계별 보호 가이드가 도와줘요.",
  },
];
