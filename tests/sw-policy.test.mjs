// Service Worker 캐시·푸시 정책 테스트 — node --test tests/sw-policy.test.mjs
// public/sw.js를 vm 컨텍스트에 로드해 실제 핸들러 동작을 검증한다 (2026-07-26 보안 패치 회귀 가드).
// 핵심 불변식:
//   1. 개인화 HTML/RSC는 SW가 캐시는커녕 관여도 하지 않는다 (로그아웃 후 오프라인 노출 차단)
//   2. 공개 allowlist 경로만 캐시하되 no-store/private 응답은 저장하지 않는다
//   3. push data.url은 same-origin + 허용 pathname만 — 외부/스킴 URL은 "/"로 강등
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGIN = "https://dosigongzon.com";
const src = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

const fakeRes = (headers = {}, { ok = true, type = "basic" } = {}) => ({
  ok,
  type,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  clone() { return this; },
});

function makeSw({ fetchImpl } = {}) {
  const listeners = new Map();
  const notifications = [];
  const cachePuts = [];
  const openedWindows = [];
  const cache = {
    put: async (req) => { cachePuts.push(typeof req === "string" ? req : req.url); },
    match: async () => undefined,
  };
  const context = {
    URL,
    console,
    caches: {
      keys: async () => [],
      delete: async () => true,
      open: async () => cache,
      match: async () => undefined,
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (u) => { openedWindows.push(u); return { url: u }; },
      claim: () => {},
    },
    fetch: fetchImpl ?? (async () => fakeRes()),
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type, fn) => {
        const arr = listeners.get(type) ?? [];
        arr.push(fn);
        listeners.set(type, arr);
      },
      skipWaiting: () => {},
      registration: {
        showNotification: (title, options) => { notifications.push({ title, options }); },
      },
    },
  };
  vm.createContext(context);
  new vm.Script(src, { filename: "sw.js" }).runInContext(context);
  const fire = (type, event) => {
    for (const fn of listeners.get(type) ?? []) fn(event);
  };
  return { fire, notifications, cachePuts, openedWindows };
}

function fetchEvent(url, { mode = "no-cors", method = "GET" } = {}) {
  const state = { responded: false, promise: null };
  const e = {
    request: { url, mode, method },
    respondWith: (p) => { state.responded = true; state.promise = Promise.resolve(p); },
    waitUntil: () => {},
  };
  return { e, state };
}

function pushEvent(data) {
  const state = { promise: null };
  const e = {
    data: { json: () => data },
    waitUntil: (p) => { state.promise = Promise.resolve(p); },
  };
  return { e, state };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// ── 캐시 정책 ──

test("개인화 HTML(navigate, 비allowlist)은 SW가 관여하지 않는다", () => {
  const sw = makeSw();
  for (const path of ["/mypage", "/messages", "/", "/community", "/shop/abc"]) {
    const { e, state } = fetchEvent(ORIGIN + path, { mode: "navigate" });
    sw.fire("fetch", e);
    assert.equal(state.responded, false, `${path}는 SW 미관여여야 함`);
  }
});

test("RSC 페이로드(비navigate 동적 fetch)는 캐시 관여 없음", () => {
  const sw = makeSw();
  const { e, state } = fetchEvent(ORIGIN + "/community?_rsc=abc123", { mode: "cors" });
  sw.fire("fetch", e);
  assert.equal(state.responded, false);
});

test("/api/ 요청과 비GET 요청은 무조건 네트워크", () => {
  const sw = makeSw();
  const api = fetchEvent(ORIGIN + "/api/shop/buy", { mode: "cors" });
  sw.fire("fetch", api.e);
  assert.equal(api.state.responded, false);
  const post = fetchEvent(ORIGIN + "/protection", { mode: "navigate", method: "POST" });
  sw.fire("fetch", post.e);
  assert.equal(post.state.responded, false);
});

test("공개 allowlist HTML(/protection)은 network-first + 캐시 저장", async () => {
  const sw = makeSw();
  const { e, state } = fetchEvent(ORIGIN + "/protection", { mode: "navigate" });
  sw.fire("fetch", e);
  assert.equal(state.responded, true);
  await state.promise;
  await flush();
  assert.equal(sw.cachePuts.length, 1);
});

test("no-store/private 응답은 allowlist 경로여도 캐시하지 않는다", async () => {
  for (const cc of ["no-store", "private, no-cache"]) {
    const sw = makeSw({ fetchImpl: async () => fakeRes({ "cache-control": cc }) });
    const { e, state } = fetchEvent(ORIGIN + "/protection", { mode: "navigate" });
    sw.fire("fetch", e);
    await state.promise;
    await flush();
    assert.equal(sw.cachePuts.length, 0, `Cache-Control: ${cc}는 저장 금지`);
  }
});

test("/_next/static/은 SW가 처리(cache-first), 기타 비정적 경로는 미관여", () => {
  const sw = makeSw();
  const stat = fetchEvent(ORIGIN + "/_next/static/chunks/app.js");
  sw.fire("fetch", stat.e);
  assert.equal(stat.state.responded, true);
  const dyn = fetchEvent(ORIGIN + "/some-random-fetch");
  sw.fire("fetch", dyn.e);
  assert.equal(dyn.state.responded, false);
});

// ── push data.url 제한 ──

test("push: 외부 origin URL은 '/'로 강등", async () => {
  const sw = makeSw();
  const { e, state } = pushEvent({ title: "t", body: "b", url: "https://evil.example/phish" });
  sw.fire("push", e);
  await state.promise;
  assert.equal(sw.notifications[0].options.data.url, "/");
});

test("push: javascript: 등 스킴 URL은 '/'로 강등", async () => {
  const sw = makeSw();
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.example/x"]) {
    const { e, state } = pushEvent({ url: bad });
    sw.fire("push", e);
    await state.promise;
  }
  for (const n of sw.notifications) assert.equal(n.options.data.url, "/");
});

test("push: 허용 pathname은 same-origin 상대경로로 유지", async () => {
  const sw = makeSw();
  const cases = [
    ["/cats/abc-123", "/cats/abc-123"],
    ["/messages", "/messages"],
    ["/map", "/map"],
    ["/mypage/journey", "/mypage/journey"],
    ["/#my-cats", "/#my-cats"],
  ];
  for (const [input] of cases) {
    const { e, state } = pushEvent({ url: input });
    sw.fire("push", e);
    await state.promise;
  }
  cases.forEach(([, expected], i) => {
    assert.equal(sw.notifications[i].options.data.url, expected);
  });
});

test("push: 허용 목록 밖 pathname(/admin 등)은 '/'로 강등", async () => {
  const sw = makeSw();
  const { e, state } = pushEvent({ url: "/admin/users" });
  sw.fire("push", e);
  await state.promise;
  assert.equal(sw.notifications[0].options.data.url, "/");
});

test("notificationclick: 오염된 저장 URL도 클릭 시점 재검증으로 외부 이동 차단", async () => {
  const sw = makeSw();
  const state = { promise: null };
  sw.fire("notificationclick", {
    notification: { close: () => {}, data: { url: "https://evil.example/x" } },
    waitUntil: (p) => { state.promise = Promise.resolve(p); },
  });
  await state.promise;
  assert.deepEqual(sw.openedWindows, ["/"]);
});
