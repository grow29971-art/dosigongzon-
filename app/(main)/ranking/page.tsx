// 케어테이커 활동 랭킹 페이지
// 활동 점수: cat * 10 + comment + alert * 2 + likes_received * 2 + care_log * 2
// Top 50 + 본인 순위 (50위 밖이면 별도 표시)

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Trophy, Medal, Award, PawPrint, MessageCircle, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTopCaretakersServer, getMyRankServer, type RankingRow } from "@/lib/ranking-repo";
import { computeLevel, getLevelColor, thumbnailUrl } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import RankShareButton from "@/app/components/RankShareButton";

export const metadata: Metadata = {
  title: "케어테이커 활동 랭킹",
  description: "도시공존 전체 케어테이커 활동 점수 순위. 등록·기록·돌봄 점수 합산.",
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
    <div className="pb-24 min-h-screen" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-5 pt-12 pb-5">
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3"
        >
          <ArrowLeft size={14} />
          마이페이지
        </Link>
        <div className="flex items-baseline gap-2 mb-1">
          <Trophy size={20} style={{ color: "#C9A961" }} />
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-main">
            케어테이커 활동 랭킹
          </h1>
        </div>
        <p className="text-[12.5px] text-text-sub leading-relaxed">
          등록·돌봄 기록·좋아요로 점수가 쌓여요. 매일 새로운 동네 케어테이커를 만나보세요.
        </p>
      </div>

      {/* 점수 산식 안내 (접기) */}
      <div className="px-4 mb-3">
        <details
          className="rounded-2xl px-4 py-3 bg-white"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <summary className="text-[12px] font-extrabold text-text-main cursor-pointer list-none flex items-center justify-between">
            <span>점수는 어떻게 계산되나요?</span>
            <span className="text-text-light text-[12px]">+</span>
          </summary>
          <ul className="text-[11.5px] text-text-sub mt-2.5 leading-relaxed space-y-0.5">
            <li>· 고양이 등록 — 1마리 +10점</li>
            <li>· 돌봄 기록 (댓글) — 1건 +1점</li>
            <li>· 위급 경보 — 1건 +2점 추가</li>
            <li>· 받은 좋아요 — 1개 +2점</li>
            <li>· 돌봄다이어리 — 1건 +2점</li>
          </ul>
        </details>
      </div>

      {/* Top 3 시상대 */}
      {top.length >= 3 && (
        <div className="px-4 mb-4">
          <div className="grid grid-cols-3 gap-2 items-end">
            {/* 2위 */}
            <PodiumCard row={top[1]} place={2} height={130} />
            {/* 1위 — 가운데, 더 높음 */}
            <PodiumCard row={top[0]} place={1} height={155} />
            {/* 3위 */}
            <PodiumCard row={top[2]} place={3} height={115} />
          </div>
        </div>
      )}

      {/* 내 순위 + 자랑하기 배너 */}
      {user && myRankNumber !== null && (
        <div className="px-4 mb-4">
          <div
            className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
            style={{
              background: isTop3 ? "linear-gradient(135deg, #FFF6D6 0%, #F7E69C 100%)" : "#FFFFFF",
              border: isTop3 ? "1.5px solid rgba(201,169,97,0.55)" : "1px solid rgba(0,0,0,0.05)",
              boxShadow: isTop3 ? "0 6px 18px rgba(201,169,97,0.25)" : "0 4px 14px rgba(0,0,0,0.05)",
            }}
          >
            <div className="text-[26px] leading-none shrink-0">{isTop3 ? "🎉" : "🐾"}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold tracking-[0.15em]" style={{ color: isTop3 ? "#A9851F" : "var(--color-primary-dark)" }}>
                이번 주 내 순위
              </p>
              <p className="text-[15px] font-extrabold text-text-main leading-tight mt-0.5">
                {myRankNumber}위{isTop3 ? " · TOP 3 🏆" : ""}
                <span className="text-[12px] font-bold text-text-sub"> · {myScore.toLocaleString()}점</span>
              </p>
            </div>
            <RankShareButton rank={myRankNumber} score={myScore} top3={isTop3} />
          </div>
        </div>
      )}

      {/* 4위 이하 리스트 */}
      <div className="px-4 space-y-1.5">
        {top.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center bg-white"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <p className="text-[13px] font-bold text-text-main">아직 랭킹이 없어요</p>
            <p className="text-[11.5px] text-text-sub mt-1">
              가장 먼저 고양이를 등록하고 1위가 되어보세요!
            </p>
            <Link
              href="/map"
              className="inline-block mt-3 px-4 py-2 rounded-xl text-[12px] font-extrabold text-white"
              style={{ background: "var(--color-primary)" }}
            >
              지도로 가기
            </Link>
          </div>
        )}

        {top.slice(3).map((row) => (
          <RankRow key={row.user_id} row={row} highlight={row.user_id === user?.id} />
        ))}
      </div>

      {/* 본인이 Top 50 밖일 때 본인 순위 표시 */}
      {user && myRank && !inTop && (
        <div className="px-4 mt-4">
          <div className="text-[10.5px] font-extrabold tracking-[0.15em] text-text-sub mb-1.5 px-1">
            내 순위
          </div>
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
          <p className="text-[10.5px] text-text-sub text-center mt-2">
            전체 {myRank.total_users.toLocaleString()}명 중 {myRank.rank.toLocaleString()}위
          </p>
        </div>
      )}

      {/* 비로그인 안내 */}
      {!user && (
        <div className="px-4 mt-4">
          <Link
            href="/login?next=/ranking"
            className="block rounded-2xl px-4 py-3.5 text-center bg-white"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <p className="text-[12.5px] font-extrabold text-text-main">
              로그인하면 내 순위도 보여요
            </p>
            <p className="text-[10.5px] text-text-sub mt-0.5">
              지금 시작하면 여기 오를 수 있어요 🐾
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Top 3 시상대 카드 ──
function PodiumCard({ row, place, height }: { row: RankingRow; place: 1 | 2 | 3; height: number }) {
  const level = computeLevel(row.score);
  const rawPhoto = sanitizeImageUrl(row.avatar_url, "");
  const photo = thumbnailUrl(rawPhoto, 96) ?? rawPhoto;
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  const bg =
    place === 1
      ? "linear-gradient(180deg, #FFF6D6 0%, #F7E69C 100%)"
      : place === 2
        ? "linear-gradient(180deg, #F2F2F2 0%, #DCDCDC 100%)"
        : "linear-gradient(180deg, #FCE7D2 0%, #E8C9A0 100%)";
  const border =
    place === 1
      ? "rgba(201,169,97,0.6)"
      : place === 2
        ? "rgba(160,160,160,0.6)"
        : "rgba(49,130,246,0.5)";

  return (
    <Link
      href={`/users/${row.user_id}`}
      className="block rounded-2xl px-2 pt-3 pb-3 active:scale-[0.97] transition-transform relative"
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        minHeight: height,
        boxShadow: place === 1 ? "0 8px 22px rgba(201,169,97,0.30)" : "0 4px 14px rgba(0,0,0,0.06)",
      }}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[24px] leading-none select-none">
        {medal}
      </div>
      <div className="flex flex-col items-center text-center pt-3">
        {photo ? (
          <Image
            src={photo}
            alt={row.nickname ?? "케어테이커"}
            width={48}
            height={48}
            className="rounded-full object-cover"
            style={{ border: `2.5px solid ${border}` }}
            unoptimized
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[18px]"
            style={{ background: "#FFF", border: `2.5px solid ${border}` }}
          >
            🐾
          </div>
        )}
        <p className="text-[11.5px] font-extrabold text-text-main mt-1.5 truncate max-w-full px-1">
          {row.nickname ?? "익명"}
        </p>
        <p
          className="text-[9.5px] font-bold tracking-tight"
          style={{ color: getLevelColor(level.level) }}
        >
          {level.emoji} {level.title}
        </p>
        <p className="text-[14px] font-extrabold tabular-nums mt-1" style={{ color: "#2A2A28" }}>
          {row.score.toLocaleString()}
          <span className="text-[10px] font-bold opacity-70 ml-0.5">점</span>
        </p>
      </div>
    </Link>
  );
}

// ── 4위 이하 일반 행 ──
function RankRow({ row, highlight }: { row: RankingRow; highlight?: boolean }) {
  const level = computeLevel(row.score);
  const rawPhoto = sanitizeImageUrl(row.avatar_url, "");
  const photo = thumbnailUrl(rawPhoto, 72) ?? rawPhoto;
  return (
    <Link
      href={`/users/${row.user_id}`}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 active:scale-[0.99] transition-transform"
      style={{
        background: highlight ? "#FFF3DC" : "#FFFFFF",
        border: highlight ? "1.5px solid rgba(201,169,97,0.5)" : "1px solid rgba(0,0,0,0.04)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="w-8 text-center text-[14px] font-extrabold tabular-nums shrink-0"
        style={{ color: row.rank <= 10 ? "#C9A961" : "#8B7562" }}
      >
        {row.rank}
      </div>
      {photo ? (
        <Image
          src={photo}
          alt={row.nickname ?? "케어테이커"}
          width={36}
          height={36}
          className="rounded-full object-cover shrink-0"
          style={{ border: `1.5px solid ${getLevelColor(level.level)}` }}
          unoptimized
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] shrink-0"
          style={{ background: "#F6F1EA", border: `1.5px solid ${getLevelColor(level.level)}` }}
        >
          🐾
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-extrabold text-text-main truncate">
          {row.nickname ?? "익명"}
        </p>
        <p
          className="text-[10.5px] font-bold mt-0.5"
          style={{ color: getLevelColor(level.level) }}
        >
          {level.emoji} {level.title}
        </p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="flex items-center gap-0.5 text-[10.5px] text-text-sub">
          <PawPrint size={10} /> {row.cat_count}
        </span>
        <span className="flex items-center gap-0.5 text-[10.5px] text-text-sub">
          <MessageCircle size={10} /> {row.comment_count}
        </span>
        <span className="flex items-center gap-0.5 text-[10.5px] text-text-sub">
          <Heart size={10} /> {row.likes_received ?? 0}
        </span>
      </div>
      <div
        className="text-[14px] font-extrabold tabular-nums shrink-0 ml-1"
        style={{ color: "#2A2A28" }}
      >
        {row.score.toLocaleString()}
      </div>
    </Link>
  );
}
