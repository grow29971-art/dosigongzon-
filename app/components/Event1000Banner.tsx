// 가입자 1000명 달성 이벤트 배너 (2026-04-25 시작).
// - 1000명 달성 시 추첨으로 20명에게 "돌보는 길고양이 모양 키링" 증정
// - profiles count 가져와 진행률 시각화
// - 서버 컴포넌트, SSR로 즉시 렌더 (LCP·SEO 이득)
// - 1000명 달성 후엔 "추첨 진행 중" 모드로 자동 전환

import Link from "next/link";
import { Gift, Sparkles, ArrowRight } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";

const TARGET = 1000;
const PRIZES = 20;

async function getUserCount(): Promise<number> {
  try {
    const supabase = createAnonClient();
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function Event1000Banner() {
  const userCount = await getUserCount();
  const reached = userCount >= TARGET;
  const remaining = Math.max(0, TARGET - userCount);
  const percent = Math.min(100, Math.round((userCount / TARGET) * 100));

  return (
    <section className="px-5 mt-5">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: reached
            ? "linear-gradient(135deg, #6B8E6F 0%, #4F6B53 100%)"
            : "linear-gradient(135deg, #C47E5A 0%, #A8684A 50%, #8E5440 100%)",
          boxShadow: reached
            ? "0 12px 32px rgba(107,142,111,0.30)"
            : "0 12px 32px rgba(196,126,90,0.30)",
        }}
      >
        <div className="p-5 text-white">
          {/* 상단 라벨 */}
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={13} className="text-white/90" />
            <span className="text-[10px] font-extrabold tracking-[0.15em] text-white/90">
              {reached ? "TARGET REACHED · 추첨 진행 중" : "GRAND OPENING EVENT"}
            </span>
          </div>

          {/* 메인 카피 */}
          <h2 className="text-[19px] font-extrabold tracking-tight leading-tight">
            {reached ? (
              <>가입자 1,000명 달성!<br />20명 추첨 곧 발표</>
            ) : (
              <>가입자 1,000명 달성하면<br />20명에게 아크릴 키링 🐾</>
            )}
          </h2>

          {/* 설명 */}
          <p className="text-[12px] mt-2 leading-relaxed text-white/90">
            {reached
              ? "당첨자에게 등록된 이메일·쪽지로 곧 안내드릴게요."
              : "여러분이 돌보는 길고양이 모양의 아크릴 키링을 추첨으로 보내드려요. 무료 가입만 해도 자동 응모 ✨"}
          </p>

          {/* 진행률 */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[22px] font-extrabold tabular-nums tracking-tight">
                {userCount.toLocaleString()}
                <span className="text-[12px] font-bold opacity-80"> / {TARGET.toLocaleString()}명</span>
              </span>
              {!reached && (
                <span className="text-[11px] font-bold opacity-90">
                  {remaining.toLocaleString()}명 남음
                </span>
              )}
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${percent}%`,
                  background: "linear-gradient(90deg, #FFFFFF 0%, #FFF8E1 100%)",
                  boxShadow: "0 0 8px rgba(255,255,255,0.6)",
                }}
              />
            </div>
          </div>

          {/* 상품 정보 */}
          <div
            className="mt-4 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
          >
            <Gift size={18} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-extrabold leading-tight">
                길고양이 아크릴 키링 · {PRIZES}명 추첨
              </p>
              <p className="text-[10.5px] mt-0.5 leading-snug opacity-90">
                내가 등록·돌본 길고양이 모양으로 제작
              </p>
            </div>
          </div>

          {/* CTA — 비로그인이면 가입 유도, 로그인이면 친구 초대 */}
          {!reached && (
            <Link
              href="/signup"
              className="mt-4 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-[13px] font-extrabold active:scale-[0.97] transition-transform"
              style={{ background: "#FFFFFF", color: "#A8684A" }}
            >
              지금 가입하고 응모하기
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
