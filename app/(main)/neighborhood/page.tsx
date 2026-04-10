"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Eye,
  Heart,
  MessageCircle,
  Plus,
  ChevronDown,
  ShieldAlert,
  X,
} from "lucide-react";
import type { Post } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import {
  getPosts,
  getPostsByRegion,
  getUserRegion,
  setUserRegion,
  formatRelativeTime,
} from "@/lib/store";

/* ═══ 동네 목록 (샘플) ═══ */
const REGIONS = [
  "역삼동", "합정동", "방배동", "이태원동", "성수동",
  "연남동", "망원동", "서교동", "삼성동", "잠실동",
  "신사동", "논현동", "청담동", "한남동", "이촌동",
];

export default function NeighborhoodPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [region, setRegion] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = getUserRegion();
    if (saved) {
      setRegion(saved);
      setPosts(getPostsByRegion(saved));
    } else {
      // 동네 설정 안 된 경우 전체 보여주되 선택 유도
      setPosts(getPosts());
      setShowPicker(true);
    }
  }, []);

  const selectRegion = (r: string) => {
    setRegion(r);
    setUserRegion(r);
    setPosts(getPostsByRegion(r));
    setShowPicker(false);
  };

  const handleWrite = () => {
    setShowWarning(true);
  };

  const confirmWrite = () => {
    setShowWarning(false);
    router.push("/community/write");
  };

  if (!mounted) return null;

  return (
    <div className="pb-4">
      {/* ── 헤더 ── */}
      <div className="px-5 pt-14 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 active:scale-90 transition-transform"
          >
            <ArrowLeft size={24} className="text-text-main" />
          </button>
          <h1 className="text-[20px] font-extrabold text-text-main">
            동네 소식
          </h1>
        </div>

        {/* 동네 선택 버튼 */}
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 active:scale-95 transition-transform"
        >
          <MapPin size={14} className="text-primary" />
          <span className="text-[13px] font-semibold text-primary">
            {region || "동네 설정"}
          </span>
          <ChevronDown size={14} className="text-primary" />
        </button>
      </div>

      {/* ── 동네 안내 ── */}
      {region && (
        <div className="px-5 mb-3">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary/5">
            <MapPin size={16} className="text-primary shrink-0" />
            <p className="text-[13px] text-text-sub">
              <strong className="text-text-main">{region}</strong> 주변의
              소식만 보여드려요
            </p>
          </div>
        </div>
      )}

      {/* ── 게시글 리스트 ── */}
      <div className="px-4 space-y-2.5">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center pt-20 text-text-light">
            <MapPin size={48} strokeWidth={1.2} />
            <p className="text-base mt-4 text-text-sub">
              {region
                ? `${region}에 아직 소식이 없어요`
                : "동네를 설정해주세요"}
            </p>
            <p className="text-[13px] mt-1">
              {region
                ? "첫 번째 동네 소식을 전해보세요!"
                : "상단의 동네 설정 버튼을 눌러주세요"}
            </p>
          </div>
        ) : (
          posts.map((post) => {
            const cat = CATEGORY_MAP[post.category];
            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="block"
              >
                <article className="card p-5 active:scale-[0.99] transition-transform">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-lg"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.emoji} {cat.label}
                    </span>
                    {post.region && (
                      <span className="text-[11px] text-primary font-medium flex items-center gap-0.5">
                        <MapPin size={10} /> {post.region}
                      </span>
                    )}
                    <span className="text-[11px] text-text-light">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-bold text-text-main leading-snug mb-1.5">
                    {post.title}
                  </h3>
                  <p className="text-[13px] text-text-sub leading-relaxed line-clamp-2 mb-3">
                    {post.content}
                  </p>
                  <div className="flex items-center gap-3 text-text-light text-xs">
                    <span className="font-medium text-text-sub">
                      {post.authorName}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Eye size={13} /> {post.viewCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart size={13} /> {post.likeCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MessageCircle size={13} /> {post.commentCount}
                    </span>
                  </div>
                </article>
              </Link>
            );
          })
        )}
      </div>

      {/* ── 글쓰기 FAB ── */}
      {region && (
        <button
          onClick={handleWrite}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-[20px] bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform z-40"
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </button>
      )}

      {/* ── 동네 선택 바텀시트 ── */}
      {showPicker && (
        <div className="fixed inset-0 z-[100] flex flex-col">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => region && setShowPicker(false)}
          />
          <div
            className="relative mt-auto w-full rounded-t-[32px] flex flex-col"
            style={{ maxHeight: "60dvh", backgroundColor: "#F5F3EE" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="px-5 py-3 border-b border-divider">
              <h2 className="text-[16px] font-bold text-text-main">
                내 동네 설정
              </h2>
              <p className="text-[12px] text-text-sub mt-0.5">
                해당 지역의 소식만 모아서 볼 수 있어요
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="grid grid-cols-3 gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => selectRegion(r)}
                    className={`py-3 rounded-2xl text-[13px] font-semibold transition-all active:scale-95 ${
                      r === region
                        ? "bg-primary text-white"
                        : "bg-white text-text-sub border border-border"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 위치 정보 주의 모달 ── */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowWarning(false)}
          />
          <div
            className="relative w-[85%] max-w-sm rounded-[28px] p-6"
            style={{ backgroundColor: "#F5F3EE" }}
          >
            <button
              onClick={() => setShowWarning(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-alt flex items-center justify-center"
            >
              <X size={16} className="text-text-sub" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-warning/20 flex items-center justify-center">
                <ShieldAlert size={24} className="text-warning" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-text-main">
                  위치 정보 주의
                </p>
                <p className="text-[11px] text-text-sub">
                  길고양이 안전을 위해 확인해주세요
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <p className="text-[13px] text-text-sub leading-relaxed">
                게시글에 <strong className="text-text-main">급식소나 숨숨집의 정확한 위치</strong>를
                공개하면 악의적인 사람에게 노출될 수 있어요.
              </p>
              <ul className="space-y-1.5 text-[13px] text-text-sub">
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">*</span>
                  정확한 주소 대신 <strong className="text-text-main">대략적인 위치</strong>만 적어주세요
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">*</span>
                  사진 속 <strong className="text-text-main">건물명, 간판</strong>이 보이지 않도록 주의해주세요
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">*</span>
                  급식 시간대는 <strong className="text-text-main">구체적으로 공개하지 마세요</strong>
                </li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 py-3 rounded-2xl text-[14px] font-semibold text-text-sub bg-surface-alt active:scale-95 transition-transform"
              >
                취소
              </button>
              <button
                onClick={confirmWrite}
                className="flex-1 py-3 rounded-2xl text-[14px] font-semibold text-white bg-primary active:scale-95 transition-transform"
              >
                확인하고 글쓰기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
