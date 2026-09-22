"use client";

// 통합 검색 — 2026-09-16 「익숙한 동네앱」 리디자인: 아이보리 바탕·그림자 카드 폐지 →
// 순백 바탕, 8px 입력창, 결과는 구분선 리스트, 탭은 UIChip. placehold.co 제거(빈 썸네일은 회색 면).

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Search, X, Cat as CatIcon, MessageSquare,
  Stethoscope, BookOpenText, MapPin, Phone, User, ChevronRight,
} from "lucide-react";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { SkeletonCatCard, SkeletonPostCard, SkeletonHospitalCard } from "@/app/components/Skeleton";
import UIChip from "@/app/components/ui/Chip";
import EmptyState from "@/app/components/ui/EmptyState";

type SearchTab = "all" | "cats" | "posts" | "hospitals" | "users" | "guides";

interface CatHit {
  id: string;
  name: string;
  region: string | null;
  photo_url: string | null;
  health_status: string;
  like_count: number | null;
}
interface PostHit {
  id: string;
  title: string;
  content: string;
  category: string;
  author_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  view_count: number | null;
  comment_count: number | null;
}
interface HospitalHit {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  phone: string | null;
}
interface UserHit {
  id: string;
  nickname: string;
  avatar_url: string | null;
  admin_title: string | null;
}
interface GuideHit {
  slug: string;
  title: string;
}

interface SearchResponse {
  query: string;
  cats: CatHit[];
  posts: PostHit[];
  hospitals: HospitalHit[];
  users: UserHit[];
  guides: GuideHit[];
  counts: { cats: number; posts: number; hospitals: number; users: number; guides: number };
  tooShort?: boolean;
}

const EMPTY_RESPONSE: SearchResponse = {
  query: "",
  cats: [], posts: [], hospitals: [], users: [], guides: [],
  counts: { cats: 0, posts: 0, hospitals: 0, users: 0, guides: 0 },
};

// 구분선 리스트 행 공통 클래스
const ROW = "flex items-center gap-3 py-3 press transition-transform border-b border-divider last:border-b-0";

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [debounced, setDebounced] = useState(initialQ);
  const [tab, setTab] = useState<SearchTab>("all");
  const [data, setData] = useState<SearchResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(false);

  // Debounce: 입력 멈춘 후 350ms 뒤 실제 요청
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setData({ ...EMPTY_RESPONSE, query: q, tooShort: q.length > 0 });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=all`);
      const json = (await res.json()) as SearchResponse;
      setData(json);
    } catch {
      setData(EMPTY_RESPONSE);
    } finally {
      setLoading(false);
    }
  }, []);

  // debounced 값 바뀔 때마다 API 호출 + URL 동기화
  useEffect(() => {
    fetchResults(debounced);
    const nextUrl = debounced ? `/search?q=${encodeURIComponent(debounced)}` : "/search";
    router.replace(nextUrl);
  }, [debounced, fetchResults, router]);

  const totalCount =
    data.counts.cats + data.counts.posts + data.counts.hospitals + data.counts.guides;

  return (
    <div className="min-h-dvh pb-20" style={{ background: "var(--color-surface)" }}>
      {/* ── 상단 검색 바 ── */}
      <div
        className="sticky top-0 z-30 px-4 pt-12 pb-3"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 -ml-2 flex items-center justify-center press-strong"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <div
            className="flex-1 flex items-center gap-2 px-3.5 py-2.5"
            style={{
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-input)",
            }}
          >
            <Search size={16} className="text-text-light shrink-0" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="고양이·게시글·병원·가이드 검색"
              className="flex-1 text-[15px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="w-5 h-5 rounded-full flex items-center justify-center press-strong"
                style={{ background: "var(--color-gray-300)" }}
                aria-label="지우기"
              >
                <X size={11} className="text-surface" />
              </button>
            )}
          </div>
        </div>

        {/* ── 탭 ── */}
        {data.query && !data.tooShort && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
            {([
              { key: "all", label: "전체", count: totalCount },
              { key: "cats", label: "고양이", count: data.counts.cats },
              { key: "posts", label: "게시글", count: data.counts.posts },
              { key: "hospitals", label: "병원", count: data.counts.hospitals },
              { key: "users", label: "길집사", count: data.counts.users },
              { key: "guides", label: "가이드", count: data.counts.guides },
            ] as { key: SearchTab; label: string; count: number }[]).map((t) => (
              <UIChip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label} {t.count > 0 && <span className="ml-0.5 opacity-80">{t.count}</span>}
              </UIChip>
            ))}
          </div>
        )}
      </div>

      {/* ── 결과 영역 ── */}
      <div className="px-4 pt-2">
        {loading && (
          <div className="space-y-5 pt-2">
            {/* 고양이 카드 그리드 스켈레톤 */}
            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCatCard key={i} />)}
            </div>
            {/* 게시글 카드 스켈레톤 */}
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonPostCard key={i} />)}
            </div>
            {/* 병원 카드 스켈레톤 */}
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => <SkeletonHospitalCard key={i} />)}
            </div>
          </div>
        )}

        {!loading && !data.query && (
          <EmptyState
            icon={<Search size={40} strokeWidth={1.2} />}
            title="무엇을 찾고 있나요?"
            desc="고양이·지역·게시글·병원·가이드를 한 번에 검색해요."
          />
        )}

        {!loading && data.tooShort && (
          <EmptyState
            icon={<Search size={40} strokeWidth={1.2} />}
            title="2자 이상 입력해주세요"
            desc="검색어가 짧으면 결과가 너무 많아요."
          />
        )}

        {!loading && data.query && !data.tooShort && totalCount === 0 && (
          <EmptyState
            icon={<Search size={40} strokeWidth={1.2} />}
            title={`"${data.query}" 결과 없음`}
            desc="다른 검색어로 시도해보세요."
          />
        )}

        {!loading && totalCount > 0 && (
          <div className="space-y-6">
            {(tab === "all" || tab === "cats") && data.cats.length > 0 && (
              <SectionCats items={data.cats} query={data.query} tab={tab} />
            )}
            {(tab === "all" || tab === "guides") && data.guides.length > 0 && (
              <SectionGuides items={data.guides} />
            )}
            {(tab === "all" || tab === "posts") && data.posts.length > 0 && (
              <SectionPosts items={data.posts} />
            )}
            {(tab === "all" || tab === "hospitals") && data.hospitals.length > 0 && (
              <SectionHospitals items={data.hospitals} />
            )}
            {(tab === "all" || tab === "users") && data.users.length > 0 && (
              <SectionUsers items={data.users} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" style={{ background: "var(--color-surface)" }} />}>
      <SearchPageInner />
    </Suspense>
  );
}

/* ═══ 섹션: 고양이 ═══ */
function SectionCats({ items, tab }: { items: CatHit[]; query: string; tab: SearchTab }) {
  const visible = tab === "cats" ? items : items.slice(0, 4);
  return (
    <section>
      <SectionHeader icon={<CatIcon size={14} />} label="고양이" count={items.length} />
      <div>
        {visible.map((c) => {
          const photo = sanitizeImageUrl(c.photo_url, "");
          const urgent = c.health_status === "danger";
          return (
            <Link key={c.id} href={`/cats/${c.id}`} className={ROW} style={{ minHeight: 64 }}>
              <div
                className="relative shrink-0 overflow-hidden flex items-center justify-center"
                style={{ width: 48, height: 48, borderRadius: "var(--radius-card-sm)", background: "var(--color-gray-100)" }}
              >
                {photo ? (
                  <Image src={photo} alt={c.name} fill sizes="48px" style={{ objectFit: "cover" }} />
                ) : (
                  <CatIcon size={20} className="text-text-light" strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[15px] font-semibold text-text-main truncate">{c.name}</p>
                  {urgent && (
                    <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--color-error)" }}>
                      긴급
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <MapPin size={11} className="text-text-light" />
                  <span className="text-[13px] text-text-sub truncate">{c.region ?? "미정"}</span>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ═══ 섹션: 게시글 ═══ */
function SectionPosts({ items }: { items: PostHit[] }) {
  return (
    <section>
      <SectionHeader icon={<MessageSquare size={14} />} label="게시글" count={items.length} />
      <div>
        {items.map((p) => (
          <Link key={p.id} href={`/community/${p.id}`} className={ROW} style={{ minHeight: 64 }}>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main line-clamp-1">{p.title}</p>
              <p className="text-[13px] text-text-sub mt-0.5 line-clamp-2 leading-snug">{p.content}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-text-light">
                <span>{p.author_name ?? "익명"}</span>
                <span>·</span>
                <span>조회 {p.view_count ?? 0}</span>
                {(p.comment_count ?? 0) > 0 && (
                  <>
                    <span>·</span>
                    <span>댓글 {p.comment_count}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ═══ 섹션: 병원 ═══ */
function SectionHospitals({ items }: { items: HospitalHit[] }) {
  return (
    <section>
      <SectionHeader icon={<Stethoscope size={14} />} label="구조동물 치료 병원" count={items.length} />
      <div>
        {items.map((h) => (
          <div key={h.id} className="py-3 border-b border-divider last:border-b-0" style={{ minHeight: 56 }}>
            <p className="text-[15px] font-semibold text-text-main">{h.name}</p>
            {h.address && (
              <div className="flex items-start gap-1 mt-1">
                <MapPin size={11} className="text-text-light mt-0.5 shrink-0" />
                <span className="text-[13px] text-text-sub leading-snug">{h.address}</span>
              </div>
            )}
            {h.phone && (
              <a
                href={`tel:${h.phone}`}
                className="inline-flex items-center gap-1 mt-1.5 text-[13px] font-semibold"
                style={{ color: "var(--color-primary)" }}
              >
                <Phone size={11} />
                {h.phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══ 섹션: 길집사(유저) ═══ */
function SectionUsers({ items }: { items: UserHit[] }) {
  return (
    <section>
      <SectionHeader icon={<User size={14} />} label="길집사 / 유저" count={items.length} />
      <div>
        {items.map((u) => {
          const avatar = sanitizeImageUrl(u.avatar_url, "");
          return (
            <Link key={u.id} href={`/users/${u.id}`} className={ROW} style={{ minHeight: 56 }}>
              <div
                className="shrink-0 w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
                style={{ background: "var(--color-gray-200)" }}
              >
                {avatar ? (
                  <Image src={avatar} alt={u.nickname} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <User size={18} className="text-text-sub" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[15px] font-semibold text-text-main truncate">{u.nickname}</p>
                  {u.admin_title && (
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 shrink-0 text-text-sub"
                      style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
                    >
                      {u.admin_title}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ═══ 섹션: 가이드 ═══ */
function SectionGuides({ items }: { items: GuideHit[] }) {
  return (
    <section>
      <SectionHeader icon={<BookOpenText size={14} />} label="보호지침 가이드" count={items.length} />
      <div>
        {items.map((g) => (
          <Link
            key={g.slug}
            href={g.slug === "district-contacts" || g.slug === "legal"
              ? `/protection/${g.slug}`
              : `/protection/${g.slug}`}
            className={ROW}
            style={{ minHeight: 56 }}
          >
            <p className="flex-1 min-w-0 text-[15px] font-semibold text-text-main truncate">{g.title}</p>
            <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ═══ 섹션 헤더 ═══ */
function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 pt-3 pb-1 px-1" style={{ borderBottom: "1px solid var(--color-divider)" }}>
      <span className="text-text-sub">{icon}</span>
      <h2 className="text-[15px] font-bold text-text-main tracking-tight">{label}</h2>
      <span className="text-[11px] font-semibold text-text-light">{count}</span>
    </div>
  );
}
