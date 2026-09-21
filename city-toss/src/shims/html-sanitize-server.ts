// 본 앱 lib/html-sanitize-server(sanitize-html, 서버 전용) 대체 — 브라우저 DOMParser 기반 동일 화이트리스트.
// tips 본문은 관리자만 쓰지만 렌더 sink 방어는 그대로 둔다.
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "code", "pre",
  "strong", "em", "b", "i", "u", "s", "del", "mark", "small", "sub", "sup", "a", "img",
  "table", "thead", "tbody", "tr", "th", "td", "span", "div", "figure", "figcaption",
]);
const COMMON_ATTRS = new Set(["id", "class", "title"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
};
function schemeOk(v: string, tag: string): boolean {
  const s = v.trim().toLowerCase();
  if (s.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/.test(s)) {
    return /^(https?|mailto):/.test(s) || (tag === "img" && s.startsWith("data:image/"));
  }
  return true; // 상대 경로
}
function clean(node: Element): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) { el.remove(); continue; }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const ok = COMMON_ATTRS.has(name) || TAG_ATTRS[tag]?.has(name);
      if (!ok || ((name === "href" || name === "src") && !schemeOk(attr.value, tag))) el.removeAttribute(attr.name);
    }
    if (tag === "a" && el.getAttribute("target") === "_blank") el.setAttribute("rel", "noopener noreferrer");
    clean(el);
  }
}
export async function sanitizeTipHtmlServer(html: string): Promise<string> {
  if (typeof html !== "string" || html.length === 0) return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}
