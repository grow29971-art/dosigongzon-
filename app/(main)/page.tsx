"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Eye, MessageCircle, Sparkles } from "lucide-react";
import type { Post } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { getPosts, formatRelativeTime } from "@/lib/store";

const CAT_FACTS = [
  "고양이는 하루 평균 14시간 이상 잠을 자요.",
  "고양이의 골골송은 사람의 뼈 재생을 돕는 주파수와 비슷해요.",
  "고양이의 코 무늬는 사람의 지문처럼 모두 달라요.",
  "고양이가 눈을 천천히 깜빡이는 건 '사랑해'라는 뜻이에요.",
  "고양이는 자신의 키보다 5배 높이 점프할 수 있어요.",
  "고양이의 귀 근육은 32개나 돼서 자유자재로 움직여요.",
  "고양이가 배를 보여주는 건 당신을 믿는다는 최고의 표현이에요.",
  "삼색 고양이는 99% 확률로 암컷이에요.",
  "꼬리를 바짝 세우고 다가오는 건 반갑다는 뜻이에요.",
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "좋은 새벽이에요 🌙";
  if (h < 12) return "좋은 아침이에요 ☀️";
  if (h < 18) return "좋은 오후예요 🌤";
  return "좋은 저녁이에요 🌆";
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [fact, setFact] = useState("");
  const [greeting, setGreeting] = useState("안녕하세요");

  useEffect(() => {
    setMounted(true);
    setPosts(getPosts().slice(0, 4));
    setFact(CAT_FACTS[Math.floor(Math.random() * CAT_FACTS.length)]);
    setGreeting(getGreeting());
  }, []);

  if (!mounted) return null;

  return (
    <div className="px-5 pt-14 pb-4">
      {/* ── 인사 ── */}
      <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">{greeting}</h1>
      <p className="text-sm text-text-sub mt-1">오늘도 길고양이를 위해 함께해요</p>

      {/* ── 긴급 SOS 배너 ── */}
      <Link href="/community" className="block mt-5">
        <div
          className="flex items-center justify-between rounded-[32px] py-4 px-5 active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #D32F2F, #E53935)", boxShadow: "0 6px 16px rgba(211,47,47,0.2)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <AlertTriangle size={22} color="#fff" />
            </div>
            <div>
              <p className="text-[17px] font-extrabold text-white">🚨 긴급 SOS</p>
              <p className="text-xs text-red-200 font-medium">긴급 제보 · 구조/치료 기록</p>
            </div>
          </div>
          <ChevronRight size={20} color="#FFCCBB" />
        </div>
      </Link>

      {/* ── 냥식 ── */}
      <div className="card p-5 mt-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary tracking-wide mb-1">오늘의 냥식</p>
            <p className="text-[15px] font-semibold text-text-main leading-relaxed">{fact}</p>
          </div>
        </div>
      </div>

      {/* ── 퀵 액션 ── */}
      <div className="grid grid-cols-4 gap-2.5 mt-5">
        {(["emergency", "foster", "care", "lost"] as const).map((cat) => {
          const info = CATEGORY_MAP[cat];
          return (
            <Link key={cat} href="/community" className="card-sm flex flex-col items-center gap-1.5 py-4 active:scale-95 transition-transform">
              <span className="text-xl">{info.emoji}</span>
              <span className="text-[11px] font-semibold text-text-main">{info.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── 최근 게시글 ── */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-text-main">최근 게시글</h2>
          <Link href="/community" className="text-xs font-semibold text-primary">전체보기</Link>
        </div>
        <div className="space-y-2.5">
          {posts.map((post) => {
            const cat = CATEGORY_MAP[post.category];
            return (
              <Link key={post.id} href={`/community/${post.id}`} className="block card-sm p-4 active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-lg" style={{ backgroundColor: cat.color }}>
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-text-light">{formatRelativeTime(post.createdAt)}</span>
                </div>
                <p className="text-[15px] font-semibold text-text-main leading-snug truncate">{post.title}</p>
                <div className="flex items-center gap-3 mt-2 text-text-light">
                  <span className="text-xs">{post.authorName}</span>
                  <span className="flex items-center gap-0.5 text-xs"><Eye size={12} /> {post.viewCount}</span>
                  <span className="flex items-center gap-0.5 text-xs"><MessageCircle size={12} /> {post.commentCount}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── 공지 배너 ── */}
      <div className="mt-6 rounded-2xl p-4 flex items-center gap-3" style={{ background: "linear-gradient(to right, #2D2D2D, #3D3D3D)" }}>
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-lg">🐾</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white">도시공존 커뮤니티 오픈!</p>
          <p className="text-[11px] text-white/60 mt-0.5">함께 만들어가는 길고양이 돌봄 네트워크</p>
        </div>
      </div>
    </div>
  );
}
