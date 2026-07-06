"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ParticleSystem, type AmbientKind, type BurstKind } from "@/lib/particles";

export interface ParticleCanvasHandle {
  // xPct/yPct: 부모 요소 기준 0~1 상대 좌표
  burst: (xPct: number, yPct: number, kind: BurstKind, count: number, color: string) => void;
  setAmbient: (kind: AmbientKind | null, color?: string, intensity?: number) => void;
}

interface Props {
  style?: React.CSSProperties;
  zIndex?: number;
}

const ParticleCanvas = forwardRef<ParticleCanvasHandle, Props>(({ style, zIndex }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sysRef = useRef<ParticleSystem>(new ParticleSystem());
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);

  useImperativeHandle(ref, () => ({
    burst: (xPct, yPct, kind, count, color) => {
      const { w, h } = sizeRef.current;
      sysRef.current.burst(w * xPct, h * yPct, kind, count, color);
    },
    setAmbient: (kind, color, intensity) => sysRef.current.setAmbient(kind, color, intensity),
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      sysRef.current.update(dt, w, h);
      sysRef.current.draw(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex, ...style }}
    />
  );
});
ParticleCanvas.displayName = "ParticleCanvas";
export default ParticleCanvas;
