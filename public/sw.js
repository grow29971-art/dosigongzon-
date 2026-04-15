const CACHE_NAME = "dosigongzon-v3";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME));
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

  // HTML 페이지 요청 → 네트워크 우선 (실패 시 캐시)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 정적 자원 → 캐시 우선 (없으면 네트워크)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      });
    })
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
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
