// 동네 돌봄 실험 관리 (admin 전용)
// 실험 생성·목록·성공 기준 지표 확인. 지표는 원자료 단순 집계 —
// 표본이 작으므로(목표 5명) 유의성 해석 없이 그대로 보여준다.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, FlaskConical, StopCircle } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import type { ExperimentMetrics } from "@/lib/experiment-metrics";

interface ExperimentListItem {
  id: string;
  public_area_name: string;
  starts_at: string;
  ends_at: string;
  status: "draft" | "active" | "ended";
  member_count: number;
}

interface MetricsResponse {
  experiment: ExperimentListItem;
  metrics: ExperimentMetrics;
  eventCounts: Record<string, number>;
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export default function AdminExperimentsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [list, setList] = useState<ExperimentListItem[]>([]);
  const [areaName, setAreaName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<MetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/admin/experiments");
    if (!res.ok) return;
    const data = await res.json();
    setList(data.experiments ?? []);
  }, []);

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        if (!isAdmin) return router.replace("/");
        setChecking(false);
        loadList();
      })
      .catch(() => router.replace("/"));
  }, [router, loadList]);

  const createExperiment = async () => {
    if (busy) return;
    const name = areaName.trim();
    if (!name) {
      setError("공개 지역명을 입력해 주세요. 예: 망원1동 (좌표·상세 주소 금지)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicAreaName: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "생성에 실패했어요.");
        return;
      }
      setAreaName("");
      await loadList();
    } catch {
      setError("생성에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const openMetrics = async (id: string) => {
    setMetricsLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/experiments?id=${id}`);
      if (res.ok) setSelected(await res.json());
    } finally {
      setMetricsLoading(false);
    }
  };

  const endExperiment = async (id: string) => {
    if (!confirm("이 실험을 종료 상태로 바꿀까요? (기록·초대가 중단돼요)")) return;
    await fetch("/api/admin/experiments", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: "ended" }),
    });
    await loadList();
    if (selected?.experiment.id === id) await openMetrics(id);
  };

  if (checking) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-16 max-w-lg mx-auto">
      <Link href="/admin" className="inline-flex items-center gap-1 text-[13px] font-bold mb-4" style={{ color: "var(--color-text-light)" }}>
        <ArrowLeft size={15} /> 관리자 홈
      </Link>
      <h1 className="text-[20px] font-extrabold mb-1 flex items-center gap-2">
        <FlaskConical size={20} style={{ color: "var(--color-primary)" }} /> 동네 돌봄 실험
      </h1>
      <p className="text-[13px] mb-5" style={{ color: "var(--color-text-light)" }}>
        14일 지역 실험 생성·지표 확인. 지역명에는 공개 가능한 동 이름만 넣으세요.
      </p>

      {/* 생성 */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(25,31,40,0.06)" }}>
        <label htmlFor="area-name" className="block text-[13px] font-bold mb-1.5">
          공개 지역명 (오늘부터 14일)
        </label>
        <div className="flex gap-2">
          <input
            id="area-name"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            placeholder="예: 망원1동"
            maxLength={40}
            className="flex-1 rounded-xl px-3.5 text-[14px] outline-none focus:ring-2"
            style={{ minHeight: 46, background: "var(--color-surface-alt)", border: "1px solid transparent" }}
          />
          <button
            onClick={createExperiment}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 rounded-xl text-white text-[14px] font-bold disabled:opacity-60"
            style={{ minHeight: 46, background: "var(--color-primary)" }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            생성
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-[12px] font-semibold" style={{ color: "#C24747" }}>{error}</p>}
      </div>

      {/* 목록 */}
      <div className="flex flex-col gap-2.5 mb-6">
        {list.length === 0 && (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--color-text-light)" }}>
            아직 만든 실험이 없어요.
          </p>
        )}
        {list.map((exp) => (
          <button
            key={exp.id}
            onClick={() => openMetrics(exp.id)}
            className="text-left rounded-2xl p-4 active:scale-[0.99] transition-transform"
            style={{
              background: "#fff",
              boxShadow: "0 4px 20px rgba(25,31,40,0.06)",
              border: selected?.experiment.id === exp.id ? "1.5px solid var(--color-primary)" : "1.5px solid transparent",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold">{exp.public_area_name}</span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: exp.status === "active" ? "rgba(107,142,111,0.15)" : "var(--color-surface-alt)",
                  color: exp.status === "active" ? "#557A59" : "var(--color-text-light)",
                }}
              >
                {exp.status === "active" ? "진행 중" : exp.status === "ended" ? "종료" : "대기"}
              </span>
            </div>
            <p className="text-[12px] mt-1" style={{ color: "var(--color-text-light)" }}>
              {exp.starts_at} ~ {exp.ends_at} · 참여 {exp.member_count}명
            </p>
          </button>
        ))}
      </div>

      {/* 지표 */}
      {metricsLoading && (
        <div className="flex justify-center py-8">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--color-primary)" }} />
        </div>
      )}
      {selected && (
        <div className="rounded-2xl p-5" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(25,31,40,0.06)" }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[16px] font-extrabold">{selected.experiment.public_area_name} 지표</h2>
            {selected.experiment.status === "active" && (
              <button
                onClick={() => endExperiment(selected.experiment.id)}
                className="inline-flex items-center gap-1 text-[12px] font-bold"
                style={{ color: "#C24747" }}
              >
                <StopCircle size={14} /> 조기 종료
              </button>
            )}
          </div>
          <p className="text-[11px] mb-4" style={{ color: "var(--color-text-light)" }}>
            ⚠️ 소표본 원자료 단순 집계 — 통계적 유의성을 주장하지 않습니다.
          </p>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-[13px]">
            <MetricItem label="참여자 (초대 유입)" value={`${selected.metrics.memberCount}명 (${selected.metrics.invitedMemberCount}명)`} />
            <MetricItem label="초대 링크 생성 → 수락" value={`${selected.metrics.inviteCreatedCount} → ${selected.metrics.inviteAcceptedCount}`} />
            <MetricItem
              label="초대받은 사람 첫 기록 전환"
              value={`${pct(selected.metrics.invitedFirstLogRate)} (${selected.metrics.invitedWithFirstLog}/${selected.metrics.invitedMemberCount})`}
            />
            <MetricItem
              label="첫 기록자 다음 7일 재기록"
              value={`${pct(selected.metrics.firstLoggerRetentionRate)} (${selected.metrics.firstLoggerRetained}/${selected.metrics.firstLoggerCount})`}
            />
            <MetricItem
              label="주간 평균 기록/인"
              value={selected.metrics.weeklyAvgLogsPerUser === null ? "—" : selected.metrics.weeklyAvgLogsPerUser.toFixed(1)}
            />
          </dl>

          <h3 className="text-[13px] font-extrabold mt-5 mb-2">주차별 반복 기록자</h3>
          <div className="flex flex-col gap-1.5">
            {selected.metrics.weeklyRepeatCarers.map((w) => (
              <p key={w.week} className="text-[13px]" style={{ color: "#4E5968" }}>
                {w.week}주차 — 반복 기록자 <b>{w.repeatCarers}명</b> / 활동 {w.activeCarers}명 / 기록 {w.logCount}건
              </p>
            ))}
          </div>

          <h3 className="text-[13px] font-extrabold mt-5 mb-2">이벤트 집계 (건수 전용)</h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(selected.eventCounts).length === 0 && (
              <p className="text-[12px]" style={{ color: "var(--color-text-light)" }}>아직 이벤트가 없어요.</p>
            )}
            {Object.entries(selected.eventCounts).map(([event, count]) => (
              <span
                key={event}
                className="text-[11px] font-bold px-2 py-1 rounded-lg"
                style={{ background: "var(--color-surface-alt)", color: "#4E5968" }}
              >
                {event}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] mb-0.5" style={{ color: "var(--color-text-light)" }}>{label}</dt>
      <dd className="font-extrabold" style={{ color: "var(--color-primary)" }}>{value}</dd>
    </div>
  );
}
