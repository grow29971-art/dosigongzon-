"use client";

import { useEffect } from "react";
import { incrementTipView } from "@/lib/tips-repo";

// 본문 마운트 시 1회 조회수 증가. 실패해도 사용자 경험에 영향 없음.
export default function TipViewIncrementer({ slug }: { slug: string }) {
  useEffect(() => {
    incrementTipView(slug).catch(() => {});
  }, [slug]);
  return null;
}
