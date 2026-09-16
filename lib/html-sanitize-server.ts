// ══════════════════════════════════════════
// 서버 전용 HTML sanitizer (DOMPurify) — 2026-07-26 보안 강화
// tips 본문 렌더 sink의 최종 방어선. 기존 정규식 sanitizer(lib/html-sanitize.ts,
// write-time)는 파서가 아니라 mutation XSS 이론적 우회 여지가 있어(admin self-XSS 한정),
// 렌더 시점에 DOMPurify로 한 번 더 정화한다.
//
// ⚠️ jsdom 기반이라 node 런타임 서버 컴포넌트/라우트에서만 import (클라이언트 번들 금지).
//    lib/html-sanitize.ts(정규식)는 클라이언트에서도 쓰이므로 이 파일과 분리 유지.
//
// 2026-09-16: isomorphic-dompurify → jsdom → html-encoding-sniffer(CJS)가 ESM 전용
// @exodus/bytes를 require()해 Node 20 런타임에서 ERR_REQUIRE_ESM으로 모듈 로드 자체가 실패,
// /tips/[slug]가 통째로 500 나던 문제. 모듈을 지연 로드하고 실패 시 정규식 sanitizer로
// 폴백한다(write-time 정화와 동일 규칙이라 XSS 방어선은 유지, 페이지는 살아 있음).
// package.json engines를 Node 22.x로 올려 정상 경로(DOMPurify)가 돌게 한 것과 이중 조치.
// ══════════════════════════════════════════

import "server-only";
import { sanitizeTipBody } from "@/lib/html-sanitize";

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

type Purifier = { sanitize: (html: string, cfg: Record<string, unknown>) => string };
let purifierPromise: Promise<Purifier | null> | null = null;

async function loadPurifier(): Promise<Purifier | null> {
  if (!purifierPromise) {
    purifierPromise = import("isomorphic-dompurify")
      .then((m) => (m.default ?? m) as unknown as Purifier)
      .catch((err) => {
        console.error("[html-sanitize-server] DOMPurify 로드 실패 — 정규식 sanitizer로 폴백:", err);
        return null;
      });
  }
  return purifierPromise;
}

/**
 * tips 본문 HTML을 DOMPurify로 정화(렌더 직전 sink 방어).
 * - script/style/iframe/on* /javascript: 등 실행 벡터 제거
 * - a target=_blank에는 rel=noopener 강제(탭내빙 방지)
 * - data:/blob: URL은 이미지 외 차단
 * DOMPurify 모듈 로드가 실패하면 정규식 sanitizer(sanitizeTipBody)로 폴백한다.
 */
export async function sanitizeTipHtmlServer(html: string): Promise<string> {
  if (typeof html !== "string" || html.length === 0) return "";
  const purifier = await loadPurifier();
  if (!purifier) return sanitizeTipBody(html);
  try {
    return purifier.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ["target"],
      // a 태그 target=_blank 안전화 — DOMPurify 훅 없이 옵션으로 처리
      FORBID_ATTR: ["style"],
    });
  } catch (err) {
    console.error("[html-sanitize-server] DOMPurify 실행 실패 — 정규식 sanitizer로 폴백:", err);
    return sanitizeTipBody(html);
  }
}
