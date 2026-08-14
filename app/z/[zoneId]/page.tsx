// ══════════════════════════════════════════
// QR 지킴판 랜딩 (B-1) — /z/[zoneId]
// 인쇄된 QR 스캔으로 진입. 로그인 불필요.
// 위치는 QR에 심긴 구역 ID로만 태깅 — 방문자 GPS를 요청·수집하지 않는다.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import { Shield, PawPrint, PhoneCall } from "lucide-react";
import ZoneReportForm from "./ZoneReportForm";
import { SAFETY_ZONE_REPORT_ENABLED } from "@/lib/safety-flags";

export const dynamic = "force-dynamic";

export default async function ZoneLandingPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;

  let zone: { id: string; label: string; notice: string | null } | null = null;
  // UUID 형식이 아니면 조회 자체를 생략 (에러 노이즈 방지)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zoneId)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("guardian_zones")
      .select("id, label, notice")
      .eq("id", zoneId)
      .eq("active", true)
      .maybeSingle();
    zone = data;
  }

  if (!zone) {
    return (
      <div className="min-h-dvh bg-warm-white flex flex-col items-center justify-center px-6 text-center">
        <PawPrint size={36} className="text-text-light mb-3" />
        <p className="text-[15px] font-extrabold text-text-main">등록되지 않은 구역이에요</p>
        <p className="text-[13px] text-text-sub mt-1.5 leading-relaxed">
          QR이 손상됐거나 운영이 끝난 구역일 수 있어요.
          <br />
          위급 상황이라면 112에 직접 전화해주세요.
        </p>
        <a href="tel:112" className="mt-4 px-5 py-2.5 rounded-xl text-[13px] font-extrabold text-white" style={{ backgroundColor: "#AD5E3B" }}>
          112 전화 걸기
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-warm-white">
      <div className="max-w-lg mx-auto px-5 py-10">
        {/* 지킴판 선언 */}
        <div
          className="rounded-[24px] px-5 py-6 text-center text-white"
          style={{ background: "linear-gradient(160deg, #AD5E3B 0%, #8A4325 100%)" }}
        >
          <Shield size={30} className="mx-auto mb-2 opacity-90" />
          <p className="text-[13px] font-bold opacity-85">{zone.label}</p>
          <h1 className="text-[20px] font-extrabold mt-1 leading-snug">
            이곳은 등록된 돌봄 구역입니다
          </h1>
          <p className="text-[13px] mt-2 leading-relaxed opacity-90">
            이 구역의 길고양이는 이웃들이 함께 돌보고 있어요.
            <br />
            동물을 해치는 행위는 <b>동물보호법에 따라 처벌될 수 있는 범죄</b>입니다
            <br />
            (최대 3년 이하 징역 또는 3천만 원 이하 벌금).
          </p>
        </div>

        {zone.notice && (
          <p className="text-[13px] text-text-sub mt-3 px-1 leading-relaxed">{zone.notice}</p>
        )}

        {/* 긴급 안내 — 진행 중 상황은 112 우선 */}
        <a
          href="tel:112"
          className="mt-4 rounded-2xl px-4 py-3.5 flex items-center gap-3"
          style={{ backgroundColor: "#FFF3EC", border: "1px solid #EAD3C6" }}
        >
          <PhoneCall size={18} style={{ color: "#B84545" }} />
          <div className="flex-1">
            <p className="text-[13px] font-extrabold text-text-main">지금 눈앞에서 벌어지고 있나요?</p>
            <p className="text-[11px] text-text-sub">제보보다 112 전화가 먼저예요 — 탭하면 전화 앱이 열려요</p>
          </div>
        </a>

        {/* 익명 제보 — 킬스위치 OFF 시 폼 대신 일시중단 안내 (112 우선) */}
        {SAFETY_ZONE_REPORT_ENABLED ? (
          <div className="mt-6">
            <h2 className="text-[15px] font-extrabold text-text-main mb-1">목격하신 일을 알려주세요</h2>
            <p className="text-[13px] text-text-sub mb-4 leading-relaxed">
              로그인 없이 익명으로 제보할 수 있어요. 도시공존은 내용을 판단하지 않고,
              확인 후 필요 시 경찰·동물보호센터로 전달하는 통로 역할만 해요.
            </p>
            <ZoneReportForm zoneId={zone.id} />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl px-4 py-5 text-center" style={{ backgroundColor: "#FFF3EC", border: "1px solid #EAD3C6" }}>
            <p className="text-[13px] font-extrabold text-text-main">제보 접수를 잠시 중단했어요</p>
            <p className="text-[13px] text-text-sub mt-1.5 leading-relaxed">
              점검 중이에요. 지금 벌어지는 상황이라면 아래 112로 바로 신고해주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
