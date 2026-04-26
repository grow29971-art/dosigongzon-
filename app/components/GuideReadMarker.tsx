"use client";

import { useEffect } from "react";
import { markRead, type GuideSlug } from "@/lib/protection-progress";

/** 가이드 페이지에 한 줄 추가하면 마운트 시 학습 완료로 표시. */
export default function GuideReadMarker({ slug }: { slug: GuideSlug }) {
  useEffect(() => {
    markRead(slug);
  }, [slug]);
  return null;
}
