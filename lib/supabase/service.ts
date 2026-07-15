// ══════════════════════════════════════════
// 도시공존 — service_role Supabase 클라이언트 팩토리 (서버 전용)
// 50여 개 API 라우트에 복붙돼 있던 인라인 생성을 통합 (2026-07-15).
// service_role 사용 지점을 이 파일 하나로 수렴시켜 보안 감사를 단순화한다.
//
// ⚠️ 절대 클라이언트 컴포넌트에서 import 금지 — service_role 키는 RLS를 우회한다.
//    (server-only 라우트/lib에서만 사용. 브라우저는 lib/supabase/client.ts)
// ══════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

/**
 * service_role 클라이언트 생성. 요청 단위 one-shot 사용 전제.
 * 서버 권장 옵션(세션 비영속·토큰 자동갱신 없음)으로 고정.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
