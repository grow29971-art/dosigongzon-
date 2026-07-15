"use client";

// 후원금 지출 관리 (관리자) — 정산 위젯의 "쓰인 금액"을 여기서 채운다.
// SQL 안 치고도 지출 등록/삭제. RLS로 관리자만 쓰기 가능.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, Shield } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { listDisbursements, createDisbursement, deleteDisbursement, type Disbursement } from "@/lib/fund-admin-repo";

const won = (n: number) => `${n.toLocaleString()}원`;
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export default function AdminFundPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Disbursement[]>([]);
  const [collected, setCollected] = useState<number | null>(null);

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [spentAt, setSpentAt] = useState(todayKst());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    setItems(await listDisbursements());
    try {
      const s = await (await fetch("/api/shop/fund-settlement")).json();
      setCollected(typeof s.collected === "number" ? s.collected : null);
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
      await createDisbursement({ amount: Number(amount), memo, spent_at: spentAt });
      setAmount(""); setMemo(""); setSpentAt(todayKst());
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

  if (!authChecked) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="px-4 pt-20 text-center">
        <Shield size={40} className="mx-auto text-text-light mb-3" />
        <p className="text-[14px] font-bold text-text-main">관리자만 접근할 수 있어요</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 pb-24 max-w-lg mx-auto">
      <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-[13px] text-text-sub mb-4 active:scale-95">
        <ArrowLeft size={16} /> 관리자
      </button>
      <h1 className="text-[22px] font-extrabold text-text-main tracking-tight mb-1">후원금 지출 관리</h1>
      <p className="text-[12.5px] text-text-sub mb-5">여기 등록한 지출이 쇼핑의 &lsquo;투명 정산&rsquo; 위젯에 바로 반영돼요.</p>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "모인 금액", value: collected ?? 0, color: "#22A366" },
          { label: "쓰인 금액", value: spent, color: "#E86B8C" },
          { label: "잔액", value: balance, color: "var(--color-primary)" },
        ].map((s) => (
          <div key={s.label} className="text-center py-3 rounded-2xl" style={{ background: "var(--color-surface-alt)" }}>
            <p className="text-[10px] font-bold text-text-light mb-0.5">{s.label}</p>
            <p className="text-[14px] font-black tabular-nums" style={{ color: s.color }}>{s.value.toLocaleString()}<span className="text-[9px] text-text-light">원</span></p>
          </div>
        ))}
      </div>

      {/* 등록 폼 */}
      <div className="p-4 rounded-2xl mb-5" style={{ background: "#fff", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-card-sm)" }}>
        <h2 className="text-[13.5px] font-extrabold text-text-main mb-3">지출 등록</h2>
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
            type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
          />
        </div>
        {error && <p className="text-[11px] mt-2" style={{ color: "#D85555" }}>{error}</p>}
        <button
          onClick={submit} disabled={saving || !amount || !memo.trim()}
          className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-extrabold disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />} 등록
        </button>
      </div>

      {/* 내역 */}
      <h2 className="text-[13.5px] font-extrabold text-text-main mb-2 px-1">지출 내역 ({items.length})</h2>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-[12px] text-text-light text-center py-6">아직 등록된 지출이 없어요.</p>
        ) : items.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "#fff", border: "1px solid var(--color-divider)" }}>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-text-main truncate">{d.memo}</p>
              <p className="text-[10.5px] text-text-light">{d.spent_at}</p>
            </div>
            <span className="text-[13px] font-extrabold tabular-nums shrink-0" style={{ color: "#E86B8C" }}>-{won(d.amount)}</span>
            <button onClick={() => remove(d.id)} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center active:scale-90" style={{ background: "rgba(216,85,85,0.1)" }} aria-label="삭제">
              <Trash2 size={14} style={{ color: "#D85555" }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
