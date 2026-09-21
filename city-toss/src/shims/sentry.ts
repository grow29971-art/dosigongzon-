// 미니앱은 Sentry 없음 — 콘솔로만.
export function captureException(e: unknown, _ctx?: unknown) { console.error(e); }
export function captureMessage(m: string, _ctx?: unknown) { console.warn(m); }
export function withScope(fn: (s: { setTag(): void; setExtra(): void; setContext(): void }) => void) { fn({ setTag() {}, setExtra() {}, setContext() {} }); }
export function setUser(_u?: unknown) {}
export function setTag(_k?: string, _v?: unknown) {}
