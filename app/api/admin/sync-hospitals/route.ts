// ══════════════════════════════════════════
// 전국 동물병원 공공데이터 동기화 API
// 카카오 키워드 검색 API → rescue_hospitals 테이블
// POST /api/admin/sync-hospitals (관리자 전용)
// ══════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

// Vercel 함수 최대 실행 시간 (5분)
export const maxDuration = 300;

/* ── 카카오 API 타입 ── */
interface KakaoDoc {
  id: string;
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
}

interface KakaoResp {
  meta: { total_count: number; pageable_count: number; is_end: boolean };
  documents: KakaoDoc[];
}

interface GridCell {
  west: number;
  south: number;
  east: number;
  north: number;
}

/* ── 시도 약칭 → 정식 명칭 ── */
const CITY_FULL: Record<string, string> = {
  서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시",
  인천: "인천광역시", 광주: "광주광역시", 대전: "대전광역시",
  울산: "울산광역시", 세종특별자치시: "세종특별자치시", 세종: "세종특별자치시",
  경기: "경기도", 강원특별자치도: "강원특별자치도", 강원: "강원특별자치도",
  충북: "충청북도", 충남: "충청남도",
  전북특별자치도: "전북특별자치도", 전북: "전북특별자치도",
  전남: "전라남도", 경북: "경상북도", 경남: "경상남도",
  제주특별자치도: "제주특별자치도", 제주: "제주특별자치도",
};

function parseAddress(addr: string) {
  const parts = addr.split(" ").filter(Boolean);
  const city = CITY_FULL[parts[0] ?? ""] ?? (parts[0] ?? "");
  return { city, district: parts[1] ?? "" };
}

/* ── 동시 요청 제한 (카카오 rate limit 방지) ── */
let inFlight = 0;
const MAX_CONCURRENT = 5;

async function throttle() {
  while (inFlight >= MAX_CONCURRENT) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

/* ── 카카오 키워드 검색 (재시도 2회 + 쓰로틀) ── */
async function kakaoSearch(
  key: string, cell: GridCell, page: number,
): Promise<KakaoResp> {
  await throttle();
  inFlight++;

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", "동물병원");
  url.searchParams.set("rect", `${cell.west},${cell.south},${cell.east},${cell.north}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", "15");

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${key}` },
      });
      if (res.ok) return await res.json();
      // 429 rate limit → 대기 후 재시도
      const wait = attempt === 0 ? 500 : 1500;
      await new Promise((r) => setTimeout(r, wait));
    }
    throw new Error("Kakao API failed");
  } finally {
    inFlight--;
  }
}

/* ── 셀 하나 검색 (재귀 분할 + 병렬) ── */
async function searchCell(
  key: string, cell: GridCell, results: Map<string, KakaoDoc>, depth = 0,
): Promise<void> {
  if (depth > 7) return;

  let first: KakaoResp;
  try {
    first = await kakaoSearch(key, cell, 1);
  } catch {
    return;
  }

  if (first.meta.total_count === 0) return;

  // 결과가 페이징 한도 초과 → 4분할 (2개씩 병렬)
  if (first.meta.total_count > first.meta.pageable_count) {
    const midLat = (cell.south + cell.north) / 2;
    const midLng = (cell.west + cell.east) / 2;
    const subs: GridCell[] = [
      { west: cell.west, south: cell.south, east: midLng, north: midLat },
      { west: midLng, south: cell.south, east: cell.east, north: midLat },
      { west: cell.west, south: midLat, east: midLng, north: cell.north },
      { west: midLng, south: midLat, east: cell.east, north: cell.north },
    ];
    // 2개씩 병렬 (rate limit 방지)
    for (let i = 0; i < subs.length; i += 2) {
      await Promise.all(
        subs.slice(i, i + 2).map((s) => searchCell(key, s, results, depth + 1)),
      );
    }
    return;
  }

  // 첫 페이지 수집
  for (const doc of first.documents) {
    if (doc.category_name.includes("동물병원")) results.set(doc.id, doc);
  }

  // 나머지 페이지 순회
  if (!first.meta.is_end) {
    const maxPage = Math.min(45, Math.ceil(first.meta.pageable_count / 15));
    for (let page = 2; page <= maxPage; page++) {
      try {
        const resp = await kakaoSearch(key, cell, page);
        for (const doc of resp.documents) {
          if (doc.category_name.includes("동물병원")) results.set(doc.id, doc);
        }
        if (resp.meta.is_end) break;
      } catch { break; }
    }
  }
}

/* ── POST 핸들러 ── */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const kakaoKey = process.env.KAKAO_REST_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "Supabase 환경변수 누락" }, { status: 500 });
  }
  if (!kakaoKey) {
    return Response.json({ error: "KAKAO_REST_API_KEY 환경변수를 설정해주세요" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── 관리자 인증 ──
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return Response.json({ error: "인증 필요" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: "인증 실패" }, { status: 401 });

  const { data: adminRow } = await supabase
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return Response.json({ error: "관리자 권한 필요" }, { status: 403 });

  // ── 밀집 지역은 작은 그리드, 나머지는 큰 그리드 ──
  const grid: GridCell[] = [];

  // 밀집 지역 (서울/경기/인천/부산/대구/대전/광주): 0.05° × 0.05° 그리드
  const DENSE_AREAS = [
    { s: 37.20, n: 37.75, w: 126.70, e: 127.25 }, // 서울 + 인천 일부
    { s: 37.10, n: 37.65, w: 126.60, e: 127.10 }, // 인천/부천/안양
    { s: 37.20, n: 37.55, w: 127.00, e: 127.50 }, // 경기 동부 (성남/용인/하남)
    { s: 37.60, n: 37.95, w: 126.70, e: 127.15 }, // 경기 북부 (고양/파주/의정부)
    { s: 37.25, n: 37.55, w: 126.80, e: 127.20 }, // 수원/안산/광명
    { s: 35.05, n: 35.25, w: 128.90, e: 129.20 }, // 부산
    { s: 35.80, n: 36.00, w: 128.50, e: 128.75 }, // 대구
    { s: 36.30, n: 36.45, w: 127.30, e: 127.50 }, // 대전
    { s: 35.10, n: 35.25, w: 126.80, e: 127.00 }, // 광주
  ];

  const denseSet = new Set<string>();

  for (const area of DENSE_AREAS) {
    for (let lat = area.s; lat < area.n; lat += 0.05) {
      for (let lng = area.w; lng < area.e; lng += 0.05) {
        const key = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
        if (denseSet.has(key)) continue;
        denseSet.add(key);
        grid.push({
          south: lat,
          north: Math.min(lat + 0.05, area.n),
          west: lng,
          east: Math.min(lng + 0.05, area.e),
        });
      }
    }
  }

  // 나머지 전국: 0.5° × 0.7° 그리드 (밀집 지역과 겹치면 건너뜀)
  for (let lat = 33.0; lat < 38.7; lat += 0.5) {
    for (let lng = 124.5; lng < 132.0; lng += 0.7) {
      // 밀집 지역과 겹치는지 체크
      const cellCenter = { lat: lat + 0.25, lng: lng + 0.35 };
      const inDense = DENSE_AREAS.some(
        (a) => cellCenter.lat >= a.s && cellCenter.lat <= a.n && cellCenter.lng >= a.w && cellCenter.lng <= a.e,
      );
      if (inDense) continue;
      grid.push({
        south: lat,
        north: Math.min(lat + 0.5, 38.7),
        west: lng,
        east: Math.min(lng + 0.7, 132.0),
      });
    }
  }

  // ── 그리드 2개씩 병렬 검색 ──
  const results = new Map<string, KakaoDoc>();

  for (let i = 0; i < grid.length; i += 2) {
    const batch = grid.slice(i, i + 2);
    await Promise.all(batch.map((cell) => searchCell(kakaoKey, cell, results)));
  }

  if (results.size === 0) {
    return Response.json({
      total: 0, inserted: 0,
      message: "검색 결과가 없습니다. KAKAO_REST_API_KEY를 확인해주세요.",
    });
  }

  // ── 변환 (전화번호 없는 병원 제외) ──
  const hospitals = Array.from(results.values())
    .filter((doc) => doc.phone && doc.phone.trim() !== "")
    .map((doc) => {
      const addr = doc.road_address_name || doc.address_name;
      const { city, district } = parseAddress(addr);
      return {
        name: doc.place_name, city, district,
        address: addr || null, phone: doc.phone,
        hours: null as string | null, note: null as string | null,
        tags: [] as string[], pinned: false,
        lat: parseFloat(doc.y), lng: parseFloat(doc.x),
        source: "kakao", kakao_place_id: doc.id,
      };
    });

  // ── 기존 카카오 데이터 삭제 후 삽입 ──
  await supabase.from("rescue_hospitals").delete().eq("source", "kakao");

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < hospitals.length; i += BATCH) {
    const batch = hospitals.slice(i, i + BATCH);
    const { error } = await supabase.from("rescue_hospitals").insert(batch);
    if (!error) inserted += batch.length;
  }

  return Response.json({
    total: hospitals.length, inserted,
    message: `전국 동물병원 ${inserted}개 동기화 완료`,
  });
}
