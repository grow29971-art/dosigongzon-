// ══════════════════════════════════════════
// 간이 HTML sanitizer — 꿀팁게시판 admin 본문용
// admin-only 입력이지만 1) 사고로 깨진 마크업 차단 2) on*/javascript: 등
// 명백한 XSS 벡터 차단을 위해 화이트리스트 기반으로 정리.
// 완벽한 sanitizer는 아니므로 일반 유저 입력에는 사용 금지.
// ══════════════════════════════════════════

const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "code", "pre",
  "strong", "em", "b", "i", "u", "s", "del", "mark", "small", "sub", "sup",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div",
  "figure", "figcaption",
]);

// 항상 위험한 태그 — 내용까지 통째로 제거
const DANGEROUS_TAGS = ["script", "style", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "base", "svg", "math"];

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  // 모든 태그 공통: id, class만 허용 (인라인 스타일은 차단)
};

const GLOBAL_ALLOWED_ATTRS = new Set(["id", "class"]);

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("mailto:")) return true;
  return false;
}

// 블록 레벨 태그가 하나도 없으면 평문(plain text)으로 간주.
// 어드민이 그냥 복붙한 텍스트일 가능성이 높음.
const BLOCK_TAG_RE = /<(p|h[1-6]|ul|ol|li|blockquote|pre|table|div|figure|article|section|hr)\b/i;

/**
 * 평문 → HTML 자동 래핑.
 * 빈 줄로 단락 구분, 단일 줄바꿈은 <br>.
 * 이미 블록 태그(<p>/<h2>/<ul>/...)가 들어있으면 그대로 둠.
 */
function autoWrapPlainText(input: string): string {
  if (!input) return input;
  if (BLOCK_TAG_RE.test(input)) return input; // 이미 HTML 구조가 있음

  // zero-width 문자(​-‍, ﻿) 정리 — 네이버 블로그 등에서 복붙 시 흔함
  const cleaned = input.replace(/[​-‍﻿]/g, "");

  const paragraphs = cleaned
    .split(/\n\s*\n+/) // 빈 줄(연속 줄바꿈) = 단락 구분
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return input;

  return paragraphs
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * HTML 문자열을 화이트리스트 기반으로 정리.
 * 1) script/style/iframe 등 위험 태그는 내용까지 제거
 * 2) 화이트리스트 외 태그는 태그만 제거(텍스트는 보존)
 * 3) on* 이벤트 핸들러, javascript: URL 제거
 * 4) a 태그에 target=_blank 있으면 rel="noopener noreferrer" 강제
 */
export function sanitizeTipBody(input: string): string {
  if (typeof input !== "string") return "";

  // 0단계: 평문이면 단락/줄바꿈 자동 래핑 (다닥다닥 붙는 현상 방지)
  let html = autoWrapPlainText(input);

  // 1단계: 위험 태그 통째로 제거 (열림 태그~닫힘 태그 사이 모두)
  for (const tag of DANGEROUS_TAGS) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    html = html.replace(re, "");
    // self-closing 또는 미닫힘 형태도 제거
    const reSelf = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    html = html.replace(reSelf, "");
  }

  // HTML 주석 제거
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // 2단계: 모든 태그 순회하며 화이트리스트 적용
  // 정규식 단순화 — 완벽 파싱은 아니지만 admin 입력 정리에는 충분
  html = html.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (full, slash, tagNameRaw, attrsRaw) => {
      const tagName = tagNameRaw.toLowerCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        return ""; // 화이트리스트 외 태그 제거 (내부 텍스트는 보존)
      }
      if (slash === "/") {
        return `</${tagName}>`;
      }

      // 속성 정리
      const cleanAttrs: string[] = [];
      const attrRegex = /([a-zA-Z_:][a-zA-Z0-9_.\-:]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let m;
      let isExternalAnchor = false;
      while ((m = attrRegex.exec(attrsRaw)) !== null) {
        const attrName = m[1].toLowerCase();
        const attrValue = m[2] ?? m[3] ?? m[4] ?? "";

        // on* 이벤트 핸들러 차단
        if (attrName.startsWith("on")) continue;
        // style 차단 (CSS injection 방어)
        if (attrName === "style") continue;

        const tagAllowed = ALLOWED_ATTRS_BY_TAG[tagName];
        const isAllowed = GLOBAL_ALLOWED_ATTRS.has(attrName) || (tagAllowed && tagAllowed.has(attrName));
        if (!isAllowed) continue;

        // URL 속성 안전성 검사
        if ((attrName === "href" || attrName === "src") && attrValue) {
          if (!isSafeUrl(attrValue)) continue;
        }

        // a 태그 target=_blank 추적
        if (tagName === "a" && attrName === "target" && attrValue === "_blank") {
          isExternalAnchor = true;
        }

        // value escape (이미 attr이지만 따옴표는 escape)
        const escaped = attrValue.replace(/"/g, "&quot;");
        cleanAttrs.push(`${attrName}="${escaped}"`);
      }

      // a target=_blank → rel noopener 강제
      if (tagName === "a" && isExternalAnchor) {
        const hasRel = cleanAttrs.some((a) => a.startsWith("rel="));
        if (!hasRel) cleanAttrs.push(`rel="noopener noreferrer"`);
      }

      return cleanAttrs.length > 0
        ? `<${tagName} ${cleanAttrs.join(" ")}>`
        : `<${tagName}>`;
    },
  );

  return html;
}

/**
 * HTML에서 텍스트만 추출 (본문 첫 단락 → SEO description 자동 생성용).
 */
export function extractTextFromHtml(html: string, maxLen = 160): string {
  if (typeof html !== "string") return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

/**
 * 읽기 시간 추정 (한국어 기준 분당 500자).
 */
export function estimateReadingMinutes(html: string): number {
  const text = extractTextFromHtml(html, 100000);
  const minutes = Math.ceil(text.length / 500);
  return Math.max(1, minutes);
}
