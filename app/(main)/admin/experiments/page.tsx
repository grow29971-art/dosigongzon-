// 동네 돌봄 실험 관리 (admin 전용)
// 실험 생성·목록·성공 기준 지표 확인. 지표는 원자료 단순 집계 —
// 표본이 작으므로(목표 5명) 유의성 해석 없이 그대로 보여준다.
// 2026-09-16 「익숙한 동네앱」 리디자인: 헤어라인 섹션·구분선 리스트·수치 행·토큰.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, StopCircle } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import type { ExperimentMetrics } from "@/lib/experiment-metrics";
import UIButton from "@/app/components/ui/Button";
import {
  AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, FieldLabel, HairlineButton,
  KeyValueRow, inputCls, inputStyle,
} from "../_ui";

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

  if (checking) return <AdminLoading />;

  return (
    <AdminPage>
      <AdminHeader title="동네 돌봄 실험" description="14일 지역 실험 생성·지표 확인. 지역명에는 공개 가능한 동 이름만 넣으세요." />

      {/* 생성 */}
      <AdminSection title="새 실험">
        <FieldLabel>
          <label htmlFor="area-name">공개 지역명 (오늘부터 14일)</label>
        </FieldLabel>
        <div className="flex gap-2">
          <input
            id="area-name"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            placeholder="예: 망원1동"
            maxLength={40}
            className={`${inputCls} flex-1`}
            style={inputStyle}
          />
          <UIButton onClick={createExperiment} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            생성
          </UIButton>
        </div>
        {error && <p role="alert" className="mt-2 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>{error}</p>}
      </AdminSection>

      {/* 목록 */}
      <AdminSection title="실험 목록" padding={false}>
        {list.length === 0 && <EmptyState>아직 만든 실험이 없어요.</EmptyState>}
        {list.map((exp) => {
          const active = selected?.experiment.id === exp.id;
          return (
            <button
              key={exp.id}
              type="button"
              onClick={() => openMetrics(exp.id)}
              className="w-full text-left px-4 py-3 border-b border-divider last:border-b-0 press"
              style={{ background: active ? "var(--color-surface-alt)" : undefined }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-text-main truncate">{exp.public_area_name}</span>
                <AdminTag tone={exp.status === "active" ? "sage" : "neutral"}>
                  {exp.status === "active" ? "진행 중" : exp.status === "ended" ? "종료" : "대기"}
                </AdminTag>
              </div>
              <p className="text-[13px] text-text-light mt-0.5 tabular-nums">
                {exp.starts_at} ~ {exp.ends_at} · 참여 {exp.member_count}명
              </p>
            </button>
          );
        })}
      </AdminSection>

      {/* 지표 */}
      {metricsLoading && <AdminLoading />}
      {selected && (
        <AdminSection
          title={`${selected.experiment.public_area_name} 지표`}
          right={
            selected.experiment.status === "active" ? (
              <HairlineButton tone="error" onClick={() => endExperiment(selected.experiment.id)} icon={<StopCircle size={14} />}>
                조기 종료
              </HairlineButton>
            ) : undefined
          }
        >
          <p className="text-[13px] text-text-light mb-2">
            소표본 원자료 단순 집계 — 통계적 유의성을 주장하지 않습니다.
          </p>

          <div className="divide-y divide-divider">
            <KeyValueRow label="참여자 (초대 유입)" value={`${selected.metrics.memberCount}명 (${selected.metrics.invitedMemberCount}명)`} />
            <KeyValueRow label="초대 링크 생성 → 수락" value={`${selected.metrics.inviteCreatedCount} → ${selected.metrics.inviteAcceptedCount}`} />
            <KeyValueRow
              label="초대받은 사람 첫 기록 전환"
              value={`${pct(selected.metrics.invitedFirstLogRate)} (${selected.metrics.invitedWithFirstLog}/${selected.metrics.invitedMemberCount})`}
            />
            <KeyValueRow
              label="첫 기록자 다음 7일 재기록"
              value={`${pct(selected.metrics.firstLoggerRetentionRate)} (${selected.metrics.firstLoggerRetained}/${selected.metrics.firstLoggerCount})`}
            />
            <KeyValueRow
              label="주간 평균 기록/인"
              value={selected.metrics.weeklyAvgLogsPerUser === null ? "—" : selected.metrics.weeklyAvgLogsPerUser.toFixed(1)}
            />
          </div>

          <h3 className="text-[13px] font-bold text-text-main mt-4 mb-1">주차별 반복 기록자</h3>
          <div className="divide-y divide-divider">
            {selected.metrics.weeklyRepeatCarers.map((w) => (
              <KeyValueRow
                key={w.week}
                label={`${w.week}주차`}
                value={`반복 ${w.repeatCarers}명 / 활동 ${w.activeCarers}명 / 기록 ${w.logCount}건`}
              />
            ))}
          </div>

          <h3 className="text-[13px] font-bold text-text-main mt-4 mb-1">이벤트 집계 (건수 전용)</h3>
          {Object.entries(selected.eventCounts).length === 0 ? (
            <p className="text-[13px] text-text-light">아직 이벤트가 없어요.</p>
          ) : (
            <div className="divide-y divide-divider">
              {Object.entries(selected.eventCounts).map(([event, count]) => (
                <KeyValueRow key={event} label={event} value={count} />
              ))}
            </div>
          )}
        </AdminSection>
      )}
    </AdminPage>
  );
}
