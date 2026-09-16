"use client";

// 고양이 QR 코드 — 종이로 인쇄해 동네에 공유.
// "스캔하면 이 아이의 도시공존 페이지로" — 오프라인 → 온라인 유입.
// QR 캔버스(qrcode는 hex만 받음)·인쇄 팝업(별 문서라 :root 토큰이 없음)은 var()가 안 먹는 자리 —
// 런타임에 :root 토큰 값을 읽어 넘기고, 못 읽으면 라이브러리 기본색(검정/흰색)·CSS 키워드로 폴백한다. hex 리터럴 없음.

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

// 인쇄 팝업은 document.write로 만들어지고, window.open("")로 연 about:blank는
// opener(dosigongzon.com)의 origin을 상속한다. 고양이 이름은 사용자 입력이므로
// 이스케이프 없이 삽입하면 same-origin Stored XSS가 된다. 요소 텍스트·따옴표 속성
// 양쪽을 안전하게 하기 위해 & < > " ' 를 모두 엔티티로 변환한다.
/** :root에 박힌 디자인 토큰 값을 읽는다(예: 텍스트 메인 색). 없으면 빈 문자열. */
function readToken(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    const ink = readToken("--color-text-main");
    const paper = readToken("--color-surface");
    QRCode.toCanvas(canvas, targetUrl, {
      width: 320,
      margin: 2,
      // 토큰을 못 읽으면 color 자체를 생략 → 라이브러리 기본(검정/흰색)
      ...(ink && paper ? { color: { dark: ink, light: paper } } : {}),
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
    const safeName = escapeHtml(catName);
    const inkMain = readToken("--color-text-main") || "black";
    const inkSub = readToken("--color-text-sub") || "gray";
    const inkLight = readToken("--color-text-light") || "gray";
    w.document.write(`
      <html>
        <head>
          <title>${safeName} 도시공존 QR</title>
          <style>
            body { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; text-align: center; padding: 32px; }
            h1 { font-size: 20px; margin: 0 0 8px; color: ${inkMain}; }
            p { font-size: 12px; color: ${inkSub}; margin: 0 0 24px; line-height: 1.6; }
            img { max-width: 320px; width: 100%; }
            .footer { font-size: 11px; color: ${inkLight}; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>${safeName}</h1>
          <p>이 아이의 안부를 함께 살펴주세요<br/>QR 스캔 → 도시공존 페이지</p>
          <img src="${dataUrl}" alt="${safeName} QR" />
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
        className="w-full max-w-md overflow-hidden"
        style={{ background: "var(--color-surface)", borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-text-main tracking-tight">
              {catName} QR 코드
            </h2>
            <p className="text-[13px] text-text-sub mt-1 leading-relaxed">
              인쇄해 동네에 붙이면 스캔하는 이웃이 도시공존으로 들어와요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center press-strong shrink-0"
            style={{ background: "var(--color-gray-100)" }}
            aria-label="닫기"
          >
            <X size={15} className="text-text-sub" />
          </button>
        </div>

        <div className="px-5 pb-4 flex justify-center">
          <div className="p-3" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
            <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        <div className="px-5 pb-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!dataUrl}
            className="flex items-center justify-center gap-1.5 h-12 text-[15px] font-semibold text-white press-strong disabled:opacity-50"
            style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
          >
            <Download size={14} />
            <span>이미지 저장</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!dataUrl}
            className="flex items-center justify-center gap-1.5 h-12 text-[15px] font-semibold text-text-main press-strong disabled:opacity-50"
            style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-input)" }}
          >
            <Printer size={14} />
            <span>인쇄하기</span>
          </button>
        </div>

        <p className="text-[11px] text-text-light text-center pb-4 px-5 leading-relaxed">
          전봇대·우편함·게시판에 붙이면 이웃이 스캔해 함께 돌볼 수 있어요.
        </p>
      </div>
    </div>,
    portalRoot,
  );
}
