"use client";

// 커뮤니티 — 국회 국민동의청원 중 길고양이 관련 청원 목록.
// /api/petitions(1시간 캐시)에서 가져와 표시. 찬반 구분 없이 전부 노출(중립).
// 동의는 국회 사이트에서 본인인증으로만 가능 — 앱은 링크 안내만 한다(2026-07-22 회의).
//
// 2026-07-23 개편: 커뮤니티 최상단 이동 + 전체 접이식(4에이전트 합의안).
// - 기본 접힘 — 반대 진영 청원이 첫 화면 첫 카드가 되는 리스크의 완충재.
// - 접힘 바는 fetch 전부터 고정 높이로 렌더 — 최상단에서 늦게 나타나며
//   카테고리(긴급 제보 행)를 밀어내는 레이아웃 시프트 방지.
// - D-3 이내 마감 청원이 있으면 자동 펼침. 단 유저가 한 번이라도 직접
//   접거나 펼치면 그 선택(localStorage)을 항상 우선한다.

import { useEffect, useState } from "react";
import { Landmark, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { CatPetition, ClosedPetition } from "@/app/api/petitions/route";
import { logFunnelEvent } from "@/lib/funnel-repo";

// 유저가 직접 토글한 결과만 저장 ("1" 펼침 / "0" 접힘). 없으면 기본 접힘.
const OPEN_PREF_KEY = "dosi_petition_open_v1";

// #6B7FA3(그래픽용)은 흰 배경 11~12px 텍스트에서 대비 4.5:1 미달 — 텍스트는 한 단계 어둡게.
const CIVIC = "#6B7FA3";
const CIVIC_TEXT = "#56688A";

function ddayNum(endDate: string): number | null {
  const end = new Date(`${endDate}T23:59:59+09:00`).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

function ddayLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "마감";
  if (days === 0) return "오늘 마감";
  return `D-${days}`;
}

export default function CatPetitionSection() {
  const [petitions, setPetitions] = useState<CatPetition[]>([]);
  const [closed, setClosed] = useState<ClosedPetition[]>([]);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  // 한 번도 토글한 적 없는 유저에게만 "탭해서 보기" 힌트 — 접이식인 걸 모르는 문제 해결
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    fetch("/api/petitions")
      .then((r) => r.json())
      .then((d) => {
        const list: CatPetition[] = Array.isArray(d?.petitions) ? d.petitions : [];
        setPetitions(list);
        if (Array.isArray(d?.closed)) setClosed(d.closed);

        // 유저가 직접 토글한 적 없으면: D-3 이내 마감 임박 청원 존재 시 자동 펼침
        let pref: string | null = null;
        try { pref = localStorage.getItem(OPEN_PREF_KEY); } catch {}
        if (pref === "1") {
          setOpen(true);
        } else if (pref === null) {
          setShowHint(true);
          const urgent = list.some((p) => {
            const days = ddayNum(p.endDate);
            return days !== null && days >= 0 && days <= 3;
          });
          if (urgent) setOpen(true);
        }
      })
      .catch(() => setFailed(true)); // 국회 API 장애 — 섹션 숨김
  }, []);

  const loaded = petitions.length > 0 || closed.length > 0;
  if (failed || (loaded && petitions.length === 0 && closed.length === 0)) return null;

  const minDday = petitions.reduce<number | null>((min, p) => {
    const days = ddayNum(p.endDate);
    if (days === null || days < 0) return min;
    return min === null || days < min ? days : min;
  }, null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setShowHint(false);
    try { localStorage.setItem(OPEN_PREF_KEY, next ? "1" : "0"); } catch {}
    if (next) logFunnelEvent("petition_expand");
  };

  return (
    <div className="mb-4">
      {/* ── 접힘 바 (56px 고정 — 데이터 도착 전에도 렌더해 레이아웃 시프트 방지) ── */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="petition-body"
        className="w-full flex items-center gap-2.5 px-4 min-h-[56px] active:scale-[0.99] transition-transform"
        style={{
          background: "#FFFFFF",
          borderRadius: "var(--radius-card-sm)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(107,127,163,0.12)" }}
        >
          <Landmark size={16} color={CIVIC} />
        </span>
        <span className="text-[14px] font-bold text-text-main">국회 길고양이 청원</span>
        {petitions.length > 0 && (
          <span
            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0"
            style={{ background: "rgba(107,127,163,0.14)", color: CIVIC_TEXT }}
          >
            진행중 {petitions.length}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {minDday !== null && (
            <span className="text-[11px] font-bold" style={{ color: CIVIC_TEXT }}>
              {ddayLabel(minDday)}
            </span>
          )}
          {showHint && !open && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(107,127,163,0.1)", color: CIVIC_TEXT }}
            >
              탭해서 보기
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-text-light motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* ── 펼침 본문 ── */}
      {open && (
        <div id="petition-body" className="mt-2">
          <p className="text-[11px] text-text-light mb-2.5 px-1 leading-relaxed">
            국민동의청원에서 동의 진행 중인 청원이에요(찬반 모두 표시, 마감 임박순).
            동의는 국회 사이트에서 본인인증 후 가능해요.
          </p>

          <div className="space-y-2.5">
            {petitions.map((p) => {
              const pct = Math.min(100, Math.round((p.agreeCount / p.goal) * 100));
              return (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logFunnelEvent("petition_click")}
                  className="block active:scale-[0.99] transition-transform"
                >
                  <div
                    className="px-4 py-3.5"
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "var(--radius-card-sm)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-[13px] font-bold text-text-main leading-snug">
                        {p.title}
                      </p>
                      <ExternalLink size={13} className="shrink-0 mt-0.5 text-text-light" />
                    </div>

                    <div
                      className="mt-2.5 h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(0,0,0,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, #8B9DC3 0%, #6B7FA3 100%)",
                        }}
                      />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-text-sub">
                        <b className="text-text-main">{p.agreeCount.toLocaleString()}</b>
                        {" / "}
                        {p.goal.toLocaleString()}명 동의 ({pct}%)
                        {p.agreeCount >= p.goal && (
                          <span
                            className="ml-1.5 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(91,168,118,0.14)", color: "#3E8A5C" }}
                          >
                            성립 요건 달성
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: CIVIC_TEXT }}>
                        {ddayLabel(ddayNum(p.endDate))}
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          {/* 종료된 청원 아카이브 (2020~) — 동의수 확정, 접이식 */}
          {closed.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-bold active:scale-[0.99] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  borderRadius: "var(--radius-card-sm)",
                  border: "1px solid rgba(0,0,0,0.05)",
                  color: CIVIC_TEXT,
                }}
              >
                지난 청원 {closed.length}건 {showClosed ? "접기" : "보기"}
                {showClosed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showClosed && (
                <div
                  className="mt-2 px-4 py-1"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "var(--radius-card-sm)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  {closed.map((p, idx) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 py-2.5"
                      style={
                        idx < closed.length - 1
                          ? { borderBottom: "1px solid var(--color-divider)" }
                          : undefined
                      }
                    >
                      <span
                        className="shrink-0 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md"
                        style={
                          p.status === "established"
                            ? { background: "rgba(91,168,118,0.14)", color: "#3E8A5C" }
                            : { background: "rgba(0,0,0,0.05)", color: "rgba(60,46,35,0.45)" }
                        }
                      >
                        {p.status === "established" ? "성립" : "종료"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-text-main truncate">{p.title}</p>
                        <p className="text-[10px] text-text-light mt-0.5">
                          {p.agreeCount.toLocaleString()}명 동의 · {p.endDate} 마감
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
