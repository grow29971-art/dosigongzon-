"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Search, X, Cat as CatIcon, MessageSquare,
  Stethoscope, BookOpenText, MapPin, Phone, User,
} from "lucide-react";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { HEALTH_MAP } from "@/lib/cats-repo";
import { SkeletonCatCard, SkeletonPostCard, SkeletonHospitalCard } from "@/app/components/Skeleton";

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
    <div className="min-h-dvh pb-20" style={{ background: "#F7F4EE" }}>
      {/* ── 상단 검색 바 ── */}
      <div
        className="sticky top-0 z-30 px-4 pt-12 pb-3"
        style={{ background: "#F7F4EE", borderBottom: "1px solid rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
            aria-label="뒤로"
          >
            <ArrowLeft size={18} className="text-text-main" />
          </button>
          <div
            className="flex-1 flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}
          >
            <Search size={16} className="text-text-muted shrink-0" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="고양이·게시글·병원·가이드 검색"
              className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="w-5 h-5 rounded-full flex items-center justify-center active:scale-90"
                style={{ background: "rgba(0,0,0,0.05)" }}
                aria-label="지우기"
              >
                <X size={11} className="text-text-sub" />
              </button>
            )}
          </div>
        </div>

        {/* ── 탭 ── */}
        {data.query && !data.tooShort && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-hide">
            {([
              { key: "all", label: "전체", count: totalCount },
              { key: "cats", label: "고양이", count: data.counts.cats },
              { key: "posts", label: "게시글", count: data.counts.posts },
              { key: "hospitals", label: "병원", count: data.counts.hospitals },
              { key: "users", label: "캣맘", count: data.counts.users },
              { key: "guides", label: "가이드", count: data.counts.guides },
            ] as { key: SearchTab; label: string; count: number }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold active:scale-95 transition-transform"
                style={{
                  background: tab === t.key ? "#C47E5A" : "#FFFFFF",
                  color: tab === t.key ? "#FFFFFF" : "#6B5043",
                  border: tab === t.key ? "1px solid #C47E5A" : "1px solid rgba(0,0,0,0.05)",
                }}
              >
                {t.label} {t.count > 0 && <span className="ml-0.5 opacity-80">{t.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 결과 영역 ── */}
      <div className="px-4 pt-4">
        {loading && (
          <div className="space-y-5">
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
            icon={<Search size={28} style={{ color: "#C47E5A" }} />}
            title="무엇을 찾고 있나요?"
            desc="고양이 이름·지역·게시글·병원·가이드를 한 번에 검색해요."
          />
        )}

        {!loading && data.tooShort && (
          <EmptyState
            icon={<Search size={28} style={{ color: "#C47E5A" }} />}
            title="2자 이상 입력해주세요"
            desc="너무 짧은 검색어는 결과가 너무 많아 정확도가 떨어져요."
          />
        )}

        {!loading && data.query && !data.tooShort && totalCount === 0 && (
          <EmptyState
            icon={<Search size={28} style={{ color: "#C47E5A" }} />}
            title={`"${data.query}" 결과 없음`}
            desc="다른 검색어로 시도해보세요."
          />
        )}

        {!loading && totalCount > 0 && (
          <div className="space-y-5">
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
    <Suspense fallback={<div className="min-h-dvh" style={{ background: "#F7F4EE" }} />}>
      <SearchPageInner />
    </Suspense>
  );
}

/* ═══ Empty state ═══ */
function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="py-14 flex flex-col items-center text-center rounded-2xl bg-white"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
        style={{ background: "rgba(196,126,90,0.12)" }}
      >
        {icon}
      </div>
      <p className="text-[14px] font-extrabold text-text-main">{title}</p>
      <p className="text-[12px] text-text-sub mt-1 leading-relaxed max-w-[280px]">{desc}</p>
    </div>
  );
}

/* ═══ 섹션: 고양이 ═══ */
function SectionCats({ items, tab }: { items: CatHit[]; query: string; tab: SearchTab }) {
  const visible = tab === "cats" ? items : items.slice(0, 4);
  return (
    <section>
      <SectionHeader icon={<CatIcon size={14} />} label="고양이" count={items.length} />
      <div className="grid grid-cols-2 gap-2.5">
        {visible.map((c) => {
          const photo = sanitizeImageUrl(c.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
          const urgent = c.health_status === "danger";
          return (
            <Link
              key={c.id}
              href={`/cats/${c.id}`}
              className="block rounded-2xl overflow-hidden bg-white active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}
            >
              <div className="relative" style={{ aspectRatio: "1 / 1" }}>
                <Image
                  src={photo}
                  alt={c.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  style={{ objectFit: "cover" }}
                />
                {urgent && (
                  <span
                    className="absolute top-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-lg text-white z-10"
                    style={{ backgroundColor: HEALTH_MAP.danger.color }}
                  >
                    🚨 긴급
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[13px] font-extrabold text-text-main truncate">{c.name}</p>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <MapPin size={10} className="text-text-light" />
                  <span className="text-[10.5px] text-text-sub truncate">{c.region ?? "미정"}</span>
                </div>
              </div>
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
      <div className="space-y-2">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/community/${p.id}`}
            className="block rounded-2xl bg-white p-3.5 active:scale-[0.99] transition-transform"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[13.5px] font-extrabold text-text-main line-clamp-1">{p.title}</p>
            <p className="text-[12px] text-text-sub mt-0.5 line-clamp-2 leading-snug">{p.content}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-text-light">
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
      <div className="space-y-2">
        {items.map((h) => (
          <div
            key={h.id}
            className="rounded-2xl bg-white p-3.5"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[13.5px] font-extrabold text-text-main">{h.name}</p>
            {h.address && (
              <div className="flex items-start gap-1 mt-1">
                <MapPin size={11} className="text-text-light mt-0.5 shrink-0" />
                <span className="text-[11.5px] text-text-sub leading-snug">{h.address}</span>
              </div>
            )}
            {h.phone && (
              <a
                href={`tel:${h.phone}`}
                className="inline-flex items-center gap-1 mt-1.5 text-[11.5px] font-bold"
                style={{ color: "#22B573" }}
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

/* ═══ 섹션: 캣맘(유저) ═══ */
function SectionUsers({ items }: { items: UserHit[] }) {
  return (
    <section>
      <SectionHeader icon={<User size={14} />} label="캣맘 / 유저" count={items.length} />
      <div className="space-y-2">
        {items.map((u) => {
          const avatar = sanitizeImageUrl(u.avatar_url, "");
          return (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 active:scale-[0.99] transition-transform"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            >
              <div
                className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-surface-alt flex items-center justify-center"
                style={{ border: "1.5px solid #E5E0D6" }}
              >
                {avatar ? (
                  <Image src={avatar} alt={u.nickname} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <User size={18} className="text-text-light" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13.5px] font-extrabold text-text-main truncate">{u.nickname}</p>
                  {u.admin_title && (
                    <span
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ background: "#C47E5A", color: "#fff" }}
                    >
                      {u.admin_title}
                    </span>
                  )}
                </div>
              </div>
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
      <div className="space-y-2">
        {items.map((g) => (
          <Link
            key={g.slug}
            href={g.slug === "district-contacts" || g.slug === "legal"
              ? `/protection/${g.slug}`
              : `/protection/${g.slug}`}
            className="block rounded-2xl bg-white p-3.5 active:scale-[0.99] transition-transform"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[13.5px] font-extrabold text-text-main">{g.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ═══ 섹션 헤더 ═══ */
function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5 px-1">
      <span style={{ color: "#C47E5A" }}>{icon}</span>
      <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">{label}</h2>
      <span className="text-[11px] font-bold text-text-light">{count}</span>
    </div>
  );
}
