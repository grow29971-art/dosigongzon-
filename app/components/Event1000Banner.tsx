// 가입자 1000명 달성 이벤트 배너 (2026-04-25 시작).
// - 1000명 달성 시 추첨으로 20명에게 "돌보는 길고양이 모양 키링" 증정
// - profiles count 가져와 진행률 시각화
// - 서버 컴포넌트, SSR로 즉시 렌더 (LCP·SEO 이득)
// - 1000명 달성 후엔 "추첨 진행 중" 모드로 자동 전환
// 2026-09-16 「익숙한 동네앱」 리디자인: 그라디언트 배너 → 흰 면 + 헤어라인, 진행바 primary.

import Link from "next/link";
import { Gift, ArrowRight, Users } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";

const TARGET = 1000;
const PRIZES = 20;

async function getCounts(): Promise<{ userCount: number; entryCount: number }> {
  try {
    const supabase = createAnonClient();
    const [users, entries] = await Promise.all([
      supabase.from("profiles_public").select("id", { count: "exact", head: true }),
      supabase.from("event_keyring_entries").select("*", { count: "exact", head: true }),
    ]);
    return {
      userCount: users.count ?? 0,
      entryCount: entries.count ?? 0,
    };
  } catch {
    return { userCount: 0, entryCount: 0 };
  }
}

export default async function Event1000Banner() {
  const { userCount, entryCount } = await getCounts();
  const reached = userCount >= TARGET;
  const remaining = Math.max(0, TARGET - userCount);
  const percent = Math.min(100, Math.round((userCount / TARGET) * 100));

  return (
    <section className="px-5 mt-5">
      <div
        className="p-4"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* 상단 라벨 */}
        <p className="text-[11px] font-medium text-text-light mb-1">
          {reached ? "TARGET REACHED · 추첨 진행 중" : "GRAND OPENING EVENT"}
        </p>

        {/* 메인 카피 */}
        <h2 className="text-[20px] font-bold text-text-main leading-snug">
          {reached ? (
            <>가입자 1,000명 달성!<br />추첨 곧 발표</>
          ) : (
            <>가입자 1,000명 달성하면<br />아크릴 키링</>
          )}
        </h2>

        {/* 설명 */}
        <p className="text-[13px] mt-2 leading-relaxed text-text-sub">
          {reached
            ? "당첨자에게 등록된 이메일·쪽지로 곧 안내드릴게요."
            : `돌보는 길고양이를 등록하고 응모하면 그 아이 모양 키링을 ${PRIZES}명에게 추첨으로 보내드려요.`}
        </p>

        {/* 진행률 */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[20px] font-bold tabular-nums text-text-main">
              {userCount.toLocaleString()}
              <span className="text-[13px] font-medium text-text-light"> / {TARGET.toLocaleString()}명</span>
            </span>
            {!reached && (
              <span className="text-[11px] text-text-light">
                {remaining.toLocaleString()}명 남음
              </span>
            )}
          </div>
          <div className="progress-bar">
            <div style={{ width: `${percent}%`, background: "var(--color-primary)" }} />
          </div>
        </div>

        {/* 상품 정보 */}
        <div
          className="mt-4 pt-3 flex items-center gap-3"
          style={{ borderTop: "1px solid var(--color-divider)" }}
        >
          <Gift size={20} className="shrink-0" style={{ color: "var(--color-text-light)" }} strokeWidth={1.8} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-text-main leading-snug">
              길고양이 아크릴 키링
            </p>
            <p className="text-[13px] mt-0.5 leading-snug text-text-sub">
              내가 등록·돌본 길고양이 모양으로 제작
            </p>
          </div>
          {entryCount > 0 && (
            <div className="shrink-0 flex items-center gap-1 text-text-light">
              <Users size={12} />
              <span className="text-[11px] font-medium tabular-nums">
                {entryCount.toLocaleString()}명
              </span>
            </div>
          )}
        </div>

        {/* CTA — 응모 페이지로. 비로그인이면 거기서 로그인 유도 */}
        {!reached && (
          <Link
            href="/event/keyring"
            className="mt-4 w-full h-10 flex items-center justify-center gap-1.5 text-[15px] font-semibold press-strong transition-transform"
            style={{ borderRadius: "var(--radius-input)", background: "var(--color-primary)", color: "var(--color-surface)" }}
          >
            응모하기
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </section>
  );
}
