const CACHE_NAME = "dosigongzon-v8";

// ── 캐시 정책 (2026-07-26 보안 패치) ─────────────────────────
// 이전(v7)에는 same-origin GET 응답을 사실상 전부 캐시해서, 로그인 개인화
// HTML·RSC 페이로드가 Cache Storage에 남아 로그아웃/계정 전환 후 오프라인에서
// 이전 사용자 화면이 노출될 수 있었다.
// 원칙: 동적 HTML·RSC는 캐시하지 않는다. 공개·정적임이 확인된 경로만 allowlist.
// (v8 버전 범프 + install의 전체 캐시 삭제로 기존 개인화 캐시도 청소된다)

// 완전 공개(비로그인과 동일 응답) HTML — network-first, 오프라인 fallback용
const PUBLIC_HTML_PATHS = ["/protection", "/protection/pharmacy-guide"];
const PUBLIC_HTML_PREFIXES = ["/tips"];

// 공개 정적 자원 — 이 경로만 캐시. 그 외 same-origin GET(RSC ?_rsc= 등)은 캐시 금지.
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/images/", "/boss/", "/pve/"];
const STATIC_FILES = ["/manifest.json", "/favicon.ico"];

const isPublicHtml = (path) =>
  PUBLIC_HTML_PATHS.includes(path) ||
  PUBLIC_HTML_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

const isPublicStatic = (path) =>
  STATIC_PREFIXES.some((p) => path.startsWith(p)) || STATIC_FILES.includes(path);

// 서버가 캐시 금지를 선언한 응답(no-store/private)은 allowlist 경로여도 저장 안 함.
const cacheable = (req, res) => {
  if (req.method !== "GET" || !res.ok) return false;
  if (res.type !== "basic" && res.type !== "default") return false;
  const cc = (res.headers.get("Cache-Control") || "").toLowerCase();
  if (cc.includes("no-store") || cc.includes("private")) return false;
  return true;
};

self.addEventListener("install", (e) => {
  // 이전 캐시 즉시 삭제
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => caches.open(CACHE_NAME))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // API, 인증, 외부, 비GET 요청은 무조건 네트워크
  if (
    e.request.method !== "GET" ||
    e.request.url.includes("/api/") ||
    e.request.url.includes("supabase") ||
    !e.request.url.startsWith(self.location.origin)
  ) return;

  let path;
  try {
    path = new URL(e.request.url).pathname;
  } catch (_) { return; }

  // HTML 페이지 요청 → 공개 allowlist만 network-first + 캐시. 나머지는 SW 미관여.
  if (e.request.mode === "navigate") {
    if (!isPublicHtml(path)) return;
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (cacheable(e.request, res)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // navigate가 아닌 요청은 공개 정적 자원만 취급 (RSC 페이로드 등 동적 fetch 제외)
  if (!isPublicStatic(path)) return;

  // /_next/static/ — content-hashed immutable. cache-first로 2nd 페이지뷰 LCP 단축.
  // (해시가 바뀌면 새 URL이 되어 새로 fetch)
  if (path.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (cacheable(e.request, res)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
          }
          return res;
        });
      }),
    );
    return;
  }

  // 기타 공개 정적 자원 → 네트워크 우선 (실패 시 캐시)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (cacheable(e.request, res)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// push data.url 검증 — same-origin + 허용 pathname만 연다. 푸시 페이로드가
// 오염돼도 외부 사이트/스킴 URL로 창을 열지 못하게 차단 (2026-07-26 보안 패치).
const PUSH_PATH_PREFIXES = [
  "/cats", "/messages", "/map", "/mypage", "/community",
  "/notifications", "/experiment", "/shop", "/protection", "/tips",
];
const safeNotificationUrl = (raw) => {
  try {
    const u = new URL(raw || "/", self.location.origin);
    if (u.origin !== self.location.origin) return "/";
    const ok = u.pathname === "/" ||
      PUSH_PATH_PREFIXES.some((p) => u.pathname === p || u.pathname.startsWith(p + "/"));
    return ok ? u.pathname + u.search + u.hash : "/";
  } catch (_) { return "/"; }
};

// 푸시 알림 수신
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (_) { /* 비JSON 페이로드 — throw하면 알림 자체가 안 뜨므로 기본 알림으로 처리 */ }
  const title = data.title || "도시공존";
  const options = {
    body: data.body || "새로운 알림이 있어요",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: safeNotificationUrl(data.url) },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 시 해당 페이지로 이동
// 2026-07-22 수리: 기존 includes(url) 매칭은 url이 "/"일 때 아무 열린 페이지에나
// focus만 하고 약속한 화면으로 이동하지 않았다(리텐션 회의 발견).
// → pathname 정확 일치 시에만 focus, 아니면 기존 창을 navigate, 없으면 새 창.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // 저장 시점에 검증됐어도 클릭 시점에 한 번 더 — 이중 방어
  const url = safeNotificationUrl(e.notification.data?.url);
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      let targetPath = url;
      try {
        targetPath = new URL(url, self.location.origin).pathname;
      } catch (_) { /* 상대경로 그대로 사용 */ }
      for (const client of list) {
        try {
          if (new URL(client.url).pathname === targetPath && "focus" in client) {
            return client.focus();
          }
        } catch (_) { /* URL 파싱 실패 시 다음 후보 */ }
      }
      const existing = list.find((c) => "navigate" in c && "focus" in c);
      if (existing) {
        return existing
          .navigate(url)
          .then((c) => (c ? c.focus() : clients.openWindow(url)))
          .catch(() => clients.openWindow(url));
      }
      return clients.openWindow(url);
    })
  );
});
