import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyCareReportServer } from "@/lib/care-report-server";
import { CARE_TYPE_MAP, type CareType } from "@/lib/care-logs-repo";
import PrintButton from "@/app/components/PrintButton";

// 내 돌봄 활동 확인서 — 본인 명의의 전체 돌봄 활동 증빙.
// 봉사활동 증빙·민원 대응·지자체 협의·지원사업 제출용.

export const metadata: Metadata = {
  title: "내 돌봄 활동 확인서",
  robots: { index: false, follow: false },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul",
  });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    year: "2-digit", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  });

export default async function MyCareReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?from=/mypage/report");

  const report = await getMyCareReportServer(user.id);
  const meta = user.user_metadata ?? {};
  const nickname =
    (meta.nickname as string) ?? (meta.full_name as string) ?? (meta.name as string) ??
    user.email?.split("@")[0] ?? "회원";
  const joinedAt = user.created_at ? fmtDate(user.created_at) : null;
  const issuedAt = new Date().toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  });

  const typeEntries = (Object.entries(report.byType) as [CareType, number][])
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="pb-24 print:pb-0" style={{ background: "var(--color-warm-white)", minHeight: "100vh" }}>
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
          href="/mypage"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center press-strong"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="마이페이지로 돌아가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[13px] font-semibold text-text-sub">마이페이지</span>
      </div>

      <div className="report-no-print px-4 mb-3">
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: "var(--color-primary-softer)", border: "1px solid rgba(176,92,54,0.18)" }}
        >
          <p className="text-[13px] font-bold text-text-main leading-snug">
            내 이름으로 된 돌봄 활동 증빙 문서예요
          </p>
          <p className="text-[11px] text-text-sub mt-1 leading-relaxed">
            민원·분쟁 대응, 구청·동물보호 단체 협의, 봉사활동 증빙, 지원사업 제출에 쓸 수 있어요.
            &ldquo;인쇄 · PDF로 저장&rdquo;을 누르면 문서로 만들어져요.
          </p>
        </div>
      </div>

      {/* ── 확인서 본문 ── */}
      <div
        className="report-sheet bg-white mx-4 rounded-2xl px-6 py-8"
        style={{ boxShadow: "var(--shadow-card)", border: "1px solid var(--color-border)" }}
      >
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

        <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <Tr label="활동자" value={`${nickname} (플랫폼 닉네임)`} />
            {joinedAt && <Tr label="가입일" value={joinedAt} />}
            <Tr label="발급 일시" value={`${issuedAt} (KST)`} />
          </tbody>
        </table>

        {report.totalCount === 0 ? (
          <p className="text-[13px] text-text-sub text-center py-8">아직 집계할 돌봄 기록이 없습니다.</p>
        ) : (
          <>
            <SectionTitle>1. 돌봄 활동 요약</SectionTitle>
            <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <Tr label="총 돌봄 기록" value={`${report.totalCount.toLocaleString()}건${report.totalCount >= 1000 ? " 이상" : ""}`} />
                <Tr
                  label="기록 기간"
                  value={`${fmtDate(report.firstLoggedAt!)} ~ ${fmtDate(report.lastLoggedAt!)} (${report.spanDays.toLocaleString()}일)`}
                />
                <Tr label="활동 일수" value={`${report.activeDays.toLocaleString()}일 (기록이 있는 날짜 수)`} />
                <Tr label="돌본 고양이" value={`${report.byCat.length.toLocaleString()}마리`} />
                <Tr label="사진 증빙" value={`${report.photoCount.toLocaleString()}건 (원본은 플랫폼에서 열람 가능)`} />
              </tbody>
            </table>

            <SectionTitle>2. 돌본 고양이별 집계</SectionTitle>
            <table className="w-full text-[12px] mb-5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>이름</Th>
                  <Th>활동 지역</Th>
                  <Th align="right">기록 수</Th>
                </tr>
              </thead>
              <tbody>
                {report.byCat.map((c) => (
                  <tr key={c.catId}>
                    <Td>{c.catName}</Td>
                    <Td>{c.region ?? "—"}</Td>
                    <Td align="right">{c.count.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>

            <SectionTitle>3. 활동 유형별 집계</SectionTitle>
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

            <SectionTitle>4. 월별 활동 추이</SectionTitle>
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

            <SectionTitle>5. 최근 돌봄 기록 상세 (최신 {report.rows.length}건)</SectionTitle>
            <table className="w-full text-[11px] mb-5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>일시 (KST)</Th>
                  <Th>고양이</Th>
                  <Th>유형</Th>
                  <Th>내용</Th>
                  <Th align="center">사진</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id}>
                    <Td nowrap>{fmtDateTime(r.logged_at)}</Td>
                    <Td nowrap>{r.catName}</Td>
                    <Td nowrap>{CARE_TYPE_MAP[r.care_type]?.label ?? r.care_type}</Td>
                    <Td>{[r.memo, r.amount].filter(Boolean).join(" · ") || "—"}</Td>
                    <Td align="center">{r.photo_url ? "○" : ""}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="pt-4 mt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="text-[11px] text-text-light leading-relaxed">
            ※ 각 기록의 시각은 작성 시점에 서버에 저장된 시각(KST)입니다. 기록 원본과 첨부 사진은
            플랫폼에서 열람할 수 있습니다. 본 확인서는 민원 대응, 급식소·중성화(TNR) 협의, 봉사활동
            증빙, 지원사업 제출 시 참고 자료로 활용할 수 있으며, 고양이 안전을 위해 정확한 위치
            좌표는 포함하지 않습니다.
          </p>
          <p className="text-[11px] font-bold text-text-sub mt-3 text-center tracking-widest">도 시 공 존</p>
        </div>
      </div>

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
