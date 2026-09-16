// 홈 "지금 입양·임보 기다리는 아이들" 섹션.
// 서버 컴포넌트 — SSR로 즉시 렌더 (LCP·SEO 이득).
// adoption_status가 null이 아닌 고양이 중 최근 6마리 노출.
// 2026-09-16 리디자인: 그림자 카드 → 헤어라인 카드, 플레이스홀더 이미지 → 마커 아트, 상태 배지 회색.

import Link from "next/link";
import Image from "next/image";
import { HandHeart, ChevronRight } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";
import { ADOPTION_MAP, type AdoptionStatus } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { catArtWalkSvg } from "@/lib/cat-art";

type CatRow = {
  id: string;
  name: string;
  region: string | null;
  photo_url: string | null;
  adoption_status: AdoptionStatus;
};

export default async function AdoptionSeekingSection() {
  const supabase = createAnonClient();

  const { data } = await supabase
    .from("cats")
    .select("id, name, region, photo_url, adoption_status")
    .not("adoption_status", "is", null)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(6);

  const cats = (data ?? []) as CatRow[];
  if (cats.length === 0) return null;

  return (
    <section className="px-5 mt-6">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <HandHeart size={15} className="text-text-sub" />
          <h2 className="text-[15px] font-bold text-text-main tracking-tight">
            지금 가족·임보를 기다려요
          </h2>
        </div>
        <Link
          href="/map"
          className="text-[13px] font-medium inline-flex items-center gap-0.5 text-text-sub"
        >
          지도 <ChevronRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {cats.map((c) => {
          const photo = sanitizeImageUrl(c.photo_url, "") || null;
          const meta = c.adoption_status ? ADOPTION_MAP[c.adoption_status] : null;
          return (
            <Link
              key={c.id}
              href={`/cats/${c.id}`}
              className="block overflow-hidden press"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-card-sm)",
              }}
            >
              <div className="relative" style={{ aspectRatio: "1 / 1", background: "var(--color-gray-100)" }}>
                {photo ? (
                  <Image
                    src={photo}
                    alt={c.name}
                    fill
                    sizes="(max-width: 640px) 33vw, 160px"
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden
                    dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.id, 56, { walking: false }) }}
                  />
                )}
                {meta && (
                  <span
                    className="absolute top-1.5 left-1.5 text-[11px] font-semibold px-1.5 py-0.5 chip-square z-10"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-sub)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {meta.short}
                  </span>
                )}
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[13px] font-semibold text-text-main truncate">{c.name}</p>
                {c.region && (
                  <p className="text-[11px] text-text-light truncate mt-0.5">{c.region}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
