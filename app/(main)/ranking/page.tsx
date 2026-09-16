// 길집사 활동 랭킹 페이지
// 활동 점수: cat * 10 + comment + alert * 2 + likes_received * 2 + care_log * 2
// Top 50 + 본인 순위 (50위 밖이면 별도 표시)

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, PawPrint, MessageCircle, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTopCaretakersServer, getMyRankServer, type RankingRow } from "@/lib/ranking-repo";
import { computeLevel, thumbnailUrl } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import RankShareButton from "@/app/components/RankShareButton";

export const metadata: Metadata = {
  title: "길집사 활동 랭킹",
  description: "도시공존 전체 길집사 활동 점수 순위. 등록·기록·돌봄 점수 합산.",
  robots: { index: false, follow: false },
};

export const revalidate = 600; // 10분 ISR

export default async function RankingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const top = await getTopCaretakersServer(50);
  const myRank = user ? await getMyRankServer(user.id) : null;
  const inTop = top.some((r) => r.user_id === user?.id);

  // 내 순위 자랑 배너용 — Top50 안이면 그 행, 밖이면 myRank
  const myRow = user ? top.find((r) => r.user_id === user.id) : undefined;
  const myRankNumber = myRow?.rank ?? myRank?.rank ?? null;
  const myScore = myRow?.score ?? myRank?.score ?? 0;
  const isTop3 = myRankNumber !== null && myRankNumber <= 3;

  return (
    <div className="pb-24 min-h-screen" style={{ background: "var(--color-surface)" }}>
      {/* 헤더 */}
      <div className="px-5 pt-12 pb-5">
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-sub mb-3"
        >
          <ArrowLeft size={14} />
          마이페이지
        </Link>
        <h1 className="text-[24px] font-bold text-text-main mb-1">
          길집사 활동 랭킹
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed">
          등록·돌봄 기록·좋아요로 점수가 쌓여요.
        </p>
      </div>

      {/* 점수 산식 안내 (접기) */}
      <div className="px-4 mb-3">
        <details className="card px-4 py-3">
          <summary className="text-[13px] font-semibold text-text-main cursor-pointer list-none flex items-center justify-between">
            <span>점수는 어떻게 계산되나요?</span>
            <span className="text-text-light text-[13px]">+</span>
          </summary>
          <ul className="text-[13px] text-text-sub mt-2.5 leading-relaxed space-y-0.5">
            <li>· 고양이 등록 — 1마리 +10점</li>
            <li>· 돌봄 기록 (댓글) — 1건 +1점</li>
            <li>· 위급 경보 — 1건 +2점 추가</li>
            <li>· 받은 좋아요 — 1개 +2점</li>
            <li>· 돌봄다이어리 — 1건 +2점</li>
          </ul>
        </details>
      </div>

      {/* Top 3 */}
      {top.length >= 3 && (
        <div className="px-4 mb-4">
          <div className="grid grid-cols-3 gap-2">
            <PodiumCard row={top[0]} place={1} />
            <PodiumCard row={top[1]} place={2} />
            <PodiumCard row={top[2]} place={3} />
          </div>
        </div>
      )}

      {/* 내 순위 + 자랑하기 */}
      {user && myRankNumber !== null && (
        <div className="px-4 mb-4">
          <div className="card px-4 py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-text-sub">이번 주 내 순위</p>
              <p className="text-[15px] font-semibold text-text-main leading-tight mt-0.5">
                {myRankNumber}위{isTop3 ? " · TOP 3" : ""}
                <span className="text-[13px] font-medium text-text-sub"> · {myScore.toLocaleString()}점</span>
              </p>
            </div>
            <RankShareButton rank={myRankNumber} score={myScore} top3={isTop3} />
          </div>
        </div>
      )}

      {/* 4위 이하 리스트 */}
      <div className="px-4">
        {top.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-[15px] font-semibold text-text-main">아직 랭킹이 없어요</p>
            <p className="text-[13px] text-text-sub mt-1">
              가장 먼저 고양이를 등록해보세요.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center mt-3 px-4 h-10 rounded-lg text-[13px] font-semibold press"
              style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
            >
              지도로 가기
            </Link>
          </div>
        )}

        {top.length > 3 && (
          <div className="card px-3">
            {top.slice(3).map((row) => (
              <RankRow key={row.user_id} row={row} highlight={row.user_id === user?.id} />
            ))}
          </div>
        )}
      </div>

      {/* 본인이 Top 50 밖일 때 본인 순위 표시 */}
      {user && myRank && !inTop && (
        <div className="px-4 mt-4">
          <div className="text-[13px] font-semibold text-text-sub mb-1.5 px-1">
            내 순위
          </div>
          <div className="card px-3">
            <RankRow
              row={{
                user_id: myRank.user_id,
                nickname: myRank.nickname,
                avatar_url: myRank.avatar_url,
                cat_count: myRank.cat_count,
                comment_count: myRank.comment_count,
                care_count: myRank.care_count,
                likes_received: 0,
                score: myRank.score,
                rank: myRank.rank,
              }}
              highlight
            />
          </div>
          <p className="text-[13px] text-text-sub text-center mt-2">
            전체 {myRank.total_users.toLocaleString()}명 중 {myRank.rank.toLocaleString()}위
          </p>
        </div>
      )}

      {/* 비로그인 안내 */}
      {!user && (
        <div className="px-4 mt-4">
          <Link
            href="/login?next=/ranking"
            className="card block px-4 py-3.5 text-center press"
          >
            <p className="text-[15px] font-semibold text-text-main">
              로그인하면 내 순위도 보여요
            </p>
            <p className="text-[13px] text-text-sub mt-0.5">
              지금 시작하면 여기 오를 수 있어요
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Top 3 카드 — 색 채움·메달 없이 순위 숫자 + 원형 아바타 ──
function PodiumCard({ row, place }: { row: RankingRow; place: 1 | 2 | 3 }) {
  const level = computeLevel(row.score);
  const rawPhoto = sanitizeImageUrl(row.avatar_url, "");
  const photo = thumbnailUrl(rawPhoto, 96) ?? rawPhoto;

  return (
    <Link
      href={`/users/${row.user_id}`}
      className="card block px-2 pt-3 pb-3 press-strong transition-transform"
    >
      <div className="flex flex-col items-center text-center">
        <span
          className="text-[11px] font-semibold px-1.5 py-0.5 chip-square mb-2"
          style={{
            background: place === 1 ? "var(--color-primary)" : "var(--color-gray-100)",
            color: place === 1 ? "var(--color-surface)" : "var(--color-text-sub)",
          }}
        >
          {place}위
        </span>
        {photo ? (
          <Image
            src={photo}
            alt={row.nickname ?? "길집사"}
            width={48}
            height={48}
            className="rounded-full object-cover"
            style={{ border: "1px solid var(--color-border)" }}
            unoptimized
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-text-light"
            style={{ background: "var(--color-gray-100)" }}
          >
            <PawPrint size={18} />
          </div>
        )}
        <p className="text-[13px] font-semibold text-text-main mt-1.5 truncate max-w-full px-1">
          {row.nickname ?? "익명"}
        </p>
        <p className="text-[11px] text-text-light">
          {level.title}
        </p>
        <p className="text-[15px] font-semibold tabular-nums mt-1 text-text-main">
          {row.score.toLocaleString()}
          <span className="text-[11px] font-medium text-text-sub ml-0.5">점</span>
        </p>
      </div>
    </Link>
  );
}

// ── 4위 이하 일반 행 (구분선 리스트) ──
function RankRow({ row, highlight }: { row: RankingRow; highlight?: boolean }) {
  const level = computeLevel(row.score);
  const rawPhoto = sanitizeImageUrl(row.avatar_url, "");
  const photo = thumbnailUrl(rawPhoto, 72) ?? rawPhoto;
  return (
    <Link
      href={`/users/${row.user_id}`}
      className="flex items-center gap-3 px-1 py-3 press transition-transform border-b border-divider last:border-b-0"
      style={{ minHeight: 56, background: highlight ? "var(--color-gray-50)" : undefined }}
    >
      <div className="w-8 text-center text-[15px] font-semibold tabular-nums shrink-0 text-text-sub">
        {row.rank}
      </div>
      {photo ? (
        <Image
          src={photo}
          alt={row.nickname ?? "길집사"}
          width={36}
          height={36}
          className="rounded-full object-cover shrink-0"
          style={{ border: "1px solid var(--color-border)" }}
          unoptimized
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-text-light"
          style={{ background: "var(--color-gray-100)" }}
        >
          <PawPrint size={14} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-main truncate">
          {row.nickname ?? "익명"}
        </p>
        <p className="text-[13px] text-text-sub mt-0.5">
          {level.title}
        </p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="flex items-center gap-0.5 text-[11px] text-text-light">
          <PawPrint size={11} /> {row.cat_count}
        </span>
        <span className="flex items-center gap-0.5 text-[11px] text-text-light">
          <MessageCircle size={11} /> {row.comment_count}
        </span>
        <span className="flex items-center gap-0.5 text-[11px] text-text-light">
          <Heart size={11} /> {row.likes_received ?? 0}
        </span>
      </div>
      <div className="text-[15px] font-semibold tabular-nums shrink-0 ml-1 text-text-main">
        {row.score.toLocaleString()}
      </div>
    </Link>
  );
}
