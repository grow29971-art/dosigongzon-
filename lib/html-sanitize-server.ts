// ══════════════════════════════════════════
// 서버 전용 HTML sanitizer — tips 본문 렌더 sink의 최종 방어선 (2026-07-26 보안 강화)
// 기존 정규식 sanitizer(lib/html-sanitize.ts, write-time)는 파서가 아니라 mutation XSS 이론적
// 우회 여지가 있어(admin self-XSS 한정), 렌더 시점에 파서 기반으로 한 번 더 정화한다.
//
// 2026-09-17: isomorphic-dompurify(jsdom) → sanitize-html(htmlparser2)로 교체.
//   jsdom 29 체인이 CJS에서 ESM 전용 @exodus/bytes를 require()해 Vercel에서 모듈 로드가 항상
//   실패했고(Node 22로 올려도 동일, 로그 실측), 매 요청이 정규식 폴백으로만 돌고 있었다.
//   sanitize-html은 DOM 없이 파싱하므로 런타임 의존이 없고 서버 번들에서 jsdom도 빠진다.
//   화이트리스트는 write-time 정규식 sanitizer와 정합.
// ══════════════════════════════════════════

import "server-only";
import sanitizeHtml from "sanitize-html";

// tips 본문에서 허용하는 태그/속성 — 헤딩 id는 목차(extractToc) 앵커 링크에 필요해 허용.
const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "code", "pre",
  "strong", "em", "b", "i", "u", "s", "del", "mark", "small", "sub", "sup",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div",
  "figure", "figcaption",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": ["id", "class", "title"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  // href/src 스킴 화이트리스트 — javascript:/data:(이미지 제외) 차단
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  // a target=_blank 탭내빙 방지
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === "_blank" ? { ...attribs, rel: "noopener noreferrer" } : attribs,
    }),
  },
  disallowedTagsMode: "discard",
};

/**
 * tips 본문 HTML을 파서 기반으로 정화(렌더 직전 sink 방어).
 * script/style/iframe/on*·javascript: 등 실행 벡터 제거, 허용 태그·속성만 통과.
 */
export async function sanitizeTipHtmlServer(html: string): Promise<string> {
  if (typeof html !== "string" || html.length === 0) return "";
  return sanitizeHtml(html, OPTIONS);
}
