"use client";

// 쇼핑 수익 사용처 투표 카드 (2026-07-14)
// 로그인 유저 1인 1표(변경 가능), 결과는 누구나 열람. 낙관적 UI로 즉시 반영.
// 마이그레이션(supabase_fund_vote_migration.sql) 전이면 조용히 렌더 안 함.

import { useEffect, useState } from "react";
import { loadFundVote, castFundVote, type FundVoteOption } from "@/lib/fund-vote-repo";
import { createInquiry } from "@/lib/support-repo";

export default function FundVoteCard() {
  const [ready, setReady] = useState(false);
  const [options, setOptions] = useState<FundVoteOption[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // 기타 아이디어 (관리자 인박스로 전송)
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [ideaDone, setIdeaDone] = useState(false);
  const [ideaErr, setIdeaErr] = useState("");

  useEffect(() => {
    loadFundVote()
      .then((s) => {
        if (s.options.length === 0) return; // 마이그레이션 전 → 숨김
        setOptions(s.options);
        setCounts(s.counts);
        setMyVote(s.myVote);
        setReady(true);
      })
      .catch(() => {});
  }, []);

  if (!ready) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const vote = async (optionId: string) => {
    if (busy || myVote === optionId) return;
    setBusy(true);
    setErr("");
    const prev = myVote;
    // 낙관적 반영
    setCounts((c) => {
      const next = { ...c };
      if (prev) next[prev] = Math.max(0, (next[prev] ?? 0) - 1);
      next[optionId] = (next[optionId] ?? 0) + 1;
      return next;
    });
    setMyVote(optionId);
    try {
      await castFundVote(optionId);
      try { navigator.vibrate?.(10); } catch { /* 미지원 */ }
    } catch (e) {
      // 롤백
      setCounts((c) => {
        const next = { ...c };
        next[optionId] = Math.max(0, (next[optionId] ?? 0) - 1);
        if (prev) next[prev] = (next[prev] ?? 0) + 1;
        return next;
      });
      setMyVote(prev);
      const msg = e instanceof Error ? e.message : "투표에 실패했어요.";
      setErr(msg.includes("로그인") ? "로그인하면 투표할 수 있어요." : "투표에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const sendIdea = async () => {
    const text = idea.trim();
    if (ideaBusy || !text) return;
    setIdeaBusy(true);
    setIdeaErr("");
    try {
      await createInquiry({ subject: "[수익 사용처 아이디어]", body: text });
      setIdeaDone(true);
      setIdea("");
      setIdeaOpen(false);
      try { navigator.vibrate?.(12); } catch { /* 미지원 */ }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "전송에 실패했어요.";
      setIdeaErr(msg.includes("로그인") ? "로그인하면 보낼 수 있어요." : "전송에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIdeaBusy(false);
    }
  };

  return (
    <div
      className="mb-4 px-4 py-4 rounded-3xl"
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "var(--shadow-card-sm)" }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <h3 className="text-[14px] font-extrabold text-text-main tracking-tight">🗳️ 수익, 어디에 쓸까요?</h3>
        <span className="text-[10.5px] font-bold text-text-light tabular-nums">{total.toLocaleString()}명 참여</span>
      </div>
      <p className="text-[11px] text-text-light mb-3">가장 많은 표를 받은 곳에 먼저 쓰여요 · 투표는 언제든 바꿀 수 있어요</p>

      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const c = counts[o.id] ?? 0;
          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
          const mine = myVote === o.id;
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={busy}
              className="relative w-full text-left px-3.5 py-2.5 rounded-2xl overflow-hidden active:scale-[0.99] transition-transform"
              style={{
                border: mine ? "1.5px solid var(--color-primary)" : "1px solid var(--color-divider)",
                background: "var(--color-surface-alt)",
              }}
            >
              {/* 득표율 배경 바 */}
              <span
                className="absolute inset-y-0 left-0 transition-all"
                style={{
                  width: `${pct}%`,
                  background: mine ? "var(--color-primary-soft)" : "rgba(0,0,0,0.04)",
                }}
              />
              <span className="relative flex items-center gap-2">
                <span className="text-[15px]">{o.emoji}</span>
                <span className={`text-[13px] ${mine ? "font-extrabold text-primary" : "font-bold text-text-main"}`}>
                  {o.label}
                </span>
                {mine && <span className="text-[10px] font-extrabold text-primary">✓ 내 선택</span>}
                <span className="ml-auto text-[12px] font-extrabold tabular-nums" style={{ color: mine ? "var(--color-primary)" : "var(--color-text-sub)" }}>
                  {pct}%
                </span>
              </span>
            </button>
          );
        })}

        {/* 기타 — 아이디어를 관리자에게 전송 (투표 아님) */}
        {ideaDone ? (
          <div className="px-3.5 py-3 rounded-2xl text-center" style={{ background: "var(--color-primary-soft)" }}>
            <p className="text-[12px] font-extrabold text-primary">💌 아이디어 고마워요! 잘 읽어볼게요</p>
          </div>
        ) : !ideaOpen ? (
          <button
            onClick={() => { setIdeaOpen(true); setIdeaErr(""); }}
            className="w-full text-left px-3.5 py-2.5 rounded-2xl active:scale-[0.99] transition-transform"
            style={{ border: "1px dashed var(--color-border)", background: "transparent" }}
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-text-sub">
              <span className="text-[15px]">💡</span>
              기타 — 아이디어를 저에게 보내주세요
            </span>
          </button>
        ) : (
          <div className="px-1 pt-1">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="수익을 이런 데 쓰면 좋겠어요… (자유롭게 적어주세요)"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl text-[12.5px] outline-none resize-none"
              style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
            />
            {ideaErr && <p className="text-[11px] mt-1" style={{ color: "#D85555" }}>{ideaErr}</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setIdeaOpen(false); setIdea(""); setIdeaErr(""); }}
                className="px-3.5 py-2 rounded-xl text-[12px] font-bold text-text-sub active:scale-95 transition-transform"
                style={{ background: "var(--color-surface-alt)" }}
              >
                취소
              </button>
              <button
                onClick={sendIdea}
                disabled={ideaBusy || !idea.trim()}
                className="flex-1 py-2 rounded-xl text-[12.5px] font-extrabold text-white active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
              >
                {ideaBusy ? "보내는 중…" : "보내기"}
              </button>
            </div>
          </div>
        )}
      </div>

      {err && <p className="text-[11px] mt-2" style={{ color: "#D85555" }}>{err}</p>}
    </div>
  );
}
