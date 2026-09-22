// 동네 돌봄 실험 — 참여자 대시보드
// 핵심 행동은 '오늘 돌봄 완료' 하나. 경쟁 순위 없이 지역 공동 성과만 보여준다.
// 데이터는 전부 서버 API 경유 (다른 참여자의 개별 기록·신원은 내려오지 않음).

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Check, Share2, Sprout, CalendarDays, RefreshCw, CloudOff } from "lucide-react";
import {
  EXPERIMENT_ACTIVITY_MAP, EXPERIMENT_ACTIVITY_TYPES,
  type ExperimentActivityType, type ExperimentSummary,
} from "@/lib/experiments-repo";

type LoadState =
  | { phase: "loading" }
  | { phase: "login" }
  | { phase: "none" }
  | { phase: "error" }
  | { phase: "ready"; summary: ExperimentSummary };

export default function ExperimentPage() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [saving, setSaving] = useState<ExperimentActivityType | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [failedType, setFailedType] = useState<ExperimentActivityType | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/experiment/summary");
      if (res.status === 401) return setState({ phase: "login" });
      if (!res.ok) return setState({ phase: "error" });
      const data = await res.json();
      if (!data.experiment) return setState({ phase: "none" });
      setState({ phase: "ready", summary: data as ExperimentSummary });
    } catch {
      setState({ phase: "error" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const recordCare = async (type: ExperimentActivityType) => {
    if (state.phase !== "ready" || saving) return;
    const exp = state.summary.experiment;
    setSaving(type);
    setNotice(null);
    setFailedType(null);
    // 계측: 시도 시작 (실패해도 본 흐름 무관)
    fetch("/api/experiment/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ experimentId: exp.id, event: "care_log_started" }),
    }).catch(() => {});
    try {
      const res = await fetch("/api/experiment/care-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experimentId: exp.id, activityType: type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: "err", text: data.message ?? data.error ?? "저장에 실패했어요. 다시 시도해 주세요." });
        setFailedType(type);
        return;
      }
      setNotice(
        data.already
          ? { kind: "ok", text: "오늘 이 활동은 이미 기록되어 있어요" }
          : { kind: "ok", text: `${EXPERIMENT_ACTIVITY_MAP[type].label} 기록 완료. 오늘도 고생하셨어요.` },
      );
      await load();
    } catch {
      // 오프라인/네트워크 실패 — 재시도 버튼 노출
      setNotice({ kind: "err", text: "연결이 불안정해요. 네트워크 확인 후 다시 시도해 주세요." });
      setFailedType(type);
      if (state.phase === "ready") {
        fetch("/api/experiment/event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ experimentId: exp.id, event: "care_log_failed" }),
        }).catch(() => {});
      }
    } finally {
      setSaving(null);
    }
  };

  const createInvite = async () => {
    if (state.phase !== "ready" || inviteBusy) return;
    setInviteBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/experiment/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experimentId: state.summary.experiment.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: "err", text: data.error ?? "초대 링크 생성에 실패했어요." });
        return;
      }
      const shareText = `${data.copy}\n${data.url}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "도시공존 돌봄 기록 실험", text: data.copy, url: data.url });
          setNotice({ kind: "ok", text: "초대 링크를 공유했어요." });
          return;
        } catch { /* 사용자가 공유를 취소 — 클립보드로 폴백 */ }
      }
      await navigator.clipboard.writeText(shareText);
      setNotice({ kind: "ok", text: "초대 문구와 링크를 복사했어요. 카카오톡 등에 붙여넣어 주세요." });
    } catch {
      setNotice({ kind: "err", text: "초대 링크 생성에 실패했어요. 다시 시도해 주세요." });
    } finally {
      setInviteBusy(false);
    }
  };

  // ── 로딩 / 로그인 / 미참여 / 오류 상태 ──
  if (state.phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-[15px]" style={{ color: "var(--color-text-light)" }}>불러오는 중이에요…</p>
      </div>
    );
  }
  if (state.phase === "login") {
    return (
      <EmptyShell title="동네 돌봄 실험" icon={<Sprout size={36} strokeWidth={1.5} />}>
        <p>로그인하면 우리 동네 돌봄 기록 실험에 참여할 수 있어요.</p>
        <Link
          href="/login?next=/experiment"
          className="inline-flex items-center mt-4 px-6 h-12 rounded-lg text-[15px] font-semibold press"
          style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
        >
          로그인하기
        </Link>
      </EmptyShell>
    );
  }
  if (state.phase === "none") {
    return (
      <EmptyShell title="동네 돌봄 실험" icon={<Sprout size={36} strokeWidth={1.5} />}>
        <p>아직 참여 중인 실험이 없어요.</p>
        <p className="mt-1">이웃 돌봄자의 초대 링크로 참여할 수 있어요.</p>
      </EmptyShell>
    );
  }
  if (state.phase === "error") {
    return (
      <EmptyShell title="동네 돌봄 실험" icon={<CloudOff size={36} strokeWidth={1.5} />}>
        <p>정보를 불러오지 못했어요.</p>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 mt-4 px-6 h-12 rounded-lg text-[15px] font-semibold press"
          style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
        >
          <RefreshCw size={16} /> 다시 시도
        </button>
      </EmptyShell>
    );
  }

  const { experiment, area, me } = state.summary;
  const ended = experiment.status === "ended" || experiment.daysLeft < 0;
  const beforeStart = !experiment.isOpenToday && !ended;

  return (
    <div className="px-5 pt-6 pb-10 max-w-lg mx-auto">
      {/* 헤더 */}
      <header className="mb-5">
        <p className="text-[13px] font-medium text-text-light">
          동네 돌봄 실험
        </p>
        <h1 className="text-[24px] font-bold mt-0.5 text-text-main">
          {experiment.publicAreaName} 돌봄 기록
        </h1>
        <p className="text-[13px] mt-1 flex items-center gap-1.5" style={{ color: "var(--color-text-light)" }}>
          <CalendarDays size={14} />
          {experiment.startsAt} ~ {experiment.endsAt}
          {!ended && experiment.daysLeft >= 0 && ` · ${experiment.daysLeft === 0 ? "오늘까지" : `${experiment.daysLeft}일 남음`}`}
        </p>
      </header>

      {/* 상태 배너 */}
      {ended && (
        <Banner text="이 실험은 마무리됐어요. 2주 동안 함께해 주셔서 고마워요." />
      )}
      {beforeStart && (
        <Banner text={`실험은 ${experiment.startsAt}부터 시작돼요.`} />
      )}

      {/* 오늘 돌봄 완료 */}
      <section
        aria-labelledby="today-care-heading"
        className="card p-5 mb-4"
      >
        <h2 id="today-care-heading" className="text-[17px] font-bold mb-1 text-text-main">
          오늘 돌봄 완료
        </h2>
        <p className="text-[13px] mb-4 text-text-sub">
          오늘 하신 활동을 눌러 주세요.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {EXPERIMENT_ACTIVITY_TYPES.map((type) => {
            const meta = EXPERIMENT_ACTIVITY_MAP[type];
            const done = me.todayTypes.includes(type);
            const busy = saving === type;
            const disabled = !experiment.isOpenToday || saving !== null;
            return (
              <button
                key={type}
                onClick={() => recordCare(type)}
                disabled={disabled}
                aria-pressed={done}
                aria-label={`${meta.label} ${done ? "기록됨" : "기록하기"}`}
                className="flex items-center justify-center gap-2 rounded-lg px-3 font-semibold text-[15px] press-strong transition-transform disabled:opacity-60"
                style={{
                  minHeight: 56,
                  background: done ? "var(--color-primary)" : "var(--color-surface)",
                  color: done ? "var(--color-surface)" : "var(--color-text-main)",
                  border: done ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                }}
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                {meta.label}
                {done && !busy && <Check size={16} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>

        {notice && (
          <p
            role="status"
            className="mt-3 text-[13px] font-semibold px-1 py-2"
            style={{
              borderTop: "1px solid var(--color-divider)",
              color: notice.kind === "ok" ? "var(--color-sage)" : "var(--color-error)",
            }}
          >
            {notice.text}
          </p>
        )}
        {failedType && (
          <button
            onClick={() => recordCare(failedType)}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 h-9 rounded-lg press"
            style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
          >
            <RefreshCw size={14} /> 다시 시도
          </button>
        )}
      </section>

      {/* 지역 공동 성과 */}
      <section
        aria-labelledby="area-heading"
        className="card p-5 mb-4"
      >
        <h2 id="area-heading" className="text-[15px] font-semibold mb-3 flex items-center gap-1.5 text-text-main">
          <Sprout size={16} className="text-text-light" /> 이번 주 {experiment.publicAreaName}
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[24px] font-bold leading-tight text-text-main">{area.weekLogCount}</p>
            <p className="text-[13px] text-text-sub mt-0.5">돌봄 완료</p>
          </div>
          <div>
            <p className="text-[24px] font-bold leading-tight text-text-main">{area.weekCarerCount}</p>
            <p className="text-[13px] text-text-sub mt-0.5">함께한 돌봄자</p>
          </div>
          <div>
            <p className="text-[24px] font-bold leading-tight text-text-main">{area.streakDays}</p>
            <p className="text-[13px] text-text-sub mt-0.5">연속 기록일</p>
          </div>
        </div>
        <p className="text-[13px] text-text-light mt-3">
          {area.weekLogCount === 0
            ? "이번 주 첫 기록을 기다리고 있어요. 한 번의 기록이면 충분해요."
            : "작은 기록들이 우리 동네 돌봄의 증거가 되고 있어요."}
        </p>
      </section>

      {/* 내 기록 (지역 집계와 분리) */}
      <section
        aria-labelledby="me-heading"
        className="card p-5 mb-4"
      >
        <h2 id="me-heading" className="text-[15px] font-semibold mb-2 text-text-main">나의 기록</h2>
        <p className="text-[15px] text-text-sub">
          이번 주 <b className="text-text-main">{me.weekLogCount}회</b> · 실험 시작 후 누적{" "}
          <b className="text-text-main">{me.totalLogCount}회</b>
        </p>
        <p className="text-[13px] mt-1.5 text-text-light">
          나의 기록은 나와 운영자만 볼 수 있어요.
        </p>
      </section>

      {/* 초대 */}
      {!ended && (
        <section
          aria-labelledby="invite-heading"
          className="card p-5"
        >
          <h2 id="invite-heading" className="text-[15px] font-semibold mb-1.5 text-text-main">
            이웃 돌봄자 초대하기
          </h2>
          <p className="text-[13px] mb-3 text-text-sub">
            {experiment.publicAreaName}에서 함께 돌보는 분이 있다면 초대해 주세요.
          </p>
          <button
            onClick={createInvite}
            disabled={inviteBusy}
            className="w-full flex items-center justify-center gap-2 rounded-lg text-[15px] font-semibold press transition-transform disabled:opacity-60"
            style={{ minHeight: 48, background: "var(--color-primary)", color: "var(--color-surface)" }}
          >
            {inviteBusy ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            초대 링크 만들기
          </button>
        </section>
      )}
    </div>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <div
      className="px-4 py-3 mb-4 text-[13px] font-medium text-text-sub"
      style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }}
    >
      {text}
    </div>
  );
}

function EmptyShell({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-6 pt-24 pb-10 max-w-lg mx-auto text-center">
      <div className="flex justify-center mb-3 text-text-light" aria-hidden>{icon}</div>
      <h1 className="text-[20px] font-bold mb-2 text-text-main">{title}</h1>
      <div className="text-[15px] leading-relaxed text-text-sub">
        {children}
      </div>
    </div>
  );
}
