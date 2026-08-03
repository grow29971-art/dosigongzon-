"use client";

// 야생냥이 포획 미니게임 — 냥줍 app/components/RoamCapture.tsx 이식 (2026-08-04 P2).
// AR 카메라 배경(거부돼도 그라데이션 폴백) + 캔 던지기(당겼다 놓기) + 타이밍 바.
// 성공 시 POST /api/catch/capture → catch_cards 카드를 받는다.
// 냥줍 대비 변경: 자랑하기(sharePolaroidImage)·원탭 입주(TakeHomeButton) 제거,
// "냥이 보러 가기"는 city 카드 보관함(/mypage/cards)으로. 완벽 포획은 등급 승급 20%.

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import ParticleCanvas, { type ParticleCanvasHandle } from "@/app/components/ParticleCanvas";
import SfxToggle from "@/app/components/SfxToggle";
import { sfx, primeSfx } from "@/lib/sfx";
import type { RoamCat } from "@/lib/catch/wild";
import { RARITY_LABEL, RARITY_COLOR, speciesPhotoUrl } from "@/lib/catch/spawn-species";
import { celebrateCatch } from "@/lib/catch/celebrate";
import { encodeGeohash } from "@/lib/catch/geohash";
import type { GradeKey } from "@/lib/cat-grade-rules";

import CatCard, { type CatCardData } from "@/app/components/CatCard";

export interface CapturedCard extends CatCardData {
  id: string;
  battle_atk: number | null;
  battle_def: number | null;
  battle_eva: number | null;
  battle_crit: number | null;
  is_shiny?: boolean | null;
  caught_at?: string | null;
}

interface Props {
  spawn: RoamCat;
  userPos: { lat: number; lng: number };
  onClose: () => void;
  /** 포획 성공이 서버에 기록된 뒤 호출 — 지도에서 해당 스폰을 지우는 용도 */
  onCaptured?: (card: CapturedCard) => void;
}

type CamState = "requesting" | "ready" | "nocam";
type ThrowState = "idle" | "pulling" | "flying" | "hit" | "miss";
type ResultState = null
  | { card: CapturedCard; isPerfect: boolean; wasUpgraded: boolean; quest: { title: string; reward: number } | null }
  | { error: string };

// 투척 튜닝값 (냥줍 2026-07-24 모바일 조작감 패치 반영: |dy| 인식·최소 당김 16px·투척 존 58%)
const MIN_PULL_Y = 16;
const MAX_PULL_Y = 150;
const MAX_DRAG_X = 130;

// 타이밍 바 튜닝값
const BAR_MIN = 6, BAR_MAX = 94;
const SWEET_WIDTH_MIN = 11, SWEET_WIDTH_MAX = 21;
const SWEEP_MS_BASE = 1050;
const TOTAL_TRIES = 3;

const MISS_REACTIONS = ["빗나갔다!", "아쉽다!", "타이밍이 살짝 빗나갔어요", "다시 한 번!", "조금만 더!"];

// "#3182F6" → "49,130,246" (ParticleCanvas 색 포맷)
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0).join(",");
}

function randomSweetSpot(widen: boolean) {
  const width = (SWEET_WIDTH_MIN + Math.random() * (SWEET_WIDTH_MAX - SWEET_WIDTH_MIN)) * (widen ? 1.6 : 1);
  const start = BAR_MIN + Math.random() * (BAR_MAX - BAR_MIN - width);
  const perfectMargin = width * 0.3;
  return { start, end: start + width, perfectStart: start + perfectMargin, perfectEnd: start + width - perfectMargin };
}

export default function WildCapture({ spawn, userPos, onClose, onCaptured }: Props) {
  const router = useRouter(); // 결과 화면 "냥이 보러 가기" — 획득→보관함 브리지
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const particleRef = useRef<ParticleCanvasHandle>(null);

  const [camState, setCamState] = useState<CamState>("requesting");
  const [caught, setCaught] = useState(false);
  const [perfectCatch, setPerfectCatch] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const [showRetry, setShowRetry] = useState(false);

  // ── 🎴 가챠급 카드 공개 시퀀스 — 뒷면 → 등급 글로우 빌드업 → 3D 플립 → 버스트 ──
  const [revealStage, setRevealStage] = useState<"charge" | "flip" | "done">("charge");
  const revealFiredRef = useRef(false);
  const finishReveal = useCallback(() => {
    if (revealFiredRef.current) return; // 플립 완료·스킵 탭 중복 발화 방지
    revealFiredRef.current = true;
    setRevealStage("done");
    if (result && "card" in result) {
      const shiny = result.card.is_shiny === true;
      const finalRarity = (result.card.card_rarity as string) ?? spawn.species.rarity;
      celebrateCatch(finalRarity, shiny);
      particleRef.current?.burst(0.5, 0.45, "shockwave", 1, "255,255,255");
      if (finalRarity === "legendary" || shiny) sfx.perfect();
      navigator.vibrate?.(finalRarity === "legendary" ? [60, 40, 60, 40, 140] : [30, 30, 80]);
    }
  }, [result, spawn.species.rarity]);

  // 카드 도착 → 빌드업 타이머 시작 (모션 축소 환경은 즉시 공개)
  useEffect(() => {
    if (!(result && "card" in result) || revealStage !== "charge") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { finishReveal(); return; }
    sfx.chargeUp();
    const chargeMs = spawn.species.rarity === "legendary" ? 2600
      : spawn.species.rarity === "rare" ? 2000 : 1400;
    const t = setTimeout(() => setRevealStage("flip"), chargeMs);
    // 빌드업 동안 등급색 스파크가 카드 주위로 — 기대감 연출
    const shiny = result.card.is_shiny === true;
    const rgb = shiny ? "255,200,80" : hexToRgb(RARITY_COLOR[spawn.species.rarity]);
    const iv = setInterval(() => {
      particleRef.current?.burst(0.38 + Math.random() * 0.24, 0.35 + Math.random() * 0.22, "spark", 3, rgb);
    }, 380);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [result, revealStage, spawn.species.rarity, finishReveal]);
  const [missReaction, setMissReaction] = useState("빗나갔다!");
  const [impactShake, setImpactShake] = useState<0 | 1 | 2 | 3>(0);
  const chargeSoundPlayedRef = useRef(false);

  // 투척 상태
  const [throwState, setThrowState] = useState<ThrowState>("idle");
  const [pullY, setPullY] = useState(0);
  const [churuX, setChuruX] = useState(0);
  const [landingDx, setLandingDx] = useState(0);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const missResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 타이밍 바
  const markerPosRef = useRef(BAR_MIN);
  const markerDirRef = useRef(1);
  const speedMultRef = useRef(1);
  const [markerPos, setMarkerPos] = useState(BAR_MIN);
  const [sweetSpot, setSweetSpot] = useState(() => randomSweetSpot(false));
  const attemptsLeftRef = useRef(TOTAL_TRIES);
  const [attemptsLeft, setAttemptsLeftState] = useState(TOTAL_TRIES);
  const roundsFailedRef = useRef(0);
  const throwStateRef = useRef<ThrowState>("idle");
  const sweepAnimRef = useRef<number>(0);

  const setAttemptsLeft = (v: number) => { attemptsLeftRef.current = v; setAttemptsLeftState(v); };

  // 카메라 시작 — 실패해도 게임은 계속 (AR 배경 → 그라데이션 배경 폴백)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamState("ready");
      } catch {
        if (!cancelled) setCamState("nocam");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (missResetTimeoutRef.current) clearTimeout(missResetTimeoutRef.current);
    };
  }, []);

  // camState가 ready로 바뀌면 보이는 <video>가 "새 DOM 노드"로 마운트된다 —
  // 스트림은 요청 중이던 숨김 video에 붙어 있었으므로 여기서 재부착해야 화면이 나온다.
  useEffect(() => {
    if (camState !== "ready" || !videoRef.current || !streamRef.current) return;
    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => { /* 자동재생 차단 등 — 폴백 배경으로 진행 */ });
    }
  }, [camState]);

  // 타이밍 바 구슬 애니메이션
  useEffect(() => { throwStateRef.current = throwState; }, [throwState]);

  useEffect(() => {
    if (caught) { cancelAnimationFrame(sweepAnimRef.current); return; }
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      const s = throwStateRef.current;
      if (s === "idle" || s === "pulling") {
        const sweepMs = Math.max(650, SWEEP_MS_BASE - roundsFailedRef.current * 60);
        const speed = ((BAR_MAX - BAR_MIN) / sweepMs) * speedMultRef.current;
        let pos = markerPosRef.current + markerDirRef.current * speed * dt;
        if (pos >= BAR_MAX) { pos = BAR_MAX; markerDirRef.current = -1; speedMultRef.current = 0.75 + Math.random() * 0.6; }
        if (pos <= BAR_MIN) { pos = BAR_MIN; markerDirRef.current = 1; speedMultRef.current = 0.75 + Math.random() * 0.6; }
        markerPosRef.current = pos;
        setMarkerPos(pos);
      }
      sweepAnimRef.current = requestAnimationFrame(loop);
    };
    sweepAnimRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(sweepAnimRef.current);
  }, [caught]);

  // 캔 던지는 궤적을 따라 스파크 잔상
  const emitThrowTrail = useCallback((dxTotal: number, dyTotal: number) => {
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      setTimeout(() => {
        const w = window.innerWidth, h = window.innerHeight;
        const x = 0.5 + (dxTotal * p) / w;
        const y = 0.83 + (dyTotal * p) / h;
        particleRef.current?.burst(x, y, "spark", 2, "49,130,246");
      }, p * 550);
    }
  }, []);

  // 포획 성공 → 서버 기록. 여기서부터는 되돌릴 수 없으므로 실패 시 에러 화면을 띄운다.
  const finishCapture = useCallback(async (isPerfect: boolean) => {
    setCaught(true);
    setShowRetry(false);
    const retryTimer = setTimeout(() => setShowRetry(true), 6000);
    setTimeout(() => {
      particleRef.current?.burst(0.5, 0.42, "star", isPerfect ? 26 : 14, isPerfect ? "49,130,246" : "255,255,255");
    }, 250);
    try {
      // 모바일 회선에서 응답이 안 오면 "생성 중"에 영원히 멈추는 문제 방지 — 15초 타임아웃
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch("/api/catch/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // [위치정보 불변식 — lib/geo.ts] 원시 좌표 대신 geohash7(≈150m 마스킹) 셀만 전송.
        // 정밀 100m 판정은 지도 페이지(하버사인)가 이미 완료.
        body: JSON.stringify({ roamId: spawn.id, gh7: encodeGeohash(userPos.lat, userPos.lng, 7), isPerfect }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timeout));
      // 504 HTML 등 JSON 아닌 응답 방어
      const data = await res.json().catch(() => ({} as { error?: string; card?: CapturedCard; was_upgraded?: boolean; quest?: { title: string; reward: number } | null }));
      if (!res.ok || !data.card) {
        setResult({ error: data.error ?? `포획 기록에 실패했어요. (오류 ${res.status}) 다시 시도해주세요.` });
        return;
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      setResult({ card: data.card as CapturedCard, isPerfect, wasUpgraded: data.was_upgraded === true, quest: data.quest ?? null });
      onCaptured?.(data.card as CapturedCard);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setResult({ error: aborted ? "서버 응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요!" : "네트워크 오류로 포획 기록에 실패했어요." });
    } finally {
      clearTimeout(retryTimer);
      setShowRetry(false);
    }
  }, [spawn.id, userPos.lat, userPos.lng, onCaptured]);

  // 포인터 이벤트 (터치+마우스+펜 공통)
  const handleTouchStart = useCallback((e: React.PointerEvent) => {
    if ((throwState !== "idle" && throwState !== "miss") || caught) return;
    if (missResetTimeoutRef.current) { clearTimeout(missResetTimeoutRef.current); missResetTimeoutRef.current = null; }
    primeSfx();
    chargeSoundPlayedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    touchStartRef.current = { x: e.clientX, y: e.clientY };
    setThrowState("idle");
    setPullY(0);
    setChuruX(0);
  }, [throwState, caught]);

  const handleTouchMove = useCallback((e: React.PointerEvent) => {
    if ((throwState !== "idle" && throwState !== "pulling") || caught) return;
    e.preventDefault();
    // 방향 불문 당김 크기 — 아래로 당기든(슬링샷) 위로 플릭하든 같은 조작
    const dy = Math.abs(touchStartRef.current.y - e.clientY);
    const dx = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, e.clientX - touchStartRef.current.x));
    if (dy > 2) {
      if (!chargeSoundPlayedRef.current) { chargeSoundPlayedRef.current = true; sfx.chargeUp(); }
      setThrowState("pulling");
      setPullY(Math.min(dy, MAX_PULL_Y));
      setChuruX(dx);
    }
  }, [throwState, caught]);

  const handleTouchEnd = useCallback((e: React.PointerEvent) => {
    if (caught) return;
    const dy = Math.abs(touchStartRef.current.y - e.clientY);
    const dx = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, e.clientX - touchStartRef.current.x));

    if (dy > MIN_PULL_Y) {
      const finalPos = markerPosRef.current;
      const isHit = finalPos >= sweetSpot.start && finalPos <= sweetSpot.end;
      const isPerfect = isHit && finalPos >= sweetSpot.perfectStart && finalPos <= sweetSpot.perfectEnd;
      setLandingDx(dx * 2.2);
      setThrowState("flying");
      sfx.throwCan();
      emitThrowTrail(dx * 2.2, -(window.innerHeight * 0.55));

      setTimeout(() => {
        if (isHit) {
          roundsFailedRef.current = 0;
          setPerfectCatch(isPerfect);
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(isPerfect ? [30, 40, 60] : 40);
          setThrowState("hit");
          setImpactShake(isPerfect ? 3 : 2);
          setTimeout(() => setImpactShake(0), isPerfect ? 700 : 450);
          const burstColor = isPerfect ? "49,130,246" : "255,255,255";
          particleRef.current?.burst(0.5, 0.38, "star", isPerfect ? 22 : 12, burstColor);
          particleRef.current?.burst(0.5, 0.38, "shockwave", 1, burstColor);
          if (isPerfect) particleRef.current?.burst(0.5, 0.38, "spark", 16, "49,130,246");
          sfx.catchHit();
          if (isPerfect) setTimeout(() => sfx.perfect(), 120);
          finishCapture(isPerfect);
        } else {
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
          const remaining = attemptsLeftRef.current - 1;
          if (remaining <= 0) {
            roundsFailedRef.current += 1;
            setAttemptsLeft(TOTAL_TRIES);
          } else {
            setAttemptsLeft(remaining);
          }
          setSweetSpot(randomSweetSpot(roundsFailedRef.current >= 2));
          setMissReaction(MISS_REACTIONS[Math.floor(Math.random() * MISS_REACTIONS.length)]);
          setThrowState("miss");
          setImpactShake(1);
          sfx.miss();
          particleRef.current?.burst(0.5, 0.55, "spark", 6, "180,180,180");
          setTimeout(() => setImpactShake(0), 350);
          missResetTimeoutRef.current = setTimeout(() => { setThrowState("idle"); setPullY(0); setChuruX(0); missResetTimeoutRef.current = null; }, 800);
        }
      }, 600);
    } else {
      setThrowState("idle");
      setPullY(0);
      setChuruX(0);
    }
  }, [caught, finishCapture, sweetSpot, emitThrowTrail]);

  const ready = camState !== "requesting";
  const rarityColor = RARITY_COLOR[spawn.species.rarity];
  // 결과 카드의 최종 등급 — 완벽 포획 승급(20%)으로 종 등급과 다를 수 있다
  const resultRarity: GradeKey = result && "card" in result && result.card.card_rarity
    ? (result.card.card_rarity as GradeKey) : spawn.species.rarity;

  const flyDx = throwState === "flying" || throwState === "hit" || throwState === "miss" ? landingDx : churuX * 2.2;
  const flyDy = -(typeof window !== "undefined" ? window.innerHeight * 0.55 : 400);
  const missFlyDx = flyDx + Math.sign(flyDx || 1) * 90;

  return (
    <>
      <style>{`
        @keyframes churu-fly-hit {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
          55%  { transform: translate(${flyDx * 0.6}px,${flyDy * 0.68}px) rotate(-460deg) scale(0.75); opacity:1; }
          85%  { transform: translate(${flyDx}px,${flyDy}px) rotate(-640deg) scale(0.48); opacity:1; }
          100% { transform: translate(${flyDx}px,${flyDy}px) rotate(-640deg) scale(0.2); opacity:0; }
        }
        @keyframes churu-fly-miss {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
          55%  { transform: translate(${missFlyDx * 0.55}px,${flyDy * 0.75}px) rotate(-420deg) scale(0.8); opacity:1; }
          100% { transform: translate(${missFlyDx}px,${flyDy * 0.92}px) rotate(-680deg) scale(0.55); opacity:0; }
        }
        @keyframes cat-flinch {
          0%   { transform: translateX(0) scale(1); filter:brightness(1); }
          20%  { transform: translateX(-10px) scale(1.03); filter:brightness(1.3); }
          45%  { transform: translateX(9px) scale(0.99); filter:brightness(1.1); }
          70%  { transform: translateX(-5px) scale(1.01); filter:brightness(1.05); }
          100% { transform: translateX(0) scale(1); filter:brightness(1); }
        }
        @keyframes cat-dodge {
          0%   { transform: translateX(0) rotate(0deg); }
          30%  { transform: translateX(${churuX > 0 ? -14 : 14}px) rotate(${churuX > 0 ? -3 : 3}deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes spawn-float {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-12px); }
        }
        @keyframes caught-flash {
          0%   { opacity:0; transform:scale(0.5); }
          50%  { opacity:1; transform:scale(1.2); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes stars-burst {
          0%   { opacity:1; transform:scale(0) rotate(0deg); }
          100% { opacity:0; transform:scale(2) rotate(45deg); }
        }
        @keyframes capture-ring {
          0%   { opacity:0.9; transform:scale(0.3); border-width:6px; }
          100% { opacity:0; transform:scale(2.6); border-width:1px; }
        }
        @keyframes pull-wiggle {
          0%,100% { transform: rotate(-5deg); }
          50%     { transform: rotate(5deg); }
        }
        @keyframes miss-text-pop {
          0%   { opacity:0; transform:translateY(6px) scale(0.85); }
          30%  { opacity:1; transform:translateY(0) scale(1.08); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes marker-glow {
          0%,100% { box-shadow: 0 0 8px 2px rgba(255,255,255,0.8); }
          50%     { box-shadow: 0 0 14px 5px rgba(255,255,255,0.95); }
        }
        @keyframes cam-shake-small {
          0%,100% { transform:translate(0,0); }
          25% { transform:translate(-3px,2px); }
          50% { transform:translate(3px,-2px); }
          75% { transform:translate(-2px,1px); }
        }
        @keyframes cam-shake-big {
          0%,100% { transform:translate(0,0) rotate(0deg); }
          15% { transform:translate(-6px,4px) rotate(-0.5deg); }
          30% { transform:translate(6px,-4px) rotate(0.5deg); }
          45% { transform:translate(-5px,3px); }
          60% { transform:translate(5px,-3px); }
          80% { transform:translate(-2px,1px); }
        }
        @keyframes flash-fade {
          0% { opacity:0; }
          15% { opacity:1; }
          100% { opacity:0; }
        }
        @keyframes sweet-pulse {
          0%,100% { filter:brightness(1); }
          50%     { filter:brightness(1.35); }
        }
        @keyframes charge-ring-pulse {
          0%,100% { opacity:0.55; transform:scale(1); }
          50%     { opacity:0.9; transform:scale(1.08); }
        }
        @keyframes result-card-in {
          0%   { opacity:0; transform:translateY(24px) scale(0.9); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes reveal-charge {
          0%,100% { transform:rotateY(0deg) scale(1); filter:brightness(1); }
          50%     { transform:rotateY(0deg) scale(1.045); filter:brightness(1.18); }
        }
        @keyframes reveal-flip {
          0%   { transform:rotateY(0deg) scale(1.05); }
          45%  { transform:rotateY(95deg) scale(1.12); }
          100% { transform:rotateY(180deg) scale(1); }
        }
        @keyframes reveal-aura {
          0%,100% { opacity:0.5; transform:scale(1); }
          50%     { opacity:0.95; transform:scale(1.12); }
        }
        @keyframes reveal-sheen {
          0%   { transform:translateX(-130%) skewX(-18deg); }
          100% { transform:translateX(230%) skewX(-18deg); }
        }
        @keyframes reveal-in {
          0%   { opacity:0; transform:scale(0.7); }
          100% { opacity:1; transform:scale(1); }
        }
      `}</style>

      {impactShake === 1 && (
        <div className="fixed inset-0 z-[350] pointer-events-none" style={{ background: "rgba(255,50,50,0.28)", animation: "flash-fade 0.35s ease-out" }} />
      )}
      {(impactShake === 2 || impactShake === 3) && (
        <div className="fixed inset-0 z-[350] pointer-events-none" style={{
          background: impactShake === 3
            ? "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(49,130,246,0.32) 45%, transparent 75%)"
            : "radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, transparent 70%)",
          animation: "flash-fade 0.4s ease-out",
        }} />
      )}

      <div className="fixed inset-0 z-[300] bg-black flex flex-col overflow-hidden select-none"
        style={{
          animation: impactShake === 3 ? "cam-shake-big 0.6s ease" : impactShake === 2 ? "cam-shake-big 0.4s ease" : impactShake === 1 ? "cam-shake-small 0.3s ease" : undefined,
        }}
      >
        <ParticleCanvas ref={particleRef} zIndex={22} />

        {/* 닫기 */}
        <button
          onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <X size={20} color="white" />
        </button>
        <SfxToggle style={{ position: "absolute", top: 16, right: 62, zIndex: 30 }} />

        {/* GO식 상단 이름 필 */}
        {ready && !caught && (
          <>
            <div className="absolute top-5 left-0 right-0 flex justify-center z-20 pointer-events-none">
              <div className="flex items-center gap-2 rounded-full"
                style={{ padding: "8px 26px", background: "rgba(20,26,34,0.55)", backdropFilter: "blur(4px)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)" }}>
                <span className="text-[15px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                  {spawn.species.name}
                </span>
                <span className="text-[13px] font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>/</span>
                <span className="text-[13px] font-black" style={{ color: rarityColor }}>
                  {RARITY_LABEL[spawn.species.rarity]}
                </span>
              </div>
            </div>
            {/* 하단 중앙 캔 카운트 */}
            <div className="absolute bottom-9 left-0 right-0 flex justify-center z-20 pointer-events-none">
              <span className="text-[13px] font-black text-white/85" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                🥫 × {attemptsLeft}
              </span>
            </div>
          </>
        )}

        {/* 배경 — 카메라 or 그라데이션 폴백 */}
        <div className="absolute inset-0">
          {camState === "ready" ? (
            <video ref={videoRef} playsInline muted
              className="w-full h-full object-cover"
              style={{ opacity: caught ? 0.55 : 1, filter: caught ? "blur(7px) brightness(0.55)" : "none", transition: "opacity 0.6s, filter 0.6s" }} />
          ) : (
            <div className="w-full h-full"
              style={{
                background: "linear-gradient(180deg, #1a2028 0%, #232b37 45%, #2c3542 100%)",
                opacity: caught ? 0.55 : 1, filter: caught ? "blur(7px) brightness(0.55)" : "none", transition: "opacity 0.6s, filter 0.6s",
              }} />
          )}
          {/* 카메라 준비 전엔 비디오 태그를 미리 붙여둔다 (play() 대상 확보) */}
          {camState === "requesting" && <video ref={videoRef} playsInline muted className="hidden" />}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)" }} />
        </div>

        {/* 스폰 고양이 (AR 오브젝트) */}
        {!caught && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            style={{ paddingBottom: "20%" }}>
            <div style={{
              animation: throwState === "hit" ? "cat-flinch 0.5s ease" : throwState === "miss" ? "cat-dodge 0.4s ease" : "spawn-float 2.6s ease-in-out infinite",
            }}>
              {/* 희귀도 글로우 */}
              <div className="relative flex flex-col items-center">
                <div className="absolute rounded-full" style={{
                  width: 170, height: 170, top: -20,
                  background: `radial-gradient(circle, ${rarityColor}55 0%, transparent 70%)`,
                }} />
                <span style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.5))" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={speciesPhotoUrl(spawn.speciesKey)} alt={spawn.species.name}
                    style={{ width: 150, height: 150, borderRadius: "50%", objectFit: "cover", border: `4px solid ${rarityColor}`, boxShadow: `0 0 24px ${rarityColor}` }} />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 타이밍 바 */}
        {ready && !caught && (
          <div className="absolute left-0 right-0 z-20 px-6" style={{ top: "13%" }}>
            <p className="text-center text-[11.5px] font-extrabold text-white/85 mb-1.5" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
              {throwState === "miss" ? "⚠️ 타이밍이 안 맞았어요!" : "가운데 하얀 구간에 맞추면 완벽 포획!"}
            </p>
            <div className="relative w-full" style={{ height: 16, borderRadius: 99, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.08)" }}>
              <div className="absolute top-0 bottom-0" style={{
                left: `${sweetSpot.start}%`, width: `${sweetSpot.end - sweetSpot.start}%`,
                background: "linear-gradient(90deg, rgba(49,130,246,0.45), rgba(49,130,246,0.8))",
                borderRadius: 99,
                animation: "sweet-pulse 0.9s ease-in-out infinite",
              }} />
              <div className="absolute top-0 bottom-0" style={{
                left: `${sweetSpot.perfectStart}%`, width: `${sweetSpot.perfectEnd - sweetSpot.perfectStart}%`,
                background: "rgba(255,255,255,0.85)",
                borderRadius: 99,
                boxShadow: "0 0 10px 2px rgba(255,255,255,0.6)",
                animation: "sweet-pulse 0.9s ease-in-out infinite",
              }} />
              <div className="absolute" style={{
                top: -3, left: `${markerPos}%`, width: 22, height: 22, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #FFFFFF, #D1D6DB 55%, #8B95A1 100%)",
                transform: "translateX(-50%)",
                animation: (throwState === "idle" || throwState === "pulling") ? "marker-glow 0.5s ease-in-out infinite" : undefined,
                transition: "top 0.15s",
              }} />
            </div>
          </div>
        )}

        {/* 명중/미스/포획 연출 */}
        <div className="absolute inset-0 flex flex-col items-center justify-between pb-14 pt-16 z-10 pointer-events-none">
          <div className="flex-1 flex items-center justify-center w-full relative">
            {throwState === "hit" && (
              <>
                <div className="absolute" style={{
                  width: 100, height: 100, borderRadius: "50%",
                  border: "6px solid rgba(49,130,246,0.9)",
                  animation: "capture-ring 0.6s ease-out forwards",
                }} />
                {["✦", "★", "✦", "★", "✦"].map((s, i) => (
                  <span key={i} className="absolute text-white text-[24px] font-black pointer-events-none"
                    style={{
                      left: `${35 + i * 8}%`, top: `${30 + (i % 2) * 10}%`,
                      animation: `stars-burst 0.6s ease-out ${i * 0.06}s forwards`,
                    }}>
                    {s}
                  </span>
                ))}
              </>
            )}

            {/* 포획 완료 → 결과 대기/카드 표시 */}
            {caught && !result && (
              <div className="text-center relative" style={{ animation: "caught-flash 0.5s ease-out" }}>
                {(perfectCatch ? ["✦", "★", "✦", "★", "✦", "★", "✦", "★"] : ["✦", "★", "✦", "★", "✦", "★"]).map((s, i) => (
                  <span key={i} className={perfectCatch ? "absolute text-white text-[26px] font-black pointer-events-none" : "absolute text-white text-[20px] font-black pointer-events-none"}
                    style={{
                      left: `${-40 + i * (perfectCatch ? 20 : 26)}%`, top: `${-70 + (i % 2) * 130}%`,
                      animation: `stars-burst 0.9s ease-out ${i * 0.1}s infinite`,
                    }}>
                    {s}
                  </span>
                ))}
                {perfectCatch && (
                  <p className="text-[18px] font-black mb-1" style={{ color: "#4593FC", animation: "miss-text-pop 0.3s ease-out forwards" }}>✨ 완벽 포획! ✨</p>
                )}
                <p className="text-white text-[42px] font-black drop-shadow-lg leading-none">포획 성공!</p>
                <p className="text-white/80 text-[16px] font-bold mt-2">🐱 고양이 카드 생성 중...</p>
                {showRetry && (
                  <button onClick={() => { setShowRetry(false); finishCapture(perfectCatch); }}
                    className="mt-5 px-6 py-2.5 rounded-2xl text-[13px] font-black text-white pointer-events-auto"
                    style={{ background: "#3182F6", animation: "result-card-in 0.3s ease" }}>
                    응답이 늦어요 — 다시 시도
                  </button>
                )}
              </div>
            )}

            {throwState === "miss" && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center"
                style={{ animation: "miss-text-pop 0.35s ease-out forwards" }}>
                <p className="text-red-400 text-[28px] font-black">{missReaction}</p>
              </div>
            )}
          </div>
        </div>

        {/* 🎴 카드 공개 시퀀스 — 뒷면 빌드업 → 3D 플립 (탭하면 스킵) */}
        {result && "card" in result && revealStage !== "done" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center"
            style={{ background: "rgba(0,0,0,0.78)", cursor: "pointer" }}
            onClick={finishReveal}>
            {/* 등급색 오라 — 빌드업 동안 숨쉬듯 커진다 */}
            <div className="absolute pointer-events-none" style={{
              width: 320, height: 400, borderRadius: "50%",
              background: `radial-gradient(ellipse, ${rarityColor}${spawn.species.rarity === "legendary" ? "66" : "44"} 0%, transparent 68%)`,
              animation: "reveal-aura 1.1s ease-in-out infinite",
            }} />
            <div style={{ perspective: 1000, animation: "reveal-in 0.35s ease-out" }}>
              <div
                onAnimationEnd={e => { if ((e.animationName as string) === "reveal-flip") finishReveal(); }}
                style={{
                  position: "relative", width: 190, transformStyle: "preserve-3d",
                  animation: revealStage === "flip"
                    ? "reveal-flip 0.75s cubic-bezier(0.45,0,0.2,1) forwards"
                    : "reveal-charge 1.1s ease-in-out infinite",
                }}>
                {/* 앞면 — 실제 카드 (컨테이너가 180° 돌면 정면이 된다) */}
                <div style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}>
                  <CatCard
                    name={result.card.card_name ?? spawn.species.name}
                    photoUrl={speciesPhotoUrl(spawn.speciesKey)}
                    card={result.card}
                    size="md"
                  />
                </div>
                {/* 뒷면 — 모노 카드백 (에셋 0: CSS+SVG 발바닥) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
                  style={{
                    backfaceVisibility: "hidden", borderRadius: 16,
                    background: "linear-gradient(150deg, #232B37 0%, #191F28 55%, #232B37 100%)",
                    boxShadow: `inset 0 0 0 3px ${rarityColor}AA, inset 0 0 0 7px rgba(255,255,255,0.06), 0 0 26px ${rarityColor}77`,
                  }}>
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 14px)",
                  }} />
                  <svg width="64" height="58" viewBox="0 0 64 58" fill="none" aria-hidden>
                    <ellipse cx="32" cy="40" rx="14" ry="12" fill="rgba(255,255,255,0.85)"/>
                    <circle cx="14" cy="24" r="6.5" fill="rgba(255,255,255,0.85)"/>
                    <circle cx="26" cy="14" r="6.5" fill="rgba(255,255,255,0.85)"/>
                    <circle cx="38" cy="14" r="6.5" fill="rgba(255,255,255,0.85)"/>
                    <circle cx="50" cy="24" r="6.5" fill="rgba(255,255,255,0.85)"/>
                  </svg>
                  <p className="text-[13px] font-black mt-2" style={{ color: "rgba(255,255,255,0.85)", letterSpacing: 2 }}>야생냥이</p>
                  {/* 지나가는 광택 — 빌드업 동안만 */}
                  <div className="absolute inset-y-0 pointer-events-none" style={{
                    width: "36%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
                    animation: "reveal-sheen 1.5s ease-in-out infinite",
                  }} />
                </div>
              </div>
            </div>
            <p className="mt-6 text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>
              {revealStage === "charge" ? "탭하면 바로 공개" : ""}
            </p>
          </div>
        )}

        {/* 결과 카드 / 에러 */}
        {result && ("error" in result || revealStage === "done") && (
          <div className="absolute inset-0 z-40 flex items-center justify-center px-8"
            style={{ background: "rgba(0,0,0,0.55)" }}>
            {"error" in result ? (
              <div className="text-center" style={{ animation: "result-card-in 0.35s ease-out" }}>
                <p className="text-[44px] mb-3">😿</p>
                <p className="text-white text-[16px] font-bold mb-6">{result.error}</p>
                <button onClick={onClose}
                  className="px-6 py-3 rounded-2xl font-bold text-[15px]"
                  style={{ background: "rgba(255,255,255,0.12)", color: "white" }}>
                  지도로 돌아가기
                </button>
              </div>
            ) : (
              <div className="w-full max-w-[320px] flex flex-col items-center"
                style={{ animation: "result-card-in 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
                <p className="text-white text-[19px] font-black mb-1">🎉 새 카드 획득!</p>
                {result.isPerfect && (
                  <p className="text-[12.5px] font-black mb-2" style={{ color: "#4593FC" }}>
                    {result.wasUpgraded
                      ? `✨ 완벽 포획 — ${RARITY_LABEL[resultRarity]} 등급으로 승급! ✨`
                      : "✨ 완벽 포획 보너스 EXP +20 ✨"}
                  </p>
                )}
                {/* 주간 의뢰 완료 배지 — capture 응답 quest 필드 (P5) */}
                {result.quest && (
                  <p className="px-3 py-1.5 rounded-full text-[12px] font-black mb-2"
                    style={{ background: "rgba(255,193,94,0.18)", color: "#FFC15E", boxShadow: "inset 0 0 0 1.5px rgba(255,193,94,0.55)", animation: "result-card-in 0.4s ease 0.2s backwards" }}>
                    📜 의뢰 완료 「{result.quest.title}」 +{result.quest.reward}코인
                  </p>
                )}
                {/* 진짜 트레이딩 카드로 결과 표시 */}
                <div className="my-3" style={{ filter: `drop-shadow(0 0 22px ${RARITY_COLOR[resultRarity]}88)` }}>
                  <CatCard
                    name={result.card.card_name ?? spawn.species.name}
                    photoUrl={speciesPhotoUrl(spawn.speciesKey)}
                    card={result.card}
                    size="md"
                  />
                </div>
                <p className="text-[11.5px] font-bold mb-4" style={{ color: RARITY_COLOR[resultRarity] }}>
                  {RARITY_LABEL[resultRarity]} · {spawn.species.category}
                </p>
                {/* 획득→보관함 브리지 — 방금 잡은 냥이를 카드 보관함에서 확인 */}
                <button onClick={() => router.push("/mypage/cards")}
                  className="w-full py-3 rounded-2xl font-black text-[13.5px] mb-2 text-white"
                  style={{ background: "rgba(255,255,255,0.10)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.35)" }}>
                  🐾 냥이 보러 가기
                </button>
                <button onClick={onClose}
                  className="w-full py-3.5 rounded-2xl font-black text-[15px] text-white"
                  style={{ background: "#3182F6" }}>
                  지도로 돌아가기
                </button>
              </div>
            )}
          </div>
        )}

        {/* 고양이 캔 투척 존 (하단) */}
        {ready && !caught && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center"
            style={{ height: "58%", touchAction: "none", overscrollBehavior: "none", userSelect: "none", WebkitUserSelect: "none" }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={handleTouchStart}
            onPointerMove={handleTouchMove}
            onPointerUp={handleTouchEnd}
            onPointerCancel={handleTouchEnd}
          >
            {(throwState === "flying" || throwState === "miss") && [0, 1].map(i => (
              <div key={i} className="absolute bottom-10 rounded-full pointer-events-none"
                style={{
                  width: 24, height: 24, marginBottom: 4,
                  background: "radial-gradient(circle, rgba(49,130,246,0.55) 0%, transparent 70%)",
                  filter: `blur(${2 + i * 1.5}px)`,
                  opacity: 0.5 - i * 0.18,
                  animation: `${throwState === "flying" ? "churu-fly-hit" : "churu-fly-miss"} 0.6s cubic-bezier(0.25,0.65,0.35,1) ${70 + i * 70}ms forwards`,
                }} />
            ))}

            <div className="absolute bottom-10 flex flex-col items-center gap-1 pointer-events-none"
              style={{
                transform: throwState === "pulling"
                  ? `translateY(${pullY * 0.55}px) translateX(${churuX}px) scaleY(${1 + pullY / 300}) scaleX(${1 - pullY / 900}) rotate(${-churuX * 0.15}deg)`
                  : "none",
                transition: throwState === "idle" ? "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)" : "none",
                animation: throwState === "flying"
                  ? "churu-fly-hit 0.6s cubic-bezier(0.25,0.65,0.35,1) forwards"
                  : throwState === "miss"
                    ? "churu-fly-miss 0.6s cubic-bezier(0.25,0.65,0.35,1) forwards"
                    : throwState === "idle"
                      ? "pull-wiggle 2s ease-in-out infinite"
                      : "none",
              }}
            >
              {throwState === "pulling" && pullY > 8 && (
                <div className="absolute rounded-full pointer-events-none" style={{
                  width: 60 + (pullY / MAX_PULL_Y) * 40,
                  height: 60 + (pullY / MAX_PULL_Y) * 40,
                  top: -8, left: "50%", transform: "translateX(-50%)",
                  background: `radial-gradient(circle, rgba(49,130,246,${0.15 + (pullY / MAX_PULL_Y) * 0.35}) 0%, transparent 70%)`,
                  animation: "charge-ring-pulse 0.5s ease-in-out infinite",
                }} />
              )}
              <div className="relative flex flex-col items-center"
                style={{ filter: `drop-shadow(0 3px ${6 + pullY / 15}px rgba(0,0,0,0.45))` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/catch/capture-can.png"
                  alt=""
                  draggable={false}
                  width={150}
                  height={86}
                  style={{ width: 150, height: "auto", userSelect: "none", pointerEvents: "none" }}
                />
                <div style={{ width: 80, height: 8, marginTop: -3, borderRadius: "50%", background: "rgba(0,0,0,0.22)" }} />
              </div>
            </div>

            {throwState === "idle" && (
              <div className="absolute bottom-1 text-center pointer-events-none">
                <p className="text-[11px] font-bold text-white/60">화면 아무 데나 잡고 아래로 쭉 당겼다 놓으면 던져요!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
