// 국회 국민동의청원 중 길고양이 관련 청원 목록 프록시.
// 공개 데이터(정부 사이트)라 인증 불필요 — 유저 입력 파라미터 없음(고정 쿼리만).
// 2026-07-22 회의 결론 준수: 앱은 서명·동의를 수집하지 않고 "안내"만 한다.
// 찬반 진영 구분 없이 키워드 매칭 전부 노출 — 앱의 정치적 중립 유지.

import { NextResponse } from "next/server";

// ISR: 1시간마다 국회 API 재조회 (동의 수는 실시간일 필요 없음)
export const revalidate = 3600;

const ASSEMBLY_API = "https://petitions.assembly.go.kr/api/petits";
// 동의 진행 전체(공개 전 포함) — 사이트 "동의진행 청원" 탭과 동일 조건
const ONGOING_QUERY =
  "sttusCode=AGRE_PROGRS%2CCMIT_FRWRD%2CPETIT_FORMATN&proceedAt=proceed&recordCountPerPage=100";
// 국회 API는 브라우저 UA가 없으면 400을 반환한다
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// 고양이 직접 키워드 + 동물보호 전반(캣맘 유저 관심사 직결).
// '동물' 단독은 오탐이 많아 복합어로만 매칭.
const CAT_KEYWORDS = [
  "고양이", "길고양이", "캣맘", "캣 ",
  "동물보호", "동물학대", "동물복지", "유기동물", "반려동물",
  "중성화", "TNR", "급식소",
];

interface AssemblyPetit {
  petitId?: string;
  petitSj?: string;
  agreCo?: number;
  agreBeginDe?: string;
  agreEndDe?: string;
  sttusCode?: string;
}

export interface CatPetition {
  id: string;
  title: string;
  agreeCount: number;
  goal: number;
  endDate: string; // YYYY-MM-DD
  url: string;
}

export interface ClosedPetition {
  id: string;
  title: string;
  agreeCount: number;
  endDate: string;
  status: "established" | "ended"; // 성립(위원회 회부) / 미성립 종료
  url: string;
}

// 종료 청원은 동의수가 확정 불변 — 2026-07-22 전체 아카이브(3,628건) 크롤링에서
// 동물 키워드 매칭 48건을 정적 스냅샷으로 보존. 진행 중 청원이 마감되면 이 파일에 수동 추가.
import closedPetitions from "./closed-petitions.json";

export async function GET() {
  const results: CatPetition[] = [];
  try {
    const seen = new Set<string>();
    // 진행 중 청원은 100~200건 수준 — 최대 5페이지(500건)까지만 순회
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(`${ASSEMBLY_API}?${ONGOING_QUERY}&pageIndex=${page}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) break;
      const batch = (await res.json()) as AssemblyPetit[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      for (const p of batch) {
        const id = p.petitId ?? "";
        const title = p.petitSj ?? "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (!CAT_KEYWORDS.some((k) => title.includes(k))) continue;
        results.push({
          id,
          title,
          agreeCount: typeof p.agreCo === "number" ? p.agreCo : 0,
          goal: 50000,
          endDate: (p.agreEndDe ?? "").slice(0, 10),
          url: `https://petitions.assembly.go.kr/proceed/onGoingAll/${id}`,
        });
      }
      if (batch.length < 100) break;
    }
  } catch {
    // 국회 API 장애 — 빈 목록 반환, 클라이언트는 섹션 자체를 숨긴다
  }

  results.sort((a, b) => b.agreeCount - a.agreeCount);
  // 진행 중 목록에 이미 있는 청원이 스냅샷에 중복돼도 진행 중이 우선
  const ongoingIds = new Set(results.map((p) => p.id));
  const closed = (closedPetitions as ClosedPetition[]).filter((p) => !ongoingIds.has(p.id));
  return NextResponse.json({ petitions: results, closed });
}
