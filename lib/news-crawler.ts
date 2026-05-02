// ══════════════════════════════════════════
// 도시공존 — 길고양이 뉴스 크롤러
// Google News RSS에서 키워드별 기사 수집 → news 테이블 자동 게시용
// 외부 의존성 없음. 정규식으로 RSS XML 파싱.
// ══════════════════════════════════════════

import { isSafeHttpUrl, isSafeImageUrl } from "@/lib/url-validate";
import type { NewsBadgeType } from "@/lib/news-repo";

export interface CrawledNewsItem {
  title: string;
  description: string | null;
  source_url: string;
  source_name: string | null;
  image_url: string | null;
  badge_type: NewsBadgeType;
  pub_date: string;
}

// 검색 쿼리 목록 (Google News 한국어/한국 지역)
const QUERIES: ReadonlyArray<string> = [
  "길고양이",
  "길냥이",
  "캣맘",
  "TNR 길고양이",
  "유기묘 구조",
  "고양이 학대",
  "동물보호법 고양이",
];

// 화이트리스트: 본문에 이 중 하나는 반드시 포함
const WHITELIST: ReadonlyArray<string> = [
  "길고양이", "길냥이", "캣맘", "캣대디", "tnr", "중성화",
  "유기묘", "유기 고양이", "고양이",
];

// 블랙리스트: 광고/쇼핑성 노이즈 차단
const BLACKLIST: ReadonlyArray<string> = [
  "분양", "판매", "쇼핑", "할인", "특가", "쿠폰", "렌탈",
  "이벤트 응모", "신상품", "브랜드 출시",
];

const TITLE_MAX = 200;
const DESC_MAX = 200;

// ── HTML 엔티티/CDATA 처리 ──
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    });
}

function stripCdata(s: string): string {
  const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1] : s;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(xmlBlock: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xmlBlock.match(re);
  if (!m) return null;
  return decodeEntities(stripCdata(m[1].trim())).trim();
}

function extractFirstImage(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1]) : null;
}

// ── 분류/필터 ──
function classifyBadge(title: string, desc: string): NewsBadgeType {
  const t = `${title} ${desc}`;
  if (/(구조|구출|학대|사고|긴급|화상|폐사|살해|로드킬)/.test(t)) return "urgent";
  if (/(TNR|중성화)/i.test(t)) return "tnr";
  if (/(법|조례|판결|처벌|개정|시행령)/.test(t)) return "law";
  if (/(축제|페스타|페스티벌|박람회|캠페인|입양 행사|입양행사)/.test(t)) return "event";
  return "notice";
}

function isRelevant(title: string, desc: string): boolean {
  const text = `${title} ${desc}`.toLowerCase();
  if (BLACKLIST.some((b) => text.includes(b))) return false;
  return WHITELIST.some((w) => text.includes(w));
}

// ── RSS 호출 ──
function buildRssUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: "ko",
    gl: "KR",
    ceid: "KR:ko",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

interface RawItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string | null;
}

function parseItems(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: extractTag(block, "title") ?? "",
      link: extractTag(block, "link") ?? "",
      pubDate: extractTag(block, "pubDate") ?? "",
      description: extractTag(block, "description") ?? "",
      source: extractTag(block, "source"),
    });
  }
  return items;
}

function normalizeItem(raw: RawItem): CrawledNewsItem | null {
  if (!raw.title || !raw.link) return null;
  if (!isSafeHttpUrl(raw.link)) return null;

  const descText = stripHtml(raw.description);
  const image = extractFirstImage(raw.description);

  if (!isRelevant(raw.title, descText)) return null;

  // Google News 제목 패턴 "기사 제목 - 출처명" 분리
  const lastDash = raw.title.lastIndexOf(" - ");
  let cleanTitle = raw.title;
  let sourceName: string | null = raw.source;
  if (lastDash > 0 && !sourceName) {
    cleanTitle = raw.title.slice(0, lastDash).trim();
    sourceName = raw.title.slice(lastDash + 3).trim();
  } else if (lastDash > 0 && sourceName) {
    cleanTitle = raw.title.slice(0, lastDash).trim();
  }

  let pubDate: string;
  const parsed = new Date(raw.pubDate);
  pubDate = Number.isFinite(parsed.getTime())
    ? parsed.toISOString()
    : new Date().toISOString();

  const safeImage =
    image && isSafeImageUrl(image) ? image.slice(0, 2048) : null;

  return {
    title: cleanTitle.slice(0, TITLE_MAX),
    description: descText ? descText.slice(0, DESC_MAX) : null,
    source_url: raw.link.slice(0, 2048),
    source_name: sourceName ? sourceName.slice(0, 100) : null,
    image_url: safeImage,
    badge_type: classifyBadge(cleanTitle, descText),
    pub_date: pubDate,
  };
}

async function fetchByQuery(query: string): Promise<CrawledNewsItem[]> {
  const url = buildRssUrl(query);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "dosigongzon-newsbot/1.0 (+https://dosigongzon.com)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });
  } catch (e) {
    console.warn(`[news-crawler] fetch error (${query}):`, e);
    return [];
  }
  if (!res.ok) {
    console.warn(`[news-crawler] RSS ${res.status} (${query})`);
    return [];
  }
  const xml = await res.text();
  const raws = parseItems(xml);
  const out: CrawledNewsItem[] = [];
  for (const r of raws) {
    const norm = normalizeItem(r);
    if (norm) out.push(norm);
  }
  return out;
}

/**
 * 모든 키워드를 순차 수집 후 source_url 기준 dedupe.
 * 호출자(cron)는 source_url UNIQUE 제약으로 DB 레벨 dedupe까지 보장됨.
 */
export async function crawlAll(): Promise<CrawledNewsItem[]> {
  const all: CrawledNewsItem[] = [];
  for (const q of QUERIES) {
    try {
      const items = await fetchByQuery(q);
      all.push(...items);
    } catch (e) {
      console.warn(`[news-crawler] query failed: ${q}`, e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const seen = new Set<string>();
  const unique: CrawledNewsItem[] = [];
  for (const item of all) {
    if (seen.has(item.source_url)) continue;
    seen.add(item.source_url);
    unique.push(item);
  }
  return unique;
}
