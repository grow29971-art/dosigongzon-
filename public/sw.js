const CACHE_NAME = "dosigongzon-v7";

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
  // API, 인증, 외부 요청은 무조건 네트워크
  if (
    e.request.url.includes("/api/") ||
    e.request.url.includes("supabase") ||
    !e.request.url.startsWith(self.location.origin)
  ) return;

  // 캐시 안전 조건 — GET + 정상 응답 + same-origin basic 응답만 저장.
  // POST/PUT/DELETE는 cache.put이 throw, opaque/error 응답은 캐시해도 의미 없음.
  const cacheable = (req, res) =>
    req.method === "GET" && res.ok && (res.type === "basic" || res.type === "default");

  // HTML 페이지 요청 → 네트워크 우선 (실패 시 캐시)
  if (e.request.mode === "navigate") {
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

  // /_next/static/ — content-hashed immutable. cache-first로 2nd 페이지뷰 LCP 단축.
  // (해시가 바뀌면 새 URL이 되어 새로 fetch)
  if (e.request.url.includes("/_next/static/")) {
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

  // 기타 정적 자원 → 네트워크 우선 (실패 시 캐시)
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

// 푸시 알림 수신
self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || "도시공존";
  const options = {
    body: data.body || "새로운 알림이 있어요",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 시 해당 페이지로 이동
// 2026-07-22 수리: 기존 includes(url) 매칭은 url이 "/"일 때 아무 열린 페이지에나
// focus만 하고 약속한 화면으로 이동하지 않았다(리텐션 회의 발견).
// → pathname 정확 일치 시에만 focus, 아니면 기존 창을 navigate, 없으면 새 창.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
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
