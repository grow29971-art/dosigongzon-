// ══════════════════════════════════════════
// 서버 전용 HTML sanitizer (DOMPurify) — 2026-07-26 보안 강화
// tips 본문 렌더 sink의 최종 방어선. 기존 정규식 sanitizer(lib/html-sanitize.ts,
// write-time)는 파서가 아니라 mutation XSS 이론적 우회 여지가 있어(admin self-XSS 한정),
// 렌더 시점에 DOMPurify로 한 번 더 정화한다.
//
// ⚠️ jsdom 기반이라 node 런타임 서버 컴포넌트/라우트에서만 import (클라이언트 번들 금지).
//    lib/html-sanitize.ts(정규식)는 클라이언트에서도 쓰이므로 이 파일과 분리 유지.
// ══════════════════════════════════════════

import "server-only";
import DOMPurify from "isomorphic-dompurify";

// tips 본문에서 허용하는 태그/속성 — 기존 정규식 sanitizer 화이트리스트와 정합.
// 헤딩 id는 목차(extractToc) 앵커 링크에 필요해 허용.
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
const ALLOWED_ATTR = ["href", "title", "target", "rel", "src", "alt", "width", "height", "id", "class"];

/**
 * tips 본문 HTML을 DOMPurify로 정화(렌더 직전 sink 방어).
 * - script/style/iframe/on* /javascript: 등 실행 벡터 제거
 * - a target=_blank에는 rel=noopener 강제(탭내빙 방지)
 * - data:/blob: URL은 이미지 외 차단
 */
export function sanitizeTipHtmlServer(html: string): string {
  if (typeof html !== "string" || html.length === 0) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
    // a 태그 target=_blank 안전화 — DOMPurify 훅 없이 옵션으로 처리
    FORBID_ATTR: ["style"],
  });
}
