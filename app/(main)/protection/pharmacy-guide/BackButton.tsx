"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
      <ArrowLeft size={24} className="text-text-main" />
    </button>
  );
}
