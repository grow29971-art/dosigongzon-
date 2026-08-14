"use client";

// 후원금 투명 정산 위젯 (2026-07-15)
// 모인 금액 / 쓰인 금액 / 잔액 + 최근 지출 내역. 실제 데이터만 표시.
// 아직 집계 전(모인·쓰인 모두 0)이면 "오픈 후 집계" 안내로 정직하게.

import { useEffect, useState } from "react";

interface Settlement {
  collected: number;
  spent: number;
  balance: number;
  disbursements: { amount: number; memo: string; spent_at: string }[];
  /** 지도에 등록된 개체 중 중성화가 확인된 수 (후원금 집행 실적과는 별개) */
  neuteredCount?: number;
}

const won = (n: number) => `${n.toLocaleString()}원`;

export default function FundSettlementCard() {
  const [data, setData] = useState<Settlement | null>(null);

  useEffect(() => {
    fetch("/api/shop/fund-settlement")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  if (!data) return null;
  const { collected, spent, balance, disbursements } = data;
  const neuteredCount = data.neuteredCount ?? 0;
  const empty = collected === 0 && spent === 0;

  return (
    <div
      className="mb-4 px-4 py-4 rounded-3xl"
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "var(--shadow-card-sm)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-extrabold text-text-main tracking-tight">💛 후원금 투명 정산</h3>
        <span className="text-[11px] font-bold text-text-light">실시간 공개</span>
      </div>

      {/* 3분할 요약 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "모인 금액", value: collected, color: "#22A366" },
          { label: "쓰인 금액", value: spent, color: "var(--color-like)" },
          { label: "잔액", value: balance, color: "var(--color-primary)" },
        ].map((s) => (
          <div key={s.label} className="text-center py-2.5 rounded-2xl" style={{ background: "var(--color-surface-alt)" }}>
            <p className="text-[11px] font-bold text-text-light mb-0.5">{s.label}</p>
            <p className="text-[15px] font-black tabular-nums" style={{ color: s.color }}>
              {s.value.toLocaleString()}
              <span className="text-[9px] font-bold text-text-light">원</span>
            </p>
          </div>
        ))}
      </div>

      {/* 후원금으로 실제 중성화한 마릿수. 집행 전이라 0이며, 0을 숨기지 않는다 —
          모인 금액 옆에 성과를 함께 두는 것이 투명 정산의 취지다. */}
      <div
        className="mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl"
        style={{ background: "rgba(107,142,111,0.10)", border: "1px solid rgba(107,142,111,0.22)" }}
      >
        <span className="text-[13px]">✂️</span>
        <span className="text-[11px] font-bold text-text-sub">후원금으로 중성화한 아이</span>
        <span className="text-[15px] font-black tabular-nums" style={{ color: "#4F6B53" }}>
          {neuteredCount.toLocaleString()}
        </span>
        <span className="text-[11px] font-bold text-text-sub">마리</span>
      </div>

      {empty ? (
        <p className="text-[11px] text-text-light text-center mt-3 leading-relaxed">
          정식 오픈 후 첫 구매부터 집계를 시작해요.<br />모인 금액과 쓰인 금액을 여기서 투명하게 공개할게요.
        </p>
      ) : (
        <>
          {disbursements.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-bold text-text-sub mb-1.5">최근 사용 내역</p>
              <div className="flex flex-col gap-1">
                {disbursements.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px]">
                    <span className="text-text-light tabular-nums shrink-0">{d.spent_at.slice(5).replace("-", ".")}</span>
                    <span className="text-text-main truncate flex-1">{d.memo}</span>
                    <span className="font-extrabold tabular-nums shrink-0" style={{ color: "var(--color-like)" }}>-{won(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* "나머지는 전부"처럼 총량을 단정하는 표현은 실제 로직(상품별 후원 비율)과
              어긋나 표시광고법상 과장으로 읽힐 수 있다. 실제 계산과 1:1로 대응하는
              문장만 쓴다. (2026-08-07 법률 검토) */}
          <p className="text-[11px] text-text-light mt-2.5">
            일반 상품은 결제 금액의 5%, 전액 후원 상품은 100%가 이 금액에 쌓여요.
          </p>
        </>
      )}
    </div>
  );
}
