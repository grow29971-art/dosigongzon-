import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, PawPrint, CalendarDays, Camera, Sparkles, Star, Heart, MessageCircle, FileText, Award, ChevronRight, HeartPulse, TriangleAlert } from "lucide-react";
import { getCatByIdServer, getCatCommentsCountServer, getCatCareLogsCountServer, getCatCommunityStatsServer, getCatDiaryServer, getCatGuardianServer, getCatDesignatedFundServer } from "@/lib/cats-server";
import { GENDER_MAP, HEALTH_MAP, thumbnailUrl } from "@/lib/cats-repo";
import { catArtWalkSvg } from "@/lib/cat-art";
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

  const [commentCount, careCount, communityStats, guardian, designatedFund, diary, totalCatsForNudge] = await Promise.all([
    getCatCommentsCountServer(cat.id),
    getCatCareLogsCountServer(cat.id),
    getCatCommunityStatsServer(cat.id),
    getCatGuardianServer(cat.id),
    getCatDesignatedFundServer(cat.id),
    getCatDiaryServer(cat.id, 60),
    // 비로그인 회원가입 nudge용 — 누적 등록 수
    currentUserId ? Promise.resolve(0) : supabase.rpc("total_cat_count").then((r) => Number(r.data ?? 0)),
  ]);

  // 사진 없는 아이는 placeholder 이미지 대신 마커 아트(지도와 같은 캐릭터)로 그린다
  const photo = sanitizeImageUrl(cat.photo_url, "") || null;
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
    image: photo ?? `${SITE_URL}/cats/${cat.id}/opengraph-image`,
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

  const healthTone = cat.health_status === "danger"
    ? { color: "var(--color-error)", Icon: HeartPulse }
    : cat.health_status === "caution"
      ? { color: "var(--color-warning)", Icon: TriangleAlert }
      : null;

  return (
    <div className="pb-24" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
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
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          aria-label={currentUserId ? "지도로 돌아가기" : "홈으로 가기"}
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[13px] font-semibold text-text-sub">{currentUserId ? "지도" : "도시공존"}</span>
      </div>

      {/* 히어로 — 실사 사진 풀블리드. 사진이 없으면 마커 아트(지도와 같은 캐릭터) */}
      <div className="relative mt-2 overflow-hidden" style={{ aspectRatio: "4 / 3", background: "var(--color-surface-alt)" }}>
        {photo ? (
          <Image
            src={photo}
            alt={cat.name}
            fill
            priority
            sizes="(max-width: 720px) 100vw, 720px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            aria-label={`${cat.name} 마커 아트`}
            role="img"
            dangerouslySetInnerHTML={{
              __html: catArtWalkSvg(cat.art_key ?? cat.id, 168, { walking: false, colors: cat.art_colors }),
            }}
          />
        )}
      </div>

      {/* 이름·상태·메타 — 흰 면 + 헤어라인 */}
      <div className="px-4 pt-4 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        {cat.adoption_status && (
          <div className="mb-1.5">
            <AdoptionBadge status={cat.adoption_status} size="md" />
          </div>
        )}
        <h1 className="text-[24px] font-bold text-text-main tracking-tight leading-tight">
          {cat.name}
        </h1>
        <div className="flex items-center gap-1 mt-1 text-text-sub">
          <MapPin size={13} />
          <span className="text-[13px]">{region}</span>
        </div>
      </div>

      {/* 비로그인 진입자 회원가입 nudge — pick 지점.
          2026-08-07: 갤러리·스탯·사회증명 아래에 있어서 소형 폰에서는 접힘 밖이었다.
          커버 직후로 올려 첫 화면 안에 들어오게 한다. (cat_detail_view_anon은
          PickCatSignupCta 마운트 시 발화하므로 순서를 바꿔도 계측량은 그대로) */}
      {/* 고양이별로 간 아이 — 돌봄 권유 대신 추모 안내로 바꾼다 */}
      {cat.memorial_at && (
        <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Star size={16} className="text-text-sub" />
            <p className="text-[15px] font-semibold text-text-main">
              {cat.name}(이)는 고양이별에 있어요
            </p>
          </div>
          <p className="text-[13px] text-text-sub leading-relaxed mt-1.5">
            {new Date(cat.memorial_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            에 무지개다리를 건넜어요. 아래 기록은 그대로 남아 있어요.
          </p>
          {cat.memorial_note && (
            <p
              className="text-[13px] text-text-main leading-relaxed mt-3 px-3.5 py-3 whitespace-pre-wrap"
              style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-input)" }}
            >
              {cat.memorial_note}
            </p>
          )}
          <Link
            href="/memorial"
            className="inline-flex items-center gap-1 mt-3 text-[13px] font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            고양이별 가보기
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {!currentUserId && !cat.memorial_at && (
        <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <p className="text-[15px] font-semibold text-text-main leading-snug mb-1">
            {cat.name}(이)의 다음 소식, 계속 받아보실래요?
          </p>
          <p className="text-[13px] text-text-sub leading-relaxed mb-3">
            광고 없는 무료 길고양이 돌봄 지도예요. 기록은 민원·학대 신고 때 아이들을 지키는 증빙이 돼요.
            {totalCatsForNudge > 0 && (
              <>
                {" "}지금 <b className="text-text-main">{totalCatsForNudge.toLocaleString()}마리</b>가 함께 돌봐지고 있어요.
              </>
            )}
          </p>
          <div className="flex gap-2">
            {/* 온보딩 pick 지점 — pending_care 커밋 + onboarding_pick 계측 후 가입으로 */}
            <PickCatSignupCta catId={cat.id} catName={cat.name} />
            <Link
              href="/"
              className="flex-1 flex items-center justify-center h-10 text-[13px] font-semibold press text-text-main"
              style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-input)" }}
            >
              더 둘러보기
            </Link>
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
                  className="shrink-0 overflow-hidden press-strong relative"
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "var(--radius-card-sm)",
                    border: idx === 0 ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                    background: "var(--color-surface-alt)",
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

      {/* 카운트 스탯 — 헤어라인 한 줄, 세로 구분선 */}
      <div className="mx-4 mt-4 grid grid-cols-3" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}>
        <StatCell icon={<Heart size={16} />} label="좋아요" value={cat.like_count ?? 0} />
        <StatCell icon={<PawPrint size={16} />} label="돌봄다이어리" value={careCount} divider />
        <StatCell icon={<MessageCircle size={16} />} label="댓글" value={commentCount} divider />
      </div>

      {/* 사회적 증명 — 이 아이를 함께 돌보는 이웃 */}
      {(communityStats.uniqueCaretakers > 0 || communityStats.likeUserCount > 0) && (
        <div className="px-4 mt-3">
          <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
            {/* 돌봄 이웃 아바타 스택 */}
            {communityStats.recentCaretakers.length > 0 && (
              <div className="flex -space-x-2 shrink-0">
                {communityStats.recentCaretakers.map((c) => (
                  <div
                    key={c.authorId}
                    className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: "var(--color-gray-100)",
                      border: "2px solid var(--color-surface)",
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
                      <span className="text-[11px] font-semibold" style={{ color: "var(--color-text-light)" }}>
                        {c.name.charAt(0)}
                      </span>
                    )}
                  </div>
                ))}
                {communityStats.uniqueCaretakers > 3 && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-text-sub"
                    style={{
                      background: "var(--color-gray-100)",
                      border: "2px solid var(--color-surface)",
                    }}
                  >
                    +{communityStats.uniqueCaretakers - 3}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main leading-tight">
                {communityStats.uniqueCaretakers > 0 ? (
                  <>
                    이웃 {communityStats.uniqueCaretakers}명이 {cat.name}을(를) 함께 돌보고 있어요
                  </>
                ) : (
                  <>
                    {communityStats.likeUserCount}명이 이 아이를 지켜보고 있어요
                  </>
                )}
              </p>
              {communityStats.uniqueCaretakers > 0 && communityStats.likeUserCount > 0 && (
                <p className="text-[13px] text-text-sub mt-0.5 leading-tight">
                  좋아요 {communityStats.likeUserCount}명 · 최근 30일 기록
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 이 아이의 지킴이 — 최다 돌봄 시민 지명 인정. "안 써도 아무도 모른다"를 뒤집는
          이름 박힌 책임 (2026-08-29 PMF 회의 후보②). 3회 이상부터, 추모 아이는 제외.
          로그인 유저에게만 노출 — 비로그인 공개 시 특정 시민 신원+활동 노출(법률감사 H3) */}
      {currentUserId && guardian && guardian.count >= 3 && !cat.memorial_at && (
        <div className="px-4">
          <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
            <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
              <Award size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main leading-tight">
                <Link href={`/users/${guardian.authorId}`} className="hover:underline" style={{ color: "var(--color-primary)" }}>
                  {guardian.name}
                </Link>
                님 덕분에 {cat.name}의 돌봄이 이어지고 있어요
              </p>
              <p className="text-[13px] text-text-sub mt-0.5 leading-tight">
                돌봄 {guardian.count}회 · 첫 기록 후 {guardian.sinceDays}일째
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 이 아이에게 배정된 돌봄 기금 — 구매 후원 지정분 (2026-08-30). 있을 때만, 추모 아이 제외 */}
      {designatedFund > 0 && !cat.memorial_at && (
        <div className="px-4">
          <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
            <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
              <Heart size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main leading-tight">
                {cat.name}에게 모인 돌봄 기금 {designatedFund.toLocaleString()}원
              </p>
              <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
                이웃들의 쇼핑 후원이 이 아이의 중성화·치료에 우선 쓰여요
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 — 상태 칩·소개·등록 메타 */}
      <div className="px-4 mt-4 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cat.gender && cat.gender !== "unknown" && (
            <Badge>{GENDER_MAP[cat.gender]?.label}</Badge>
          )}
          {cat.neutered != null && (
            <Badge>{cat.neutered ? "중성화 완료" : "중성화 필요"}</Badge>
          )}
          {cat.health_status && cat.health_status !== "good" && healthTone && (
            <Badge color={healthTone.color}>
              <healthTone.Icon size={12} />
              {HEALTH_MAP[cat.health_status].label}
            </Badge>
          )}
          {cat.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        {cat.description && (
          <p className="text-[15px] text-text-main leading-relaxed">
            {cat.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-3 text-[13px] text-text-light flex-wrap">
          <CalendarDays size={12} />
          <span>{createdAt} 등록</span>
          {cat.caretaker_name && (
            <>
              <span>·</span>
              {cat.caretaker_id ? (
                <Link
                  href={`/users/${cat.caretaker_id}`}
                  className="font-semibold hover:underline"
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

      {/* 다이어리 — 시간이 쌓인 사진 갤러리 */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2.5">
          {/* 위 스탯카드의 "돌봄다이어리"(care_logs 개수)와 이름이 겹쳐서,
              두 숫자가 안 맞으면 고장난 것처럼 보였다. 이건 사진 모음이다. (2026-08-09) */}
          <h2 className="text-[17px] font-bold text-text-main tracking-tight">
            {cat.name} 사진첩
          </h2>
          {diary.totalPhotos > 0 && (
            <span className="text-[13px] text-text-sub tabular-nums">
              {diary.uniqueDays}일 · {diary.totalPhotos}장
            </span>
          )}
        </div>

        {/* 오늘 상태 안내 — 오늘 사진 있으면 칭찬, 없으면 유도 */}
        {(() => {
          const todayKst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
          const todayCount = diary.entries.filter(
            (e) => new Date(e.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) === todayKst,
          ).length;
          const hasTodayPhoto = todayCount > 0;
          return (
            <Link
              href={`/map?cat=${cat.id}`}
              className="flex items-center gap-3 mb-3 px-3 py-3 press"
              style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
            >
              <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
                {hasTodayPhoto ? <Sparkles size={20} /> : <Camera size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main leading-tight">
                  {hasTodayPhoto
                    ? `오늘 ${todayCount}장 채워졌어요`
                    : `오늘의 ${cat.name} 사진을 올려주세요`}
                </p>
                <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
                  {hasTodayPhoto
                    ? "한 장 더 남기면 다이어리가 더 두꺼워져요"
                    : "지도에서 사진과 함께 돌봄 기록을 남겨보세요"}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
            </Link>
          );
        })()}

        {diary.entries.length === 0 ? (
          // 빈 상태 — 첫 사진 유도
          <div className="py-6 text-center" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}>
            <p className="text-[13px] text-text-sub leading-relaxed">
              아직 사진이 없어요. 지도에서 한 장 올려주세요.
            </p>
            <Link
              href={`/map?cat=${cat.id}`}
              className="inline-flex items-center gap-1.5 mt-3 h-10 px-4 text-white text-[13px] font-semibold press-strong"
              style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
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
                    className="block overflow-hidden relative press-strong"
                    style={{ aspectRatio: "1/1", background: "var(--color-gray-100)", borderRadius: "var(--radius-card-sm)" }}
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
                      className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums"
                      style={{ background: "rgba(0,0,0,0.45)" }}
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
              className="mt-3 flex items-center justify-center gap-1.5 h-10 text-[13px] font-semibold press text-text-main"
              style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-input)" }}
            >
              <Camera size={13} />
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
            className="flex items-center justify-center gap-2 h-12 text-white press"
            style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
          >
            <PawPrint size={16} />
            <span className="text-[15px] font-semibold">지도에서 돌봄하기</span>
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
        {/* 돌봄 활동 확인서 — 기록을 민원·구청 협의·학대 신고용 증빙 자산으로 (2026-08-29 PMF 회의 후보③) */}
        {currentUserId && careCount > 0 && (
          <Link
            href={`/cats/${cat.id}/report`}
            className="flex items-center gap-3 px-3 py-3 press"
            style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main leading-tight">돌봄 활동 확인서 만들기</p>
              <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
                민원·구청 협의·학대 신고용 증빙 — 기록 {careCount}건이 근거가 돼요
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
          </Link>
        )}
        <p className="text-[11px] text-text-light text-center leading-relaxed mt-2">
          아이들 안전을 위해 지도 위치는 대략적인 활동 범위로만 표시돼요.
        </p>
      </div>

      {/* 가입 직후 착지 완주 바 — pending_care가 이 아이일 때만 뜬다 (회의 P0-1) */}
      {currentUserId && <FirstFeedBar catId={cat.id} catName={cat.name} />}
    </div>
  );
}

function StatCell({ icon, label, value, divider }: { icon: React.ReactNode; label: string; value: number; divider?: boolean }) {
  return (
    <div
      className="py-3 flex flex-col items-center justify-center gap-0.5"
      style={divider ? { borderLeft: "1px solid var(--color-border)" } : undefined}
    >
      <span className="text-text-sub">{icon}</span>
      <span className="text-[17px] font-bold text-text-main tabular-nums">{value}</span>
      <span className="text-[11px] text-text-sub">{label}</span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5"
      style={{
        borderRadius: "var(--radius-square)",
        background: "var(--color-surface)",
        border: `1px solid ${color ?? "var(--color-border)"}`,
        color: color ?? "var(--color-text-sub)",
      }}
    >
      {children}
    </span>
  );
}
