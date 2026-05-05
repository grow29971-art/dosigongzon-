"use server";

import { revalidatePath } from "next/cache";

// 어드민에서 글 발행/수정/삭제 후 호출 — /tips 와 해당 글 캐시를 즉시 무효화.
// admin 권한 검증은 호출 시점이 아니라 실제 DB 변경 함수(createTip/updateTip/deleteTip)에서 이미 수행됨.
export async function revalidateTips(slug?: string) {
  revalidatePath("/tips");
  if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    revalidatePath(`/tips/${slug}`);
  }
}
