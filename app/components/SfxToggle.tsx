"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSfxMuted, setSfxMuted } from "@/lib/sfx";

export default function SfxToggle({ style }: { style?: React.CSSProperties }) {
  const [muted, setMuted] = useState(() => isSfxMuted());
  return (
    <button
      onClick={() => { const next = !muted; setSfxMuted(next); setMuted(next); }}
      style={{
        width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.08)", flexShrink: 0, ...style,
      }}
      aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
    >
      {muted ? <VolumeX size={16} color="white" /> : <Volume2 size={16} color="white" />}
    </button>
  );
}
