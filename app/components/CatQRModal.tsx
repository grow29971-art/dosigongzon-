"use client";

// 고양이 QR 코드 — 종이로 인쇄해 동네에 공유.
// "스캔하면 이 아이의 도시공존 페이지로" — 오프라인 → 온라인 유입.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Printer } from "lucide-react";
import QRCode from "qrcode";

interface CatQRModalProps {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName: string;
}

export default function CatQRModal({ open, onClose, catId, catName }: CatQRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");

  const targetUrl = `https://dosigongzon.com/cats/${catId}?utm_source=qr&utm_medium=offline&utm_campaign=cat_qr`;

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    QRCode.toCanvas(canvas, targetUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#3D2F25", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
      .then(() => {
        try {
          setDataUrl(canvas.toDataURL("image/png"));
        } catch {}
      })
      .catch(() => {});
  }, [open, targetUrl]);

  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [open]);

  if (!open || !portalRoot) return null;

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `도시공존_${catName}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>${catName} 도시공존 QR</title>
          <style>
            body { font-family: 'Apple SD Gothic Neo', sans-serif; text-align: center; padding: 32px; }
            h1 { font-size: 20px; margin: 0 0 8px; color: #3D2F25; }
            p { font-size: 12px; color: #8B7562; margin: 0 0 24px; line-height: 1.6; }
            img { max-width: 320px; width: 100%; }
            .footer { font-size: 11px; color: #A38E7A; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>🐾 ${catName}</h1>
          <p>이 아이의 안부를 함께 살펴주세요<br/>QR 스캔 → 도시공존 페이지</p>
          <img src="${dataUrl}" alt="${catName} QR" />
          <p class="footer">dosigongzon.com — 길고양이 시민 참여 지도</p>
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <p className="text-[10.5px] font-extrabold tracking-[0.18em]" style={{ color: "#A8684A" }}>
              SHARE OFFLINE
            </p>
            <h2 className="text-[17px] font-extrabold text-text-main mt-1 tracking-tight">
              {catName} QR 코드
            </h2>
            <p className="text-[11.5px] text-text-sub mt-1 leading-relaxed">
              인쇄해 동네에 붙이면 스캔하는 이웃이 도시공존으로 들어와요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 shrink-0"
            style={{ background: "rgba(0,0,0,0.05)" }}
            aria-label="닫기"
          >
            <X size={15} className="text-text-sub" />
          </button>
        </div>

        <div className="px-5 pb-4 flex justify-center">
          <div className="rounded-2xl p-3" style={{ background: "#F7F4EE" }}>
            <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        <div className="px-5 pb-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!dataUrl}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-[13px] font-extrabold text-white active:scale-[0.97] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)" }}
          >
            <Download size={14} />
            <span>이미지 저장</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!dataUrl}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-[13px] font-extrabold active:scale-[0.97] disabled:opacity-50"
            style={{ background: "#FFFFFF", color: "#A8684A", border: "1.5px solid rgba(196,126,90,0.30)" }}
          >
            <Printer size={14} />
            <span>인쇄하기</span>
          </button>
        </div>

        <p className="text-[10.5px] text-text-light text-center pb-4 px-5 leading-relaxed">
          A4·A5 어디든 인쇄 가능. 전봇대·우편함·게시판 등 동네에 공유하시면<br/>
          이웃이 스캔해 함께 돌볼 수 있어요.
        </p>
      </div>
    </div>,
    portalRoot,
  );
}
