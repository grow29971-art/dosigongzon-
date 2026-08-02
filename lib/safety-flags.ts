// ══════════════════════════════════════════
// 안전기능 킬스위치  (lib/geo.ts의 GEOLOCATION_ENABLED 패턴)
//
// 목적: 학대·스토킹 사고나 언론 이슈가 터졌을 때, 성명서보다 먼저 해당 기능을
//   "요청 경로에서" 즉시 끌 수 있게 한다. 단순 UI 숨김이 아니라 서버가 fail-closed로 막는다.
//
// 끄는 법 (사고 첫 1시간):
//   ▸ 방법 A (코드): 아래 해당 상수를 false 로 바꾼다 → git commit + push → 자동배포(약 2분).
//   ▸ 방법 B (대시보드, 코드 못 만질 때): Vercel 환경변수에 KILL_ZONE_REPORT=1 추가 →
//     재배포. 코드 상수보다 우선해 강제 OFF. 되살리려면 값 지우고 재배포.
//   (둘 다 재배포가 필요하다 — 진짜 무배포 즉시차단이 필요하면 DB 플래그로 승격해야 하는데,
//    그건 별도 과제. 현재는 solo 운영자가 모바일에서라도 플립 가능한 최소 구성.)
//
// ⚠️ 새 플래그를 추가할 땐 반드시 "요청 경로(서버 라우트/서버 컴포넌트)"에 배선할 것.
//    배선 없는 플래그는 방어가 아니라 착시다.
// ══════════════════════════════════════════

/** 환경변수 KILL_* 가 '1'/'true' 면 강제 OFF (코드 상수보다 우선). 서버에서만 유효. */
function forceKilled(envKey: string): boolean {
  const v = process.env[envKey];
  return v === "1" || v === "true";
}

// ── B-1 QR 지킴판 익명 목격제보 (랜딩 /z/[zoneId] + 접수 /api/zone-report) ──
// 서버 경로라 코드 상수 + 환경변수 KILL_ZONE_REPORT override 둘 다 유효.
// 끄면: 랜딩은 제보 폼 대신 "일시 중단 + 112 안내"만 노출, 접수 라우트는 503.
export const SAFETY_ZONE_REPORT_ENABLED = true && !forceKilled("KILL_ZONE_REPORT");

// ── B-2 신고 증거 첨부 업로드 (lib/evidence-repo) ──
// ⚠️ 클라이언트 경로 가드라 코드 상수만 반영(환경변수 override 미적용 — 브라우저는 비공개 env 못 읽음).
// 끄면: uploadReportEvidence()가 즉시 throw → 신고 본문은 되고 사진 첨부만 막힘.
export const SAFETY_REPORT_EVIDENCE_ENABLED = true;

// ── 학대경보(alert) 댓글 작성 (lib/cats-repo) ──
// ⚠️ 클라이언트 경로 가드라 코드 상수만 반영.
// 끄면: kind='alert' 댓글 작성이 throw → 일반(note) 댓글은 계속 가능.
export const SAFETY_ABUSE_ALERT_ENABLED = true;

/** 안전기능 OFF 동안 사용자에게 보여줄 공통 안내. */
export const SAFETY_DISABLED_MESSAGE =
  "안전 제보 기능을 잠시 점검 중이에요. 긴급 상황은 112로 직접 신고해주세요.";
