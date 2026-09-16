"use client";

// 후원금 관리 (관리자) — 정산 위젯의 "쓰인 금액"(지출)과 "모인 금액" 수동 조정을 여기서.
// SQL 안 치고도 등록/삭제. RLS로 관리자만 쓰기 가능.
// 공개 카드는 일일 스냅샷(매일 09:00 KST)이라, 여기서 바꾼 값은 다음날 아침 반영되고
// 급하면 "카드에 지금 반영" 버튼으로 즉시 스냅샷을 갱신한다.
// 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 안내 박스·요약 카드 → 헤어라인 섹션 + 수치 행, 내역 → 구분선 리스트. 토큰만.

import { useEffect, useState } from "react";
import { Plus, Minus, Trash2, Loader2, RefreshCcw } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listDisbursements, createDisbursement, deleteDisbursement, type Disbursement,
  listAdjustments, createAdjustment, deleteAdjustment, type Adjustment,
} from "@/lib/fund-admin-repo";
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, EmptyState, HairlineButton, SegmentTabs,
  StatRow, inputCls, inputStyle,
} from "../_ui";

const won = (n: number) => `${n.toLocaleString()}원`;
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

function snapLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminFundPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Disbursement[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [collected, setCollected] = useState<number | null>(null);
  const [snappedAt, setSnappedAt] = useState<string | null>(null);
  const [snapCollected, setSnapCollected] = useState<number | null>(null);

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [neuteredCount, setNeuteredCount] = useState("");
  const [recipient, setRecipient] = useState("");     // 수령처 (세무 증빙 M5)
  const [evidenceUrl, setEvidenceUrl] = useState(""); // 증빙 링크
  const [spentAt, setSpentAt] = useState(todayKst());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 조정(증액/감액) 폼
  const [adjSign, setAdjSign] = useState<1 | -1>(1);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjMemo, setAdjMemo] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);
  const [pushing, setPushing] = useState(false);

  const reload = async () => {
    setItems(await listDisbursements());
    setAdjustments(await listAdjustments());
    try {
      // 관리자 화면은 라이브 집계(조정 포함)를 본다 — 공개 카드의 스냅샷과 별개
      const s = await (await fetch("/api/admin/fund-refresh")).json();
      setCollected(typeof s.live?.collected === "number" ? s.live.collected : null);
      setSnappedAt(s.snapshot?.snapped_at ?? null);
      setSnapCollected(typeof s.snapshot?.collected === "number" ? s.snapshot.collected : null);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin()
      .then(async (admin) => {
        if (cancelled) return;
        setIsAdmin(admin);
        if (admin) await reload();
      })
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  const spent = items.reduce((s, d) => s + d.amount, 0);
  const balance = (collected ?? 0) - spent;

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      await createDisbursement({
        amount: Number(amount),
        memo,
        spent_at: spentAt,
        neuteredCount: neuteredCount ? Number(neuteredCount) : undefined,
        recipient: recipient || undefined,
        evidenceUrl: evidenceUrl || undefined,
      });
      setAmount(""); setMemo(""); setNeuteredCount(""); setSpentAt(todayKst());
      setRecipient(""); setEvidenceUrl("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 지출 내역을 삭제할까요?")) return;
    try { await deleteDisbursement(id); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "삭제 실패"); }
  };

  const submitAdjustment = async () => {
    setError("");
    setAdjSaving(true);
    try {
      await createAdjustment(adjSign * Number(adjAmount), adjMemo);
      setAdjAmount(""); setAdjMemo(""); setAdjSign(1);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "조정 등록 실패");
    } finally {
      setAdjSaving(false);
    }
  };

  const removeAdjustment = async (id: string) => {
    if (!confirm("이 조정 내역을 삭제할까요? (모인 금액에서 되돌려져요)")) return;
    try { await deleteAdjustment(id); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "조정 삭제 실패"); }
  };

  // 공개 카드(일일 스냅샷)에 현재 라이브 값을 즉시 반영
  const pushSnapshot = async () => {
    setError("");
    setPushing(true);
    try {
      const r = await fetch("/api/admin/fund-refresh", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "반영 실패");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "카드 반영 실패");
    } finally {
      setPushing(false);
    }
  };

  if (!authChecked) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  const snapDiff =
    snapCollected != null && collected != null && snapCollected !== collected
      ? Math.abs(collected - snapCollected)
      : 0;

  return (
    <AdminPage>
      <AdminHeader
        title="후원금 관리"
        description="지출 등록과 금액 조정. 쇼핑의 ‘투명 정산’ 카드는 매일 아침 9시에 갱신돼요."
      />

      {/* 요약 — 라이브 집계 */}
      <AdminSection title="현재 집계" padding={false}>
        <StatRow label="모인 금액" sub="결제완료 주문 후원액 합계 + 수동 조정" value={won(collected ?? 0)} tone="sage" />
        <StatRow label="쓰인 금액" sub="아래에 등록한 지출의 합계" value={won(spent)} tone="like" />
        <StatRow label="잔액" sub="모인 − 쓰인" value={won(balance)} />
      </AdminSection>

      {/* 카드 반영 상태 — 여기 숫자는 라이브, 공개 카드는 스냅샷. 차이가 나면 버튼으로 밀어넣기 */}
      <AdminSection title="공개 카드 표시 기준">
        <div className="flex items-center gap-3">
          <p className="flex-1 min-w-0 text-[13px] text-text-sub leading-relaxed">
            {snappedAt ? `${snapLabel(snappedAt)} 스냅샷` : "아직 스냅샷 없음"} · 매일 09:00 자동 갱신
            {snapDiff > 0 && (
              <b style={{ color: "var(--color-warning)" }}> · 지금 값과 {won(snapDiff)} 차이</b>
            )}
          </p>
          <HairlineButton
            tone="primary"
            onClick={pushSnapshot}
            disabled={pushing}
            icon={pushing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
          >
            카드에 지금 반영
          </HairlineButton>
        </div>
      </AdminSection>

      {/* 금액 조정 (증액/감액) */}
      <AdminSection title="모인 금액 조정">
        <p className="text-[13px] text-text-light mb-3">오프라인 후원 입금, 집계 정정처럼 앱 밖의 돈을 반영해요. 사유가 그대로 장부에 남아요.</p>
        <SegmentTabs
          className="mb-2.5"
          value={adjSign === 1 ? "plus" : "minus"}
          onChange={(k) => setAdjSign(k === "plus" ? 1 : -1)}
          items={[
            { key: "plus", label: "증액 (+)" },
            { key: "minus", label: "감액 (−)" },
          ]}
        />
        <div className="space-y-2">
          <input
            type="text" inputMode="numeric" value={adjAmount}
            onChange={(e) => setAdjAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="금액 (원)"
            className={`${inputCls} tabular-nums`}
            style={inputStyle}
          />
          <input
            type="text" value={adjMemo} onChange={(e) => setAdjMemo(e.target.value)} maxLength={80}
            placeholder="사유 (예: 오프라인 후원 입금 ○○님)"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <UIButton
          variant={adjSign === 1 ? "primary" : "danger"}
          full
          className="mt-3"
          onClick={submitAdjustment}
          disabled={adjSaving || !adjAmount || !adjMemo.trim()}
        >
          {adjSaving ? <Loader2 size={14} className="animate-spin" /> : adjSign === 1 ? <Plus size={15} /> : <Minus size={15} />}
          {adjSign === 1 ? "증액 등록" : "감액 등록"}
        </UIButton>

        {adjustments.length > 0 && (
          <div className="mt-3 divide-y divide-divider" style={{ borderTop: "1px solid var(--color-divider)" }}>
            {adjustments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-text-main truncate">{a.memo}</p>
                  <p className="text-[13px] text-text-light tabular-nums">{a.created_at.slice(0, 10)}</p>
                </div>
                <span
                  className="text-[15px] font-bold tabular-nums shrink-0"
                  style={{ color: a.amount > 0 ? "var(--color-sage)" : "var(--color-error)" }}
                >
                  {a.amount > 0 ? "+" : "−"}{won(Math.abs(a.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => removeAdjustment(a.id)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center press text-text-light"
                  aria-label="조정 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      {/* 등록 폼 */}
      <AdminSection title="지출 등록">
        <div className="space-y-2">
          <input
            type="text" inputMode="numeric" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="금액 (원)"
            className={`${inputCls} tabular-nums`}
            style={inputStyle}
          />
          <input
            type="text" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={80}
            placeholder="사용처 (예: ○○동물병원 구조묘 치료비)"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="text" inputMode="numeric" value={neuteredCount}
            onChange={(e) => setNeuteredCount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="중성화 마릿수 (없으면 비워두세요)"
            className={`${inputCls} tabular-nums`}
            style={inputStyle}
          />
          {/* 세무 증빙 — 기부금 vs 판촉비 분류 근거 (2026-08-29 법률감사 M5) */}
          <input
            type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={200}
            placeholder="수령처 (단체·병원·개인명 — 세무 증빙용, 선택)"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} maxLength={500}
            placeholder="증빙 링크 (계좌이체 내역·영수증 URL — 선택)"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        {error && <p className="text-[13px] mt-2" style={{ color: "var(--color-error)" }}>{error}</p>}
        <UIButton full className="mt-3" onClick={submit} disabled={saving || !amount || !memo.trim()}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />} 등록
        </UIButton>
      </AdminSection>

      {/* 내역 */}
      <AdminSection title={`지출 내역 (${items.length})`} padding={false}>
        {items.length === 0 ? (
          <EmptyState>아직 등록된 지출이 없어요.</EmptyState>
        ) : items.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-text-main truncate">{d.memo}</p>
              <p className="text-[13px] text-text-light tabular-nums">
                {d.spent_at}
                {d.neutered_count > 0 && <> · 중성화 {d.neutered_count}마리</>}
              </p>
            </div>
            <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: "var(--color-like)" }}>-{won(d.amount)}</span>
            <button
              type="button"
              onClick={() => remove(d.id)}
              className="shrink-0 w-8 h-8 flex items-center justify-center press text-text-light"
              aria-label="삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </AdminSection>
    </AdminPage>
  );
}
