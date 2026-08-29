"use client";

// 후원금 관리 (관리자) — 정산 위젯의 "쓰인 금액"(지출)과 "모인 금액" 수동 조정을 여기서.
// SQL 안 치고도 등록/삭제. RLS로 관리자만 쓰기 가능.
// 공개 카드는 일일 스냅샷(매일 09:00 KST)이라, 여기서 바꾼 값은 다음날 아침 반영되고
// 급하면 "카드에 지금 반영" 버튼으로 즉시 스냅샷을 갱신한다.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, Trash2, Loader2, Shield, RefreshCcw } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listDisbursements, createDisbursement, deleteDisbursement, type Disbursement,
  listAdjustments, createAdjustment, deleteAdjustment, type Adjustment,
} from "@/lib/fund-admin-repo";

const won = (n: number) => `${n.toLocaleString()}원`;
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

function snapLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminFundPage() {
  const router = useRouter();
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

  if (!authChecked) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="px-4 pt-20 text-center">
        <Shield size={40} className="mx-auto text-text-light mb-3" />
        <p className="text-[15px] font-bold text-text-main">관리자만 접근할 수 있어요</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 pb-24 max-w-lg mx-auto">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-[13px] text-text-sub mb-4 press-strong">
        <ArrowLeft size={16} /> 관리자
      </button>
      <h1 className="text-[24px] font-bold text-text-main tracking-tight mb-1">후원금 관리</h1>
      <p className="text-[13px] text-text-sub mb-3">지출 등록과 금액 조정. 쇼핑의 &lsquo;투명 정산&rsquo; 카드는 매일 아침 9시에 갱신돼요.</p>

      {/* 계산식 안내 — 세 숫자가 각각 어디서 오는지 한눈에 */}
      <div
        className="mb-4 px-3.5 py-3 rounded-2xl text-[13px] leading-relaxed"
        style={{ background: "var(--color-primary-softer)", border: "1px solid rgba(176, 92, 54,0.12)" }}
      >
        <p className="font-bold text-text-main mb-1.5">숫자는 이렇게 계산돼요</p>
        <p className="text-text-sub">
          <b>모인 금액</b> = 결제완료 주문의 후원액 합계(자동) <b>+ 수동 조정</b>
          <br />
          <span className="text-text-light">주문이 취소·환불되면 자동으로 빠지고, 오프라인 후원·정정은 아래 조정으로 넣어요.</span>
        </p>
        <p className="text-text-sub mt-1.5">
          <b>쓰인 금액</b> = 아래에 등록한 지출의 합계 · <b>등록만 직접</b>
          <br />
          <span className="text-text-light">실제로 돈을 쓴 건 앱이 알 수 없어서, 이 칸만 사람이 넣어요.</span>
        </p>
        <p className="text-text-sub mt-1.5">
          <b>잔액</b> = 모인 − 쓰인 · <b>자동</b>
        </p>
      </div>

      {/* 카드 반영 상태 — 여기 숫자는 라이브, 공개 카드는 스냅샷. 차이가 나면 버튼으로 밀어넣기 */}
      <div
        className="mb-5 px-3.5 py-3 rounded-2xl flex items-center gap-3"
        style={{ background: "#fff", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-card-sm)" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-text-main">공개 카드 표시 기준</p>
          <p className="text-[11px] text-text-light mt-0.5">
            {snappedAt ? `${snapLabel(snappedAt)} 스냅샷` : "아직 스냅샷 없음"} · 매일 09:00 자동 갱신
            {snapCollected != null && collected != null && snapCollected !== collected && (
              <b style={{ color: "#E8930C" }}> · 지금 값과 {won(Math.abs(collected - snapCollected))} 차이</b>
            )}
          </p>
        </div>
        <button
          onClick={pushSnapshot}
          disabled={pushing}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white press-strong disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {pushing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
          카드에 지금 반영
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "모인 금액", value: collected ?? 0, color: "#22A366" },
          { label: "쓰인 금액", value: spent, color: "var(--color-like)" },
          { label: "잔액", value: balance, color: "var(--color-primary)" },
        ].map((s) => (
          <div key={s.label} className="text-center py-3 rounded-2xl" style={{ background: "var(--color-surface-alt)" }}>
            <p className="text-[11px] font-bold text-text-light mb-0.5">{s.label}</p>
            <p className="text-[15px] font-extrabold tabular-nums" style={{ color: s.color }}>{s.value.toLocaleString()}<span className="text-[9px] text-text-light">원</span></p>
          </div>
        ))}
      </div>

      {/* 금액 조정 (증액/감액) */}
      <div className="p-4 rounded-2xl mb-5" style={{ background: "#fff", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-card-sm)" }}>
        <h2 className="text-[15px] font-bold text-text-main mb-1">모인 금액 조정</h2>
        <p className="text-[11px] text-text-light mb-3">오프라인 후원 입금, 집계 정정처럼 앱 밖의 돈을 반영해요. 사유가 그대로 장부에 남아요.</p>
        <div className="flex items-center gap-1.5 mb-2.5">
          {([[1, "증액 (+)"], [-1, "감액 (−)"]] as const).map(([sign, label]) => (
            <button
              key={sign}
              type="button"
              onClick={() => setAdjSign(sign)}
              className="px-3 py-1.5 rounded-xl text-[13px] font-bold"
              style={{
                background: adjSign === sign ? (sign === 1 ? "#22A366" : "#D85555") : "var(--color-warm-white)",
                color: adjSign === sign ? "#fff" : "var(--color-text-sub)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          <input
            type="text" inputMode="numeric" value={adjAmount}
            onChange={(e) => setAdjAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="금액 (원)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none tabular-nums"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
          <input
            type="text" value={adjMemo} onChange={(e) => setAdjMemo(e.target.value)} maxLength={80}
            placeholder="사유 (예: 오프라인 후원 입금 ○○님)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
        </div>
        <button
          onClick={submitAdjustment} disabled={adjSaving || !adjAmount || !adjMemo.trim()}
          className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-[13px] font-bold disabled:opacity-40 press transition-transform"
          style={{ background: adjSign === 1 ? "#22A366" : "#D85555" }}
        >
          {adjSaving ? <Loader2 size={14} className="animate-spin" /> : adjSign === 1 ? <Plus size={15} /> : <Minus size={15} />}
          {adjSign === 1 ? "증액 등록" : "감액 등록"}
        </button>

        {adjustments.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {adjustments.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: "var(--color-surface-alt)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text-main truncate">{a.memo}</p>
                  <p className="text-[11px] text-text-light">{a.created_at.slice(0, 10)}</p>
                </div>
                <span className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: a.amount > 0 ? "#22A366" : "#D85555" }}>
                  {a.amount > 0 ? "+" : "−"}{won(Math.abs(a.amount))}
                </span>
                <button onClick={() => removeAdjustment(a.id)} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center press-strong" style={{ background: "rgba(216,85,85,0.1)" }} aria-label="조정 삭제">
                  <Trash2 size={13} style={{ color: "#D85555" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 등록 폼 */}
      <div className="p-4 rounded-2xl mb-5" style={{ background: "#fff", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-card-sm)" }}>
        <h2 className="text-[15px] font-bold text-text-main mb-3">지출 등록</h2>
        <div className="space-y-2.5">
          <input
            type="text" inputMode="numeric" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="금액 (원)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none tabular-nums"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
          <input
            type="text" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={80}
            placeholder="사용처 (예: ○○동물병원 구조묘 치료비)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
          <input
            type="text" inputMode="numeric" value={neuteredCount}
            onChange={(e) => setNeuteredCount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="중성화 마릿수 (없으면 비워두세요)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none tabular-nums"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
          {/* 세무 증빙 — 기부금 vs 판촉비 분류 근거 (2026-08-29 법률감사 M5) */}
          <input
            type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={200}
            placeholder="수령처 (단체·병원·개인명 — 세무 증빙용, 선택)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
          <input
            type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} maxLength={500}
            placeholder="증빙 링크 (계좌이체 내역·영수증 URL — 선택)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
          <input
            type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
        </div>
        {error && <p className="text-[11px] mt-2" style={{ color: "#D85555" }}>{error}</p>}
        <button
          onClick={submit} disabled={saving || !amount || !memo.trim()}
          className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-40 press transition-transform"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />} 등록
        </button>
      </div>

      {/* 내역 */}
      <h2 className="text-[15px] font-bold text-text-main mb-2 px-1">지출 내역 ({items.length})</h2>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-[13px] text-text-light text-center py-6">아직 등록된 지출이 없어요.</p>
        ) : items.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "#fff", border: "1px solid var(--color-divider)" }}>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-text-main truncate">{d.memo}</p>
              <p className="text-[11px] text-text-light">
                {d.spent_at}
                {d.neutered_count > 0 && <> · ✂️ {d.neutered_count}마리</>}
              </p>
            </div>
            <span className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: "var(--color-like)" }}>-{won(d.amount)}</span>
            <button onClick={() => remove(d.id)} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center press-strong" style={{ background: "rgba(216,85,85,0.1)" }} aria-label="삭제">
              <Trash2 size={14} style={{ color: "#D85555" }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
