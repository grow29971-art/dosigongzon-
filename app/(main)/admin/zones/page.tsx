// QR 지킴판 관리 (admin 전용) — 구역 생성·QR 인쇄·익명 제보 확인/이관
// ⚠️ QR은 밥자리에 직접 붙이지 않는다 (위치 광고 역효과) — 동네 진입부·게시판 레벨에 부착.
// 2026-09-16 「익숙한 동네앱」 리디자인: 헤어라인 섹션·구분선 리스트·회색 태그·토큰.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download } from "lucide-react";
import QRCode from "qrcode";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listZones, createZone, setZoneActive, listZoneReports, updateZoneReportStatus,
  INCIDENT_LABELS, WHEN_LABELS, ANIMAL_STATUS_LABELS, ZONE_REPORT_STATUS_LABELS,
  type GuardianZone, type ZoneReport, type ZoneReportStatus,
} from "@/lib/zones-repo";
import UIButton from "@/app/components/ui/Button";
import {
  AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, HairlineButton, inputCls, inputStyle,
} from "../_ui";

export default function AdminZonesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [zones, setZones] = useState<GuardianZone[]>([]);
  const [reports, setReports] = useState<ZoneReport[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newNotice, setNewNotice] = useState("");

  const refresh = async () => {
    try {
      const [z, r] = await Promise.all([listZones(), listZoneReports()]);
      setZones(z);
      setReports(r);
      // QR 데이터 URL 생성 (클라이언트에서 — 외부 서비스 무경유)
      const origin = window.location.origin;
      const entries = await Promise.all(
        z.map(async (zone) => {
          const url = await QRCode.toDataURL(`${origin}/z/${zone.id}`, { width: 480, margin: 2 });
          return [zone.id, url] as const;
        }),
      );
      setQrMap(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    }
  };

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        setChecking(false);
        if (!isAdmin) { router.replace("/"); return; }
        refresh();
      })
      .catch(() => { setChecking(false); router.replace("/"); });
  }, [router]);

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await createZone(newLabel, newNotice);
      setNewLabel(""); setNewNotice("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally { setBusy(false); }
  };

  const handleStatus = async (id: string, status: ZoneReportStatus) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await updateZoneReportStatus(id, status);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경 실패");
    } finally { setBusy(false); }
  };

  if (checking) return <AdminLoading />;

  const zoneLabel = (id: string) => zones.find((z) => z.id === id)?.label ?? "삭제된 구역";
  const statusTone = (s: ZoneReportStatus) =>
    s === "received" ? "warning" : s === "forwarded" ? "primary" : "neutral";

  return (
    <AdminPage>
      <AdminHeader
        title="QR 지킴판"
        description="구역을 만들면 QR이 생성돼요. 스캔하면 익명 목격제보 랜딩으로 연결됩니다."
      />
      <p className="text-[13px] text-text-sub leading-relaxed mb-4">
        <b style={{ color: "var(--color-error)" }}>QR은 밥자리에 직접 붙이지 마세요</b> — 위치를 광고하는 역효과가 나요.
        동네 진입부·아파트 게시판·관리사무소 레벨에 부착해주세요.
      </p>

      {error && (
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      {/* 구역 생성 */}
      <AdminSection title="새 구역 만들기">
        <input
          value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
          placeholder="라벨 — 동 단위까지만 (예: 역삼동 돌봄구역 A)" maxLength={40}
          className={`${inputCls} mb-2`}
          style={inputStyle}
        />
        <input
          value={newNotice} onChange={(e) => setNewNotice(e.target.value)}
          placeholder="랜딩 추가 안내 (선택)" maxLength={120}
          className={`${inputCls} mb-3`}
          style={inputStyle}
        />
        <UIButton onClick={handleCreate} disabled={busy} full>
          <Plus size={14} /> 구역 생성
        </UIButton>
      </AdminSection>

      {/* 구역 목록 + QR */}
      <AdminSection title="구역" padding={false}>
        {zones.length === 0 && <EmptyState>아직 구역이 없어요.</EmptyState>}
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="px-4 py-3 border-b border-divider last:border-b-0"
            style={{ opacity: zone.active ? 1 : 0.55 }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-text-main truncate">{zone.label}</p>
                <p className="text-[13px] text-text-light mt-0.5">
                  {zone.active ? "운영 중" : "중지됨"} · 제보 {reports.filter((r) => r.zone_id === zone.id).length}건
                </p>
              </div>
              <HairlineButton
                onClick={() => setZoneActive(zone.id, !zone.active).then(refresh).catch((e) => setError(e.message))}
              >
                {zone.active ? "운영 중지" : "다시 운영"}
              </HairlineButton>
            </div>
            {qrMap[zone.id] && (
              <div className="flex items-center gap-3 mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrMap[zone.id]}
                  alt={`${zone.label} QR`}
                  className="w-24 h-24"
                  style={{ borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
                />
                <div className="min-w-0">
                  <a
                    href={qrMap[zone.id]} download={`지킴판QR_${zone.label}.png`}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary mb-1"
                  >
                    <Download size={13} /> QR 이미지 저장
                  </a>
                  <p className="break-all text-[11px] text-text-light">/z/{zone.id}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </AdminSection>

      {/* 제보 목록 */}
      <AdminSection title="접수된 제보" padding={false}>
        <p className="px-4 py-2 text-[13px] text-text-light leading-relaxed border-b border-divider">
          도시공존은 내용을 판정하지 않아요 — 확인 후 경찰·동물보호센터 이관 여부만 결정합니다. 제보는 90일 후 자동 파기.
        </p>
        {reports.length === 0 && <EmptyState>아직 제보가 없어요.</EmptyState>}
        {reports.map((r) => (
          <div key={r.id} className="px-4 py-3 border-b border-divider last:border-b-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[15px] font-semibold text-text-main">
                {INCIDENT_LABELS[r.incident_type] ?? r.incident_type}
              </span>
              <AdminTag tone={statusTone(r.status)}>{ZONE_REPORT_STATUS_LABELS[r.status]}</AdminTag>
            </div>
            <p className="text-[13px] text-text-sub">
              {zoneLabel(r.zone_id)} · {WHEN_LABELS[r.occurred_when] ?? r.occurred_when} · 동물 {ANIMAL_STATUS_LABELS[r.animal_status] ?? r.animal_status}
              · {new Date(r.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {r.detail && (
              <p className="text-[13px] text-text-main mt-1.5 leading-relaxed whitespace-pre-wrap">{r.detail}</p>
            )}
            {r.status !== "closed" && (
              <div className="flex gap-1.5 mt-2.5">
                {r.status === "received" && (
                  <HairlineButton tone="primary" onClick={() => handleStatus(r.id, "forwarded")} disabled={busy}>
                    기관 이관 처리
                  </HairlineButton>
                )}
                <HairlineButton onClick={() => handleStatus(r.id, "closed")} disabled={busy}>
                  종결
                </HairlineButton>
              </div>
            )}
          </div>
        ))}
      </AdminSection>
    </AdminPage>
  );
}
