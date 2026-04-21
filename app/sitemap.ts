import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SEOUL_GUS } from "@/lib/seoul-regions";

const SITE_URL = "https://dosigongzon.com";

// 1시간마다 재생성 (신규 고양이 등록을 반영)
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 정적 공개 페이지 (로그인 필요한 경로 제외 — /community, /neighborhood, /messages 등)
  const staticRoutes: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/",                             priority: 1.0,  changeFrequency: "daily" },
    { path: "/map",                          priority: 0.95, changeFrequency: "hourly" },
    { path: "/areas",                        priority: 0.9,  changeFrequency: "daily" },
    { path: "/about",                        priority: 0.8,  changeFrequency: "monthly" },
    { path: "/guide",                        priority: 0.85, changeFrequency: "monthly" },
    { path: "/hospitals",                    priority: 0.8,  changeFrequency: "weekly" },
    { path: "/shelters",                     priority: 0.7,  changeFrequency: "weekly" },
    { path: "/protection",                   priority: 0.85, changeFrequency: "weekly" },
    { path: "/protection/emergency-guide",   priority: 0.7,  changeFrequency: "monthly" },
    { path: "/protection/kitten-guide",      priority: 0.7,  changeFrequency: "monthly" },
    { path: "/protection/trapping-guide",    priority: 0.7,  changeFrequency: "monthly" },
    { path: "/protection/legal",             priority: 0.65, changeFrequency: "monthly" },
    { path: "/protection/district-contacts", priority: 0.65, changeFrequency: "monthly" },
    { path: "/protection/pharmacy-guide",    priority: 0.7,  changeFrequency: "weekly" },
    { path: "/protection/feeding-guide",     priority: 0.75, changeFrequency: "monthly" },
    { path: "/protection/shelter-guide",     priority: 0.75, changeFrequency: "monthly" },
    { path: "/protection/disease-guide",     priority: 0.8,  changeFrequency: "monthly" },
    { path: "/login",                        priority: 0.3,  changeFrequency: "yearly" },
    { path: "/signup",                       priority: 0.3,  changeFrequency: "yearly" },
    { path: "/privacy",                      priority: 0.2,  changeFrequency: "yearly" },
    { path: "/terms",                        priority: 0.2,  changeFrequency: "yearly" },
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // 서울 25개 구 SEO 랜딩
  for (const g of SEOUL_GUS) {
    entries.push({
      url: `${SITE_URL}/areas/${g.slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    });
    // 구 아래 동별 랜딩
    for (const d of g.dongs) {
      entries.push({
        url: `${SITE_URL}/areas/${g.slug}/${encodeURIComponent(d)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  // 동적 고양이 페이지 — /cats/[id] (공개 페이지, 위치는 퍼징됨)
  try {
    const supabase = await createClient();
    const { data: cats } = await supabase
      .from("cats")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(5000); // 안전장치: sitemap 1개 당 최대 5만 URL

    for (const c of (cats ?? []) as { id: string; created_at: string }[]) {
      entries.push({
        url: `${SITE_URL}/cats/${c.id}`,
        lastModified: new Date(c.created_at),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  } catch {
    // DB 접근 실패해도 정적 경로는 제공
  }

  return entries;
}
