import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getCatByIdServer } from "@/lib/cats-server";
import { getCareReportServer } from "@/lib/care-report-server";
import { CARE_TYPE_MAP, type CareType } from "@/lib/care-logs-repo";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/app/components/PrintButton";

// 돌봄 활동 확인서 — 민원 대응·지자체 협의·학대 신고 시 첨부하는 증빙 문서.
// 이미 공개된 care_logs 데이터의 집계이며 좌표는 포함하지 않는다(region만).

export const metadata: Metadata = {
  title: "돌봄 활동 확인서",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul",
  });

// 상세 표는 '날짜'까지만 — 분 단위 활동시각은 "언제 나타나는지"를 노출하는 스토킹 벡터라
// 증빙 목적에 필요한 날짜 단위로 뭉갠다 (2026-08-29 법률감사 H3).
const fmtDateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "2-digit", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul",
  });

export default async function CareReportPage({ params }: { params: Params }) {
  const { id } = await params;

  // 로그인 필수 — 참여 시민 닉네임·활동 패턴이 담긴 문서라 비로그인 공개 시 표적화 벡터가 됨
  // (2026-08-29 법률감사 H3: 좌표는 퍼징하면서 활동 패턴을 무인증 공개하면 방어선 불일치)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?from=/cats/${id}/report`);

  const cat = await getCatByIdServer(id);
  if (!cat) notFound();

  const report = await getCareReportServer(cat.id);
  const region = cat.region ?? "우리 동네";
  const issuedAt = new Date().toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  });

  const typeEntries = (Object.entries(report.byType) as [CareType, number][])
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="pb-24 print:pb-0" style={{ background: "var(--color-warm-white)", minHeight: "100vh" }}>
      {/* 인쇄 시 앱 크롬(하단 내비 등) 숨김 + 문서만 남김 */}
      <style>{`
        @media print {
          nav { display: none !important; }
          body { background: #fff !important; }
          .report-no-print { display: none !important; }
          .report-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* 화면용 헤더 */}
      <div className="report-no-print px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href={`/cats/${cat.id}`}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center press-strong"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="고양이 페이지로 돌아가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[13px] font-semibold text-text-sub">{cat.name}</span>
      </div>

      <div className="report-no-print px-4 mb-3">
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: "var(--color-primary-softer)", border: "1px solid rgba(176,92,54,0.18)" }}
        >
          <p className="text-[13px] font-bold text-text-main leading-snug">
            민원·구청 협의·학대 신고 때 이 확인서를 첨부하세요
          </p>
          <p className="text-[11px] text-text-sub mt-1 leading-relaxed">
            아래 &ldquo;인쇄 · PDF로 저장&rdquo;을 누르면 종이 문서나 PDF 파일로 만들 수 있어요.
            이 아이가 방치된 동물이 아니라 시민이 지속적으로 돌보는 동네 고양이라는 근거가 돼요.
          </p>
        </div>
      </div>

      {/* ── 확인서 본문 (인쇄 대상) ── */}
      <div
        className="report-sheet bg-white mx-4 rounded-2xl px-6 py-8"
        style={{ boxShadow: "var(--shadow-card)", border: "1px solid var(--color-border)" }}
      >
        {/* 표제 */}
        <div className="text-center pb-5 mb-5" style={{ borderBottom: "2px solid var(--color-text-main)" }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText size={16} style={{ color: "var(--color-primary)" }} />
            <span className="text-[11px] font-bold tracking-widest text-text-sub">도시공존 시민 돌봄 기록</span>
          </div>
          <h1 className="text-[22px] font-bold text-text-main tracking-tight">돌봄 활동 확인서</h1>
          <p className="text-[11px] text-text-sub mt-2">
            본 확인서는 시민 참여 길고양이 돌봄 플랫폼 도시공존(dosigongzon.com)에 기록된 데이터를 기반으로 자동 생성되었습니다.
          </p>
        </div>

        {/* 대상 */}
        <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <Tr label="대상" value={`길고양이 '${cat.name}'`} />
            <Tr label="활동 지역" value={region} />
            <Tr label="플랫폼 등록일" value={fmtDate(cat.created_at)} />
            {cat.neutered != null && (
              <Tr label="중성화(TNR)" value={cat.neutered ? "완료" : "미완료"} />
            )}
            <Tr label="발급 일시" value={`${issuedAt} (KST)`} />
          </tbody>
        </table>

        {report.totalCount === 0 ? (
          <p className="text-[13px] text-text-sub text-center py-8">아직 집계할 돌봄 기록이 없습니다.</p>
        ) : (
          <>
            {/* 요약 */}
            <SectionTitle>1. 돌봄 활동 요약</SectionTitle>
            <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <Tr label="총 돌봄 기록" value={`${report.totalCount.toLocaleString()}건${report.totalCount >= 1000 ? " 이상" : ""}`} />
                <Tr
                  label="기록 기간"
                  value={`${fmtDate(report.firstLoggedAt!)} ~ ${fmtDate(report.lastLoggedAt!)} (${report.spanDays.toLocaleString()}일)`}
                />
                <Tr label="활동 일수" value={`${report.activeDays.toLocaleString()}일 (기록이 있는 날짜 수)`} />
                <Tr label="참여 시민" value={`${report.caretakerCount.toLocaleString()}명`} />
                <Tr label="사진 증빙" value={`${report.photoCount.toLocaleString()}건 (원본은 플랫폼에서 열람 가능)`} />
              </tbody>
            </table>

            {/* 유형별 */}
            <SectionTitle>2. 활동 유형별 집계</SectionTitle>
            <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>유형</Th>
                  <Th align="right">건수</Th>
                </tr>
              </thead>
              <tbody>
                {typeEntries.map(([t, n]) => (
                  <tr key={t}>
                    <Td>{CARE_TYPE_MAP[t]?.label ?? t}</Td>
                    <Td align="right">{n.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 월별 */}
            <SectionTitle>3. 월별 활동 추이</SectionTitle>
            <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>연월</Th>
                  <Th align="right">기록 수</Th>
                </tr>
              </thead>
              <tbody>
                {report.byMonth.map((m) => (
                  <tr key={m.ym}>
                    <Td>{m.ym.replace("-", "년 ")}월</Td>
                    <Td align="right">{m.count.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 참여 시민 */}
            <SectionTitle>4. 주요 참여 시민 (기록 수 상위)</SectionTitle>
            <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>닉네임</Th>
                  <Th align="right">기록 수</Th>
                </tr>
              </thead>
              <tbody>
                {report.caretakers.map((c, i) => (
                  <tr key={`${c.name}-${i}`}>
                    <Td>{c.name}</Td>
                    <Td align="right">{c.count.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 상세 */}
            <SectionTitle>5. 최근 돌봄 기록 상세 (최신 {report.rows.length}건)</SectionTitle>
            <table className="w-full text-[11px] mb-5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>날짜 (KST)</Th>
                  <Th>유형</Th>
                  <Th>기록자</Th>
                  <Th>내용</Th>
                  <Th align="center">사진</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id}>
                    <Td nowrap>{fmtDateOnly(r.logged_at)}</Td>
                    <Td nowrap>{CARE_TYPE_MAP[r.care_type]?.label ?? r.care_type}</Td>
                    <Td nowrap>{r.author_name ?? "익명"}</Td>
                    <Td>{[r.memo, r.amount].filter(Boolean).join(" · ") || "—"}</Td>
                    <Td align="center">{r.photo_url ? "○" : ""}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 하단 고지 */}
        <div className="pt-4 mt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="text-[11px] text-text-light leading-relaxed">
            ※ 본 확인서는 이용자가 자율적으로 입력한 활동 기록을 집계한 것으로, 제3자 검증을 거치지
            않았습니다. 기록 원본과 첨부 사진은 dosigongzon.com/cats/{cat.id} 에서 열람할 수 있습니다.
            동물보호법 제10조(동물학대 등의 금지) 관련 신고, 급식소·중성화(TNR) 협의, 민원 대응 시 참고
            자료로 활용할 수 있으며, 고양이 안전을 위해 정확한 위치 좌표는 포함하지 않습니다.
          </p>
          <p className="text-[11px] leading-relaxed mt-2" style={{ color: "#B84545" }}>
            ⚠ 이 확인서에는 참여 시민의 닉네임이 포함되어 있습니다. 분쟁 상대방 등 제3자에게 직접
            전달하는 경우 참여자 신변 노출에 유의하세요.
          </p>
          <p className="text-[11px] font-bold text-text-sub mt-3 text-center tracking-widest">도 시 공 존</p>
        </div>
      </div>

      {/* 화면용 액션 */}
      <div className="report-no-print px-4 mt-4 flex gap-2">
        <PrintButton />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold text-text-main mb-2 tracking-tight">{children}</h2>
  );
}

function Tr({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        className="py-1.5 px-3 font-bold text-text-sub whitespace-nowrap"
        style={{ border: "1px solid var(--color-border)", background: "var(--color-warm-white)", width: "30%" }}
      >
        {label}
      </td>
      <td className="py-1.5 px-3 text-text-main" style={{ border: "1px solid var(--color-border)" }}>
        {value}
      </td>
    </tr>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" | "center" }) {
  return (
    <th
      className="py-1.5 px-2.5 font-bold text-text-sub"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-warm-white)",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align, nowrap }: { children: React.ReactNode; align?: "right" | "center"; nowrap?: boolean }) {
  return (
    <td
      className={`py-1.5 px-2.5 text-text-main${nowrap ? " whitespace-nowrap" : ""}`}
      style={{ border: "1px solid var(--color-border)", textAlign: align ?? "left" }}
    >
      {children}
    </td>
  );
}
