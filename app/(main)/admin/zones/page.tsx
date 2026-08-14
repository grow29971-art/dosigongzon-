// QR 지킴판 관리 (admin 전용) — 구역 생성·QR 인쇄·익명 제보 확인/이관
// ⚠️ QR은 밥자리에 직접 붙이지 않는다 (위치 광고 역효과) — 동네 진입부·게시판 레벨에 부착.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield, Plus, Download, Inbox } from "lucide-react";
import QRCode from "qrcode";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listZones, createZone, setZoneActive, listZoneReports, updateZoneReportStatus,
  INCIDENT_LABELS, WHEN_LABELS, ANIMAL_STATUS_LABELS, ZONE_REPORT_STATUS_LABELS,
  type GuardianZone, type ZoneReport, type ZoneReportStatus,
} from "@/lib/zones-repo";

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

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-light" />
      </div>
    );
  }

  const zoneLabel = (id: string) => zones.find((z) => z.id === id)?.label ?? "삭제된 구역";

  return (
    <div className="min-h-dvh bg-warm-white pb-24">
      <div className="max-w-lg mx-auto px-5 pt-14">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[13px] text-text-sub font-semibold mb-3">
          <ArrowLeft size={15} /> 관리자 홈
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={20} className="text-primary" />
          <h1 className="text-[20px] font-extrabold text-text-main">QR 지킴판</h1>
        </div>
        <p className="text-[12px] text-text-sub leading-relaxed mb-4">
          구역을 만들면 QR이 생성돼요. 스캔하면 익명 목격제보 랜딩으로 연결됩니다.
          <br />
          <b style={{ color: "#B84545" }}>⚠️ QR은 밥자리에 직접 붙이지 마세요</b> — 위치를 광고하는 역효과가 나요.
          동네 진입부·아파트 게시판·관리사무소 레벨에 부착해주세요.
        </p>

        {error && (
          <p className="text-[13px] font-bold mb-3" style={{ color: "#B84545" }}>{error}</p>
        )}

        {/* 구역 생성 */}
        <div className="rounded-2xl bg-white p-4 mb-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <p className="text-[13px] font-extrabold text-text-main mb-2">새 구역 만들기</p>
          <input
            value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            placeholder="라벨 — 동 단위까지만 (예: 역삼동 돌봄구역 A)" maxLength={40}
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-2"
            style={{ backgroundColor: "var(--color-surface-alt)" }}
          />
          <input
            value={newNotice} onChange={(e) => setNewNotice(e.target.value)}
            placeholder="랜딩 추가 안내 (선택)" maxLength={120}
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-2"
            style={{ backgroundColor: "var(--color-surface-alt)" }}
          />
          <button
            onClick={handleCreate} disabled={busy}
            className="w-full rounded-xl py-2.5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Plus size={14} /> 구역 생성
          </button>
        </div>

        {/* 구역 목록 + QR */}
        {zones.map((zone) => (
          <div key={zone.id} className="rounded-2xl bg-white p-4 mb-3" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)", opacity: zone.active ? 1 : 0.55 }}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-text-main truncate">{zone.label}</p>
                <p className="text-[11px] text-text-light">{zone.active ? "운영 중" : "중지됨"} · 제보 {reports.filter((r) => r.zone_id === zone.id).length}건</p>
              </div>
              <button
                onClick={() => setZoneActive(zone.id, !zone.active).then(refresh).catch((e) => setError(e.message))}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg active:scale-95"
                style={{ backgroundColor: "var(--color-surface-alt)", color: "var(--color-text-sub)" }}
              >
                {zone.active ? "운영 중지" : "다시 운영"}
              </button>
            </div>
            {qrMap[zone.id] && (
              <div className="flex items-center gap-3 mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrMap[zone.id]} alt={`${zone.label} QR`} className="w-24 h-24 rounded-lg" style={{ border: "1px solid var(--color-divider)" }} />
                <div className="text-[11px] text-text-sub leading-relaxed">
                  <a
                    href={qrMap[zone.id]} download={`지킴판QR_${zone.label}.png`}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-primary mb-1"
                  >
                    <Download size={13} /> QR 이미지 저장
                  </a>
                  <p className="break-all text-[10px] text-text-light">/z/{zone.id}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 제보 목록 */}
        <div className="flex items-center gap-1.5 mt-6 mb-2">
          <Inbox size={16} className="text-primary" />
          <h2 className="text-[15px] font-extrabold text-text-main">접수된 제보</h2>
        </div>
        <p className="text-[11px] text-text-light mb-3 leading-relaxed">
          도시공존은 내용을 판정하지 않아요 — 확인 후 경찰·동물보호센터 이관 여부만 결정합니다. 제보는 90일 후 자동 파기.
        </p>
        {reports.length === 0 && <p className="text-[13px] text-text-light">아직 제보가 없어요.</p>}
        {reports.map((r) => (
          <div key={r.id} className="rounded-2xl bg-white p-4 mb-2.5" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-extrabold text-text-main">
                {INCIDENT_LABELS[r.incident_type] ?? r.incident_type}
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                style={{
                  backgroundColor: r.status === "received" ? "var(--color-warning-soft)" : r.status === "forwarded" ? "#EAF2FB" : "#F0F0EC",
                  color: r.status === "received" ? "#B07A1C" : r.status === "forwarded" ? "#3A6CB5" : "#8A8578",
                }}
              >
                {ZONE_REPORT_STATUS_LABELS[r.status]}
              </span>
            </div>
            <p className="text-[11px] text-text-sub">
              {zoneLabel(r.zone_id)} · {WHEN_LABELS[r.occurred_when] ?? r.occurred_when} · 동물 {ANIMAL_STATUS_LABELS[r.animal_status] ?? r.animal_status}
              · {new Date(r.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {r.detail && (
              <p className="text-[12px] text-text-main mt-1.5 rounded-xl px-3 py-2 leading-relaxed" style={{ backgroundColor: "var(--color-surface-alt)" }}>
                {r.detail}
              </p>
            )}
            <div className="flex gap-1.5 mt-2.5">
              {r.status === "received" && (
                <button onClick={() => handleStatus(r.id, "forwarded")} disabled={busy}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white active:scale-95 disabled:opacity-60"
                  style={{ backgroundColor: "#4A7BA8" }}>
                  기관 이관 처리
                </button>
              )}
              {r.status !== "closed" && (
                <button onClick={() => handleStatus(r.id, "closed")} disabled={busy}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-surface-alt)", color: "var(--color-text-sub)" }}>
                  종결
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
