import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, MessageCircle, PawPrint, CalendarDays } from "lucide-react";
import { getCatByIdServer, getCatCommentsCountServer, getCatCareLogsCountServer } from "@/lib/cats-server";
import { GENDER_MAP, HEALTH_MAP } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import FollowButton from "@/app/components/FollowButton";
import ShareCatButton from "@/app/components/ShareCatButton";

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

  const [commentCount, careCount] = await Promise.all([
    getCatCommentsCountServer(cat.id),
    getCatCareLogsCountServer(cat.id),
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

  return (
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 헤더 (뒤로 가기) */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/map"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="지도로 돌아가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">지도</span>
      </div>

      {/* 커버 이미지 */}
      <div
        className="relative mx-4 mt-2 rounded-3xl overflow-hidden"
        style={{
          aspectRatio: "4 / 3",
          boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
          backgroundImage: `url('${photo}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0 p-4"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)",
          }}
        >
          <h1 className="text-[28px] font-extrabold text-white tracking-tight drop-shadow">
            {cat.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin size={12} color="#fff" />
            <span className="text-[12px] font-bold text-white">{region}</span>
          </div>
        </div>
      </div>

      {/* 갤러리 썸네일 (사진 2장 이상일 때) */}
      {cat.photo_urls && cat.photo_urls.length > 1 && (
        <div className="px-4 mt-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {cat.photo_urls.map((url, idx) => (
              <a
                key={idx}
                href={sanitizeImageUrl(url, "")}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-xl overflow-hidden active:scale-[0.97]"
                style={{
                  width: 72,
                  height: 72,
                  backgroundImage: `url('${sanitizeImageUrl(url, "")}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  border: idx === 0 ? "2px solid #C47E5A" : "1.5px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                }}
                aria-label={`사진 ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* 카운트 스탯 */}
      <div className="grid grid-cols-3 gap-2 px-4 mt-4">
        <StatCard emoji="❤️" label="좋아요" value={cat.like_count ?? 0} color="#E86B8C" />
        <StatCard emoji="🐾" label="돌봄 일지" value={careCount} color="#6B8E6F" />
        <StatCard emoji="💬" label="댓글" value={commentCount} color="#4A7BA8" />
      </div>

      {/* 프로필 뱃지 */}
      <div className="px-4 mt-4">
        <div
          className="bg-white rounded-2xl p-4"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {cat.gender && cat.gender !== "unknown" && (
              <Badge bg="#EEE8E0" fg="#8B65B8">
                {GENDER_MAP[cat.gender]?.emoji} {GENDER_MAP[cat.gender]?.label}
              </Badge>
            )}
            {cat.neutered != null && (
              <Badge
                bg={cat.neutered ? "#E8F5E9" : "#FFF3E0"}
                fg={cat.neutered ? "#6B8E6F" : "#E88D5A"}
              >
                {cat.neutered ? "✂️ 중성화 완료" : "중성화 필요"}
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
              <Badge key={t} bg="#EEE8E0" fg="#C47E5A">
                {t}
              </Badge>
            ))}
          </div>
          {cat.description && (
            <p className="text-[13.5px] text-text-main leading-relaxed">
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
                    style={{ color: "#C47E5A" }}
                  >
                    돌보미 {cat.caretaker_name}
                  </Link>
                ) : (
                  <span>돌보미 {cat.caretaker_name}</span>
                )}
                {cat.caretaker_id && (
                  <FollowButton userId={cat.caretaker_id} size="sm" />
                )}
              </>
            )}
          </div>
        </div>
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
        <Link
          href={`/map?cat=${cat.id}`}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-white active:scale-[0.98] transition-transform"
          style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
        >
          <PawPrint size={16} />
          <span className="text-[13.5px] font-extrabold">지도에서 돌봄하기</span>
        </Link>
        {cat.health_status !== "danger" && (
          <ShareCatButton
            catId={cat.id}
            name={cat.name}
            region={region}
            description={cat.description}
          />
        )}
        <p className="text-[10.5px] text-text-light text-center leading-relaxed mt-2">
          보안상 정확한 위치는 로그인 후 지도에서만 공개돼요.
          <br />동네 단톡방에 공유하면 더 많은 이웃이 지켜줘요 🫶
        </p>
      </div>
    </div>
  );
}

function StatCard({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  return (
    <div
      className="bg-white rounded-2xl py-3 flex flex-col items-center justify-center"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span className="text-[16px] font-extrabold" style={{ color }}>{value}</span>
      <span className="text-[10px] text-text-sub font-semibold mt-0.5">{label}</span>
    </div>
  );
}

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}
