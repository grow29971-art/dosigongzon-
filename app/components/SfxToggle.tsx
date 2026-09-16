"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSfxMuted, setSfxMuted } from "@/lib/sfx";

export default function SfxToggle({ style }: { style?: React.CSSProperties }) {
  const [muted, setMuted] = useState(() => isSfxMuted());
  return (
    <button
      type="button"
      onClick={() => { const next = !muted; setSfxMuted(next); setMuted(next); }}
      className="press-strong"
      style={{
        width: 34, height: 34, borderRadius: "var(--radius-full)", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--color-gray-100)", color: "var(--color-text-sub)", flexShrink: 0, ...style,
      }}
      aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}
