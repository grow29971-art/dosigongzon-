"use server";

import { revalidatePath } from "next/cache";

// 영상 발행/수정/삭제 후 호출 — /shorts 캐시 즉시 무효화.
export async function revalidateShorts() {
  revalidatePath("/shorts");
}
