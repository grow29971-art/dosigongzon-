// 홈 "지금 입양·임보 기다리는 아이들" 섹션.
// 서버 컴포넌트 — SSR로 즉시 렌더 (LCP·SEO 이득).
// adoption_status가 null이 아닌 고양이 중 최근 6마리 노출.

import Link from "next/link";
import Image from "next/image";
import { HandHeart, ArrowRight } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";
import { ADOPTION_MAP, type AdoptionStatus } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

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
          <HandHeart size={15} style={{ color: "#C47E5A" }} />
          <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
            지금 가족·임보를 기다려요
          </h2>
        </div>
        <Link
          href="/map"
          className="text-[11px] font-bold inline-flex items-center gap-0.5"
          style={{ color: "#C47E5A" }}
        >
          지도 <ArrowRight size={11} />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {cats.map((c) => {
          const photo = sanitizeImageUrl(
            c.photo_url,
            "https://placehold.co/300x300/EEEAE2/2A2A28?text=%3F",
          );
          const meta = c.adoption_status ? ADOPTION_MAP[c.adoption_status] : null;
          return (
            <Link
              key={c.id}
              href={`/cats/${c.id}`}
              className="block rounded-2xl overflow-hidden bg-white active:scale-[0.97] transition-transform"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="relative" style={{ aspectRatio: "1 / 1" }}>
                <Image
                  src={photo}
                  alt={c.name}
                  fill
                  sizes="(max-width: 640px) 33vw, 160px"
                  style={{ objectFit: "cover" }}
                />
                {meta && (
                  <span
                    className="absolute top-1.5 left-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md z-10"
                    style={{
                      backgroundColor: meta.color,
                      color: "#fff",
                    }}
                  >
                    {meta.emoji} {meta.short}
                  </span>
                )}
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[11.5px] font-extrabold text-text-main truncate">{c.name}</p>
                {c.region && (
                  <p className="text-[9.5px] text-text-light truncate mt-0.5">{c.region}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
