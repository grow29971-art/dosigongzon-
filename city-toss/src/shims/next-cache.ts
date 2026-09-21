// next/cache 대체 — 미니앱은 캐시 계층이 없다. 함수는 그대로 통과.
export const unstable_cache = <T,>(fn: T, _keys?: string[], _opts?: unknown) => fn;
export function revalidatePath(_p?: string) {}
export function revalidateTag(_t?: string) {}
export function cacheLife(_p?: unknown) {}
export function cacheTag(_t?: string) {}
