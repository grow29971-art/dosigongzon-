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
  const empty = collected === 0 && spent === 0;

  return (
    <div
      className="mb-4 px-4 py-4 rounded-3xl"
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "var(--shadow-card-sm)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-extrabold text-text-main tracking-tight">💛 후원금 투명 정산</h3>
        <span className="text-[10px] font-bold text-text-light">실시간 공개</span>
      </div>

      {/* 3분할 요약 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "모인 금액", value: collected, color: "#22A366" },
          { label: "쓰인 금액", value: spent, color: "#E86B8C" },
          { label: "잔액", value: balance, color: "var(--color-primary)" },
        ].map((s) => (
          <div key={s.label} className="text-center py-2.5 rounded-2xl" style={{ background: "var(--color-surface-alt)" }}>
            <p className="text-[9.5px] font-bold text-text-light mb-0.5">{s.label}</p>
            <p className="text-[13.5px] font-black tabular-nums" style={{ color: s.color }}>
              {s.value.toLocaleString()}
              <span className="text-[9px] font-bold text-text-light">원</span>
            </p>
          </div>
        ))}
      </div>

      {empty ? (
        <p className="text-[10.5px] text-text-light text-center mt-3 leading-relaxed">
          정식 오픈 후 첫 구매부터 집계를 시작해요.<br />모인 금액과 쓰인 금액을 여기서 투명하게 공개할게요.
        </p>
      ) : (
        <>
          {disbursements.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-bold text-text-sub mb-1.5">최근 사용 내역</p>
              <div className="flex flex-col gap-1">
                {disbursements.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11.5px]">
                    <span className="text-text-light tabular-nums shrink-0">{d.spent_at.slice(5).replace("-", ".")}</span>
                    <span className="text-text-main truncate flex-1">{d.memo}</span>
                    <span className="font-extrabold tabular-nums shrink-0" style={{ color: "#E86B8C" }}>-{won(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-text-light mt-2.5">
            운영자는 서버 유지 등 최소한만 남기고, 나머지는 전부 아이들에게 써요.
          </p>
        </>
      )}
    </div>
  );
}
