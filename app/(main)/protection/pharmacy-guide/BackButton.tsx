"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button data-page-back onClick={() => router.back()} className="p-2 -ml-2 press-strong transition-transform">
      <ArrowLeft size={24} className="text-text-main" />
    </button>
  );
}
