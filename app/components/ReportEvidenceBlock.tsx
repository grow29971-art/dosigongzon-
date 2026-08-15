"use client";

// admin 신고함 — 첨부 증거 열람(단수명 서명 URL) + 기관 이관 서식 복사 (B-2)
// 도시공존은 판정하지 않는 통로 — 서식은 신고 내용 정리 + 해시 표기까지만.

import { useEffect, useState } from "react";
import { ClipboardCopy, Check } from "lucide-react";
import type { Report } from "@/lib/support-repo";
import {
  listEvidenceForReport,
  getEvidenceSignedUrl,
  buildForwardingText,
  type ReportEvidence,
} from "@/lib/evidence-repo";

export default function ReportEvidenceBlock({ report }: { report: Report }) {
  const [evidence, setEvidence] = useState<ReportEvidence[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listEvidenceForReport(report.id).then(async (rows) => {
      if (cancelled) return;
      setEvidence(rows);
      const entries = await Promise.all(
        rows.map(async (r) => [r.id, await getEvidenceSignedUrl(r.storage_path)] as const),
      );
      if (cancelled) return;
      setUrls(Object.fromEntries(entries.filter(([, u]) => u) as [string, string][]));
    });
    return () => { cancelled = true; };
  }, [report.id]);

  const copyForm = async () => {
    try {
      await navigator.clipboard.writeText(buildForwardingText(report, evidence));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사에 실패했어요.");
    }
  };

  return (
    <div className="mt-2">
      {evidence.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-1.5">
          {evidence.map((e) => (
            <a key={e.id} href={urls[e.id]} target="_blank" rel="noreferrer" title={`SHA-256 ${e.sha256.slice(0, 12)}…`}>
              {urls[e.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[e.id]} alt="증거 사진" className="w-14 h-14 rounded-lg object-cover" style={{ border: "1px solid var(--color-divider)" }} />
              ) : (
                <div className="w-14 h-14 rounded-lg" style={{ backgroundColor: "var(--color-surface-alt)" }} />
              )}
            </a>
          ))}
        </div>
      )}
      <button
        onClick={copyForm}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg press-strong"
        style={{ backgroundColor: "var(--color-surface-alt)", color: "var(--color-text-sub)" }}
      >
        {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
        {copied ? "복사됨" : "기관 이관 서식 복사"}
      </button>
      {evidence.length > 0 && (
        <p className="text-[11px] text-text-light mt-1">
          사진은 EXIF 제거 사본 · {new Date(evidence[0].purge_at).toLocaleDateString("ko-KR")} 자동 파기
        </p>
      )}
    </div>
  );
}
