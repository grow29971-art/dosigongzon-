import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, PawPrint, CalendarDays, Camera, BookOpen, Sparkles, Star, Heart, MessageCircle } from "lucide-react";
import { getCatByIdServer, getCatCommentsCountServer, getCatCareLogsCountServer, getCatCommunityStatsServer, getCatDiaryServer } from "@/lib/cats-server";
import { GENDER_MAP, HEALTH_MAP, thumbnailUrl, optimizedImageUrl } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { createClient } from "@/lib/supabase/server";
import FollowButton from "@/app/components/FollowButton";
import ShareCatButton from "@/app/components/ShareCatButton";
import { AdoptionBadge, AdoptionInquireButton } from "@/app/components/AdoptionBadge";
import PickCatSignupCta from "@/app/components/PickCatSignupCta";
import FirstFeedBar from "@/app/components/FirstFeedBar";

const SITE_URL = "https://dosigongzon.com";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const cat = await getCatByIdServer(id);
  if (!cat) {
    return {
      title: "고양이를 찾을 수 없어요",
      robots: { index: false, follow: false },
    };
  }

  const title = `${cat.name}`;
  const region = cat.region ?? "우리 동네";
  const description = cat.description
    ? `${region} · ${cat.description}`
    : `${region}에 사는 길고양이 ${cat.name} 의 돌봄 기록과 이야기.`;

  return {
    title,
    description,
    alternates: { canonical: `/cats/${cat.id}` },
    openGraph: {
      type: "article",
      title: `${cat.name} · ${region} | 도시공존`,
      description,
      url: `${SITE_URL}/cats/${cat.id}`,
      images: [
        {
          url: `/cats/${cat.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${cat.name} (${region})`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.name} · ${region}`,
      description,
      images: [`/cats/${cat.id}/opengraph-image`],
    },
  };
}

export default async function CatDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const cat = await getCatByIdServer(id);
  if (!cat) notFound();

  // 입양·임보 문의 버튼에서 본인 고양이인지 판별하는 용도
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const [commentCount, careCount, communityStats, diary, totalCatsForNudge] = await Promise.all([
    getCatCommentsCountServer(cat.id),
    getCatCareLogsCountServer(cat.id),
    getCatCommunityStatsServer(cat.id),
    getCatDiaryServer(cat.id, 60),
    // 비로그인 회원가입 nudge용 — 누적 등록 수
    currentUserId ? Promise.resolve(0) : supabase.rpc("total_cat_count").then((r) => Number(r.data ?? 0)),
  ]);

  const photo = sanitizeImageUrl(cat.photo_url, "https://placehold.co/800x800/EEEAE2/2A2A28?text=%3F");
  const region = cat.region ?? "우리 동네";
  const createdAt = new Date(cat.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // JSON-LD (Article + 썸네일)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${cat.name} · ${region} 길고양이 돌봄 기록`,
    image: photo,
    datePublished: cat.created_at,
    inLanguage: "ko-KR",
    author: {
      "@type": "Organization",
      name: "도시공존",
    },
    publisher: {
      "@type": "Organization",
      name: "도시공존",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icons/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/cats/${cat.id}`,
    },
    description: cat.description ?? `${region}에 사는 길고양이 ${cat.name}`,
  };

  // BreadcrumbList — 검색 결과에서 경로 빵부스러기 표시
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "지도", item: `${SITE_URL}/map` },
      { "@type": "ListItem", position: 3, name: cat.name, item: `${SITE_URL}/cats/${cat.id}` },
    ],
  };

  return (
    <div className="pb-24" style={{ background: "var(--color-warm-white)", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />

      {/* 헤더 (뒤로 가기) — 비로그인 진입자는 외부 공유로 들어온 경우가 많아 홈으로 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href={currentUserId ? "/map" : "/"}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center press-strong"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label={currentUserId ? "지도로 돌아가기" : "홈으로 가기"}
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[13px] font-semibold text-text-sub">{currentUserId ? "지도" : "도시공존"}</span>
      </div>

      {/* 커버 이미지 */}
      <div
        className="relative mx-4 mt-2 rounded-3xl overflow-hidden"
        style={{ aspectRatio: "4 / 3", boxShadow: "var(--shadow-fab)" }}
      >
        <Image
          src={photo}
          alt={cat.name}
          fill
          priority
          sizes="(max-width: 720px) 100vw, 720px"
          style={{ objectFit: "cover" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 p-4 z-10"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)",
          }}
        >
          {cat.adoption_status && (
            <div className="mb-1.5">
              <AdoptionBadge status={cat.adoption_status} size="md" />
            </div>
          )}
          <h1 className="text-[28px] font-bold text-white tracking-tight drop-shadow">
            {cat.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin size={12} color="#fff" />
            <span className="text-[13px] font-bold text-white">{region}</span>
          </div>
        </div>
      </div>

      {/* 비로그인 진입자 회원가입 nudge — pick 지점.
          2026-08-07: 갤러리·스탯·사회증명 아래에 있어서 소형 폰에서는 접힘 밖이었다.
          커버 직후로 올려 첫 화면 안에 들어오게 한다. (cat_detail_view_anon은
          PickCatSignupCta 마운트 시 발화하므로 순서를 바꿔도 계측량은 그대로) */}
      {/* 고양이별로 간 아이 — 돌봄 권유 대신 추모 안내로 바꾼다 */}
      {cat.memorial_at && (
        <div className="px-4 mt-3">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, #2b2440 0%, #3a2c4d 55%, #55456f 100%)",
              boxShadow: "0 8px 22px rgba(58,44,77,0.28)",
            }}
          >
            <div className="flex items-center gap-2">
              <Star size={16} color="#FFE9A8" fill="#FFE9A8" />
              <p className="text-[13px] font-bold text-white">
                {cat.name}(이)는 고양이별에 있어요
              </p>
            </div>
            <p className="text-[13px] leading-[1.7] mt-2" style={{ color: "rgba(255,255,255,0.66)" }}>
              {new Date(cat.memorial_at).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              에 무지개다리를 건넜어요. 아래 기록은 그대로 남아 있어요.
            </p>
            {cat.memorial_note && (
              <p
                className="text-[13px] leading-[1.7] mt-3 px-3.5 py-3 whitespace-pre-wrap"
                style={{ color: "rgba(255,255,255,0.82)", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-input)" }}
              >
                {cat.memorial_note}
              </p>
            )}
            <Link
              href="/memorial"
              className="inline-flex items-center justify-center h-[40px] px-5 rounded-xl mt-4 text-[13px] font-bold"
              style={{ background: "rgba(255,255,255,0.94)", color: "#3a2c4d" }}
            >
              고양이별 가보기
            </Link>
          </div>
        </div>
      )}

      {!currentUserId && !cat.memorial_at && (
        <div className="px-4 mt-3">
          <div
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: "var(--color-primary-softer)",
              border: "1.5px solid rgba(173, 94, 59,0.30)",
              boxShadow: "0 6px 18px rgba(173, 94, 59,0.18)",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -40,
                right: -30,
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(232,141,90,0.18) 0%, rgba(232,141,90,0) 70%)",
              }}
            />
            <p className="text-[15px] font-bold text-text-main leading-tight tracking-tight mb-1.5">
              우리 동네 길고양이도 같이 돌봐요
            </p>
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: "rgba(92,74,62,0.85)" }}>
              도시공존은 광고 없는 무료 시민 참여 길고양이 지도예요.
              {totalCatsForNudge > 0 && (
                <>
                  {" "}전국 <b style={{ color: "var(--color-primary-dark)" }}>{totalCatsForNudge.toLocaleString()}마리</b>가 이미 등록돼 함께 돌봐지고 있어요.
                </>
              )}
            </p>
            <div className="flex gap-2">
              {/* 온보딩 pick 지점 — pending_care 커밋 + onboarding_pick 계측 후 가입으로 */}
              <PickCatSignupCta catId={cat.id} catName={cat.name} />
              <Link
                href="/"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl text-[13px] font-bold press transition-transform bg-white"
                style={{
                  color: "var(--color-primary-dark)",
                  border: "1px solid rgba(173, 94, 59,0.30)",
                }}
              >
                더 둘러보기
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 입양·임보 문의 CTA (상태 있고 본인 고양이 아닐 때).
          고양이별로 간 아이에겐 띄우지 않는다 — 떠난 아이에게 "입양 문의하기"는 잔인하다 */}
      {cat.adoption_status && !cat.memorial_at && (
        <div className="px-4 mt-3">
          <AdoptionInquireButton
            status={cat.adoption_status}
            caretakerId={cat.caretaker_id}
            caretakerName={cat.caretaker_name}
            catName={cat.name}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* 갤러리 썸네일 (사진 2장 이상일 때) */}
      {cat.photo_urls && cat.photo_urls.length > 1 && (
        <div className="px-4 mt-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {cat.photo_urls.map((url, idx) => {
              const safeUrl = sanitizeImageUrl(url, "");
              return (
                <a
                  key={idx}
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-xl overflow-hidden press-strong relative"
                  style={{
                    width: 72,
                    height: 72,
                    border: idx === 0 ? "2px solid var(--color-primary)" : "1.5px solid rgba(0,0,0,0.06)",
                    boxShadow: "var(--shadow-raised)",
                  }}
                  aria-label={`사진 ${idx + 1}`}
                >
                  {safeUrl && (
                    <Image
                      src={safeUrl}
                      alt={`사진 ${idx + 1}`}
                      fill
                      sizes="72px"
                      style={{ objectFit: "cover" }}
                    />
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* 카운트 스탯 */}
      <div className="grid grid-cols-3 gap-2 px-4 mt-4">
        <StatCard icon={<Heart size={18} style={{ color: "var(--color-like)" }} />} label="좋아요" value={cat.like_count ?? 0} color="var(--color-like)" />
        <StatCard icon={<PawPrint size={18} style={{ color: "var(--color-sage)" }} />} label="돌봄다이어리" value={careCount} color="var(--color-sage)" />
        <StatCard icon={<MessageCircle size={18} style={{ color: "var(--color-gray-600)" }} />} label="댓글" value={commentCount} color="var(--color-gray-600)" />
      </div>

      {/* 사회적 증명 — 이 아이를 함께 돌보는 이웃 */}
      {(communityStats.uniqueCaretakers > 0 || communityStats.likeUserCount > 0) && (
        <div className="px-4 mt-3">
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: "var(--color-primary-softer)",
              border: "1px solid rgba(173, 94, 59,0.18)",
            }}
          >
            {/* 돌봄 이웃 아바타 스택 */}
            {communityStats.recentCaretakers.length > 0 && (
              <div className="flex -space-x-2 shrink-0">
                {communityStats.recentCaretakers.map((c) => (
                  <div
                    key={c.authorId}
                    className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: "var(--color-gray-100)",
                      border: "2px solid #fff",
                    }}
                    title={c.name}
                  >
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnailUrl(sanitizeImageUrl(c.avatarUrl, ""), 64) ?? sanitizeImageUrl(c.avatarUrl, "")}
                        alt={c.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[11px] font-bold" style={{ color: "var(--color-text-light)" }}>
                        {c.name.charAt(0)}
                      </span>
                    )}
                  </div>
                ))}
                {communityStats.uniqueCaretakers > 3 && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{
                      background: "var(--color-primary)",
                      color: "#fff",
                      border: "2px solid #fff",
                    }}
                  >
                    +{communityStats.uniqueCaretakers - 3}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-text-main tracking-tight leading-tight">
                {communityStats.uniqueCaretakers > 0 ? (
                  <>
                    이웃{" "}
                    <span style={{ color: "var(--color-primary)" }}>
                      {communityStats.uniqueCaretakers}명
                    </span>
                    이 {cat.name}을(를) 함께 돌보고 있어요
                  </>
                ) : (
                  <>
                    <span style={{ color: "var(--color-like)" }}>
                      {communityStats.likeUserCount}명
                    </span>
                    이 이 아이를 지켜보고 있어요
                  </>
                )}
              </p>
              {communityStats.uniqueCaretakers > 0 && communityStats.likeUserCount > 0 && (
                <p className="text-[11px] text-text-sub mt-0.5 leading-tight">
                  좋아요 {communityStats.likeUserCount}명 · 최근 30일 기록
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 프로필 뱃지 */}
      <div className="px-4 mt-4">
        <div
          className="bg-white rounded-2xl p-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {cat.gender && cat.gender !== "unknown" && (
              <Badge bg="var(--color-gray-100)" fg="var(--color-gray-600)">
                {GENDER_MAP[cat.gender]?.emoji} {GENDER_MAP[cat.gender]?.label}
              </Badge>
            )}
            {cat.neutered != null && (
              <Badge
                bg={cat.neutered ? "var(--color-sage-soft)" : "var(--color-care-soft)"}
                fg={cat.neutered ? "var(--color-sage)" : "var(--color-care)"}
              >
                {cat.neutered ? "중성화 완료" : "중성화 필요"}
              </Badge>
            )}
            {cat.health_status && cat.health_status !== "good" && (() => {
              const h = HEALTH_MAP[cat.health_status];
              return (
                <Badge bg={`${h.color}18`} fg={h.color}>
                  {h.emoji} {h.label}
                </Badge>
              );
            })()}
            {cat.tags.map((t) => (
              <Badge key={t} bg="var(--color-gray-100)" fg="var(--color-primary)">
                {t}
              </Badge>
            ))}
          </div>
          {cat.description && (
            <p className="text-[13px] text-text-main leading-relaxed">
              {cat.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-text-light flex-wrap">
            <CalendarDays size={11} />
            <span>{createdAt} 등록</span>
            {cat.caretaker_name && (
              <>
                <span>·</span>
                {cat.caretaker_id ? (
                  <Link
                    href={`/users/${cat.caretaker_id}`}
                    className="font-bold hover:underline"
                    style={{ color: "var(--color-primary)" }}
                  >
                    길집사 {cat.caretaker_name}
                  </Link>
                ) : (
                  <span>길집사 {cat.caretaker_name}</span>
                )}
                {cat.caretaker_id && (
                  <FollowButton userId={cat.caretaker_id} size="sm" />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 📸 다이어리 — 시간이 쌓인 사진 갤러리 */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-1.5">
            <BookOpen size={16} style={{ color: "var(--color-primary)" }} />
            {/* 위 스탯카드의 "돌봄다이어리"(care_logs 개수)와 이름이 겹쳐서,
                두 숫자가 안 맞으면 고장난 것처럼 보였다. 이건 사진 모음이다. (2026-08-09) */}
            <h2 className="text-[15px] font-bold text-text-main tracking-tight">
              {cat.name} 사진첩
            </h2>
          </div>
          {diary.totalPhotos > 0 && (
            <span className="text-[11px] font-bold text-text-sub tabular-nums">
              {diary.uniqueDays}일 · {diary.totalPhotos}장
            </span>
          )}
        </div>

        {/* 📅 오늘 상태 안내 — 오늘 사진 있으면 칭찬, 없으면 유도 */}
        {(() => {
          const todayKst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
          const todayCount = diary.entries.filter(
            (e) => new Date(e.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) === todayKst,
          ).length;
          const hasTodayPhoto = todayCount > 0;
          return (
            <Link
              href={`/map?cat=${cat.id}`}
              className="block mb-3 rounded-xl px-3.5 py-3 press transition-transform"
              style={{
                background: hasTodayPhoto
                  ? "var(--color-sage-soft)"
                  : "var(--color-primary-softer)",
                border: hasTodayPhoto
                  ? "1.5px solid rgba(34,163,102,0.35)"
                  : "1.5px dashed rgba(173, 94, 59,0.40)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: hasTodayPhoto ? "rgba(34,163,102,0.22)" : "rgba(173, 94, 59,0.18)",
                  }}
                >
                  {hasTodayPhoto ? (
                    <Sparkles size={16} style={{ color: "var(--color-sage)" }} />
                  ) : (
                    <Camera size={16} style={{ color: "var(--color-primary)" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-bold leading-tight"
                    style={{ color: hasTodayPhoto ? "var(--color-sage)" : "var(--color-primary-dark)" }}
                  >
                    {hasTodayPhoto
                      ? `오늘 ${todayCount}장 채워졌어요`
                      : `오늘의 ${cat.name} 사진을 올려주세요`}
                  </p>
                  <p
                    className="text-[11px] mt-0.5 leading-snug"
                    style={{ color: hasTodayPhoto ? "var(--color-sage)" : "var(--color-primary-dark)" }}
                  >
                    {hasTodayPhoto
                      ? "한 장 더 남기면 다이어리가 더 두꺼워져요"
                      : "지도에서 사진과 함께 돌봄 기록을 남겨보세요"}
                  </p>
                </div>
                <Camera size={13} className="shrink-0" style={{ color: hasTodayPhoto ? "var(--color-sage)" : "var(--color-primary)" }} />
              </div>
            </Link>
          );
        })()}

        {diary.entries.length === 0 ? (
          // 빈 상태 — 첫 사진 유도
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background: "var(--color-primary-softer)",
              border: "1.5px dashed rgba(173, 94, 59,0.35)",
            }}
          >
            <Sparkles size={20} className="mx-auto mb-1.5" style={{ color: "var(--color-primary)" }} />
            <p className="text-[13px] font-bold text-text-main leading-tight">
              {cat.name}의 다이어리가 비어 있어요
            </p>
            <p className="text-[11px] text-text-sub mt-1.5 leading-relaxed">
              지도에서 사진을 한 장 올려주세요.
              <br />
              매일 한 장씩 모이면 시간을 담은 다이어리가 돼요
            </p>
            <Link
              href={`/map?cat=${cat.id}`}
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl text-white text-[13px] font-bold press-strong transition-transform"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                boxShadow: "var(--shadow-primary)",
              }}
            >
              <Camera size={13} />
              첫 사진 올리기
            </Link>
          </div>
        ) : (
          <>
            {/* 사진 그리드 — 3열 */}
            <div className="grid grid-cols-3 gap-1.5">
              {diary.entries.map((e) => {
                const safe = sanitizeImageUrl(e.photo_url, "");
                if (!safe) return null;
                const dateLabel = new Date(e.created_at).toLocaleDateString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  timeZone: "Asia/Seoul",
                });
                return (
                  <a
                    key={e.id}
                    href={safe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden relative press-strong transition-transform"
                    style={{ aspectRatio: "1/1", background: "var(--color-gray-100)" }}
                  >
                    <Image
                      src={thumbnailUrl(safe, 240) ?? safe}
                      alt={`${cat.name} 다이어리 — ${dateLabel}`}
                      fill
                      sizes="(max-width: 480px) 33vw, 160px"
                      style={{ objectFit: "cover" }}
                      unoptimized
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums"
                      style={{
                        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)",
                      }}
                    >
                      {dateLabel}
                    </div>
                  </a>
                );
              })}
            </div>

            {/* 더 올리기 CTA — 작게 */}
            <Link
              href={`/map?cat=${cat.id}`}
              className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold press transition-transform"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-primary)",
                border: "1px solid var(--color-border)",
              }}
            >
              <Camera size={12} />
              오늘의 사진 추가하기
            </Link>
          </>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 mt-4 space-y-2">
        {cat.health_status === "danger" && (
          <ShareCatButton
            catId={cat.id}
            name={cat.name}
            region={region}
            description={cat.description}
            urgent
          />
        )}
        {/* 비로그인에게는 숨긴다. 눌러도 지도 시트의 돌봄 탭이 로그인 전용이라
            입력 폼이 통째로 사라지는 침묵 실패였고(CareLogTab의 isLoggedIn 가드),
            위쪽 가입 CTA보다 시각적으로 강해 pick 경로를 새게 만들고 있었다.
            (2026-08-07 — /signup으로 보내는 대신 숨기는 이유: 그 경로는
             pending_care 커밋과 onboarding_pick 발화를 거치지 않아
             계측 밖 두 번째 가입 경로가 생긴다) */}
        {currentUserId && (
          <Link
            href={`/map?cat=${cat.id}`}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-white press transition-transform"
            style={{ boxShadow: "var(--shadow-primary)" }}
          >
            <PawPrint size={16} />
            <span className="text-[13px] font-bold">지도에서 돌봄하기</span>
          </Link>
        )}
        {cat.health_status !== "danger" && (
          <ShareCatButton
            catId={cat.id}
            name={cat.name}
            region={region}
            description={cat.description}
          />
        )}
        <p className="text-[11px] text-text-light text-center leading-relaxed mt-2">
          아이들 안전을 위해 지도 위치는 대략적인 활동 범위로만 표시돼요.
          <br />동네 단톡방에 공유하면 더 많은 이웃이 지켜줘요
        </p>
      </div>

      {/* 가입 직후 착지 완주 바 — pending_care가 이 아이일 때만 뜬다 (회의 P0-1) */}
      {currentUserId && <FirstFeedBar catId={cat.id} catName={cat.name} />}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      className="bg-white rounded-2xl py-3 flex flex-col items-center justify-center"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span className="text-[17px] font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px] text-text-sub font-semibold mt-0.5">{label}</span>
    </div>
  );
}

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}
