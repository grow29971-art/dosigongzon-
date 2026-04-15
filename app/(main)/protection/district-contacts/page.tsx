"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Search, Building2 } from "lucide-react";

interface Contact {
  region: string;
  district: string;
  dept: string;
  tel: string;
}

const CONTACTS: Contact[] = [
  // ── 서울특별시 ──
  { region: "서울", district: "종로구", dept: "생활환경과 동물보호팀", tel: "02-2148-2860" },
  { region: "서울", district: "중구", dept: "청소행정과 동물보호팀", tel: "02-3396-5970" },
  { region: "서울", district: "용산구", dept: "청소행정과 동물보호팀", tel: "02-2199-7280" },
  { region: "서울", district: "성동구", dept: "청소행정과 동물보호팀", tel: "02-2286-5660" },
  { region: "서울", district: "광진구", dept: "청소행정과 동물보호팀", tel: "02-450-7654" },
  { region: "서울", district: "동대문구", dept: "청소행정과 동물보호팀", tel: "02-2127-4854" },
  { region: "서울", district: "중랑구", dept: "청소행정과 동물보호팀", tel: "02-2094-2180" },
  { region: "서울", district: "성북구", dept: "청소행정과 동물보호팀", tel: "02-2241-3423" },
  { region: "서울", district: "강북구", dept: "청소행정과 동물보호팀", tel: "02-901-6922" },
  { region: "서울", district: "도봉구", dept: "청소행정과 동물보호팀", tel: "02-2091-3763" },
  { region: "서울", district: "노원구", dept: "청소행정과 동물보호팀", tel: "02-2116-3944" },
  { region: "서울", district: "은평구", dept: "청소행정과 동물보호팀", tel: "02-351-7654" },
  { region: "서울", district: "서대문구", dept: "청소행정과 동물보호팀", tel: "02-330-1845" },
  { region: "서울", district: "마포구", dept: "청소행정과 동물보호팀", tel: "02-3153-9232" },
  { region: "서울", district: "양천구", dept: "청소행정과 동물보호팀", tel: "02-2620-3543" },
  { region: "서울", district: "강서구", dept: "청소행정과 동물보호팀", tel: "02-2600-6154" },
  { region: "서울", district: "구로구", dept: "청소행정과 동물보호팀", tel: "02-860-2874" },
  { region: "서울", district: "금천구", dept: "청소행정과 동물보호팀", tel: "02-2627-2542" },
  { region: "서울", district: "영등포구", dept: "청소행정과 동물보호팀", tel: "02-2670-3754" },
  { region: "서울", district: "동작구", dept: "청소행정과 동물보호팀", tel: "02-820-9846" },
  { region: "서울", district: "관악구", dept: "청소행정과 동물보호팀", tel: "02-879-6533" },
  { region: "서울", district: "서초구", dept: "청소행정과 동물보호팀", tel: "02-2155-8690" },
  { region: "서울", district: "강남구", dept: "청소행정과 동물보호팀", tel: "02-3423-6181" },
  { region: "서울", district: "송파구", dept: "청소행정과 동물보호팀", tel: "02-2147-3424" },
  { region: "서울", district: "강동구", dept: "청소행정과 동물보호팀", tel: "02-3425-5970" },

  // ── 인천광역시 ──
  { region: "인천", district: "중구", dept: "환경위생과 동물보호팀", tel: "032-760-7360" },
  { region: "인천", district: "동구", dept: "환경위생과 동물보호팀", tel: "032-770-6360" },
  { region: "인천", district: "미추홀구", dept: "환경위생과 동물보호팀", tel: "032-880-4370" },
  { region: "인천", district: "연수구", dept: "환경위생과 동물보호팀", tel: "032-749-7530" },
  { region: "인천", district: "남동구", dept: "환경위생과 동물보호팀", tel: "032-453-2470" },
  { region: "인천", district: "부평구", dept: "환경위생과 동물보호팀", tel: "032-509-6420" },
  { region: "인천", district: "계양구", dept: "환경위생과 동물보호팀", tel: "032-450-5670" },
  { region: "인천", district: "서구", dept: "환경위생과 동물보호팀", tel: "032-560-4350" },
  { region: "인천", district: "강화군", dept: "환경위생과 동물보호팀", tel: "032-930-3556" },
  { region: "인천", district: "옹진군", dept: "환경위생과 동물보호팀", tel: "032-899-3230" },

  // ── 경기도 (주요) ──
  { region: "경기", district: "수원시", dept: "동물보호과", tel: "031-228-3654" },
  { region: "경기", district: "성남시", dept: "동물보호과", tel: "031-729-3284" },
  { region: "경기", district: "고양시", dept: "동물보호과", tel: "031-8075-3774" },
  { region: "경기", district: "용인시", dept: "동물보호과", tel: "031-324-3285" },
  { region: "경기", district: "부천시", dept: "동물보호과", tel: "032-625-3650" },
  { region: "경기", district: "안산시", dept: "동물보호과", tel: "031-481-3216" },
  { region: "경기", district: "안양시", dept: "동물보호과", tel: "031-8045-5633" },
  { region: "경기", district: "남양주시", dept: "동물보호과", tel: "031-590-2654" },
  { region: "경기", district: "화성시", dept: "동물보호과", tel: "031-369-3654" },
  { region: "경기", district: "평택시", dept: "동물보호과", tel: "031-8024-3654" },
  { region: "경기", district: "의정부시", dept: "동물보호과", tel: "031-828-4642" },
  { region: "경기", district: "시흥시", dept: "동물보호과", tel: "031-310-3654" },
  { region: "경기", district: "파주시", dept: "동물보호과", tel: "031-940-4654" },
  { region: "경기", district: "김포시", dept: "동물보호과", tel: "031-980-2654" },
  { region: "경기", district: "광명시", dept: "동물보호과", tel: "02-2680-2654" },
  { region: "경기", district: "광주시", dept: "동물보호과", tel: "031-760-4654" },

  // ── 부산광역시 (주요) ──
  { region: "부산", district: "해운대구", dept: "위생과 동물보호팀", tel: "051-749-4474" },
  { region: "부산", district: "부산진구", dept: "위생과 동물보호팀", tel: "051-605-4474" },
  { region: "부산", district: "남구", dept: "위생과 동물보호팀", tel: "051-607-4474" },
  { region: "부산", district: "동래구", dept: "위생과 동물보호팀", tel: "051-550-4474" },
  { region: "부산", district: "사하구", dept: "위생과 동물보호팀", tel: "051-220-4474" },

  // ── 대구광역시 (주요) ──
  { region: "대구", district: "중구", dept: "위생과 동물보호팀", tel: "053-661-2780" },
  { region: "대구", district: "수성구", dept: "위생과 동물보호팀", tel: "053-666-2780" },
  { region: "대구", district: "달서구", dept: "위생과 동물보호팀", tel: "053-667-2780" },

  // ── 대전광역시 ──
  { region: "대전", district: "유성구", dept: "위생과 동물보호팀", tel: "042-611-2780" },
  { region: "대전", district: "서구", dept: "위생과 동물보호팀", tel: "042-288-2780" },

  // ── 광주광역시 ──
  { region: "광주", district: "북구", dept: "위생과 동물보호팀", tel: "062-410-6284" },
  { region: "광주", district: "서구", dept: "위생과 동물보호팀", tel: "062-360-7284" },

  // ── 공통 ──
  { region: "공통", district: "동물보호콜센터", dept: "농림축산식품부", tel: "1577-0954" },
  { region: "공통", district: "동물학대 신고", dept: "경찰", tel: "112" },
];

const REGIONS = ["전체", "인천", "서울", "경기", "부산", "대구", "대전", "광주", "공통"];

export default function DistrictContactsPage() {
  const [selectedRegion, setSelectedRegion] = useState("인천");
  const [search, setSearch] = useState("");

  const filtered = CONTACTS.filter((c) => {
    if (selectedRegion !== "전체" && c.region !== selectedRegion) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        c.district.toLowerCase().includes(q) ||
        c.dept.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="px-5 pt-14 pb-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/protection"
          className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft size={18} className="text-text-sub" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main">구청 동물보호 연락처</h1>
          <p className="text-[12px] text-text-sub">TNR · 구조 · 학대신고 담당부서</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-border mb-4">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="지역 또는 구 이름 검색"
          className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
        />
      </div>

      {/* 지역 탭 */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRegion(r)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-all active:scale-95"
            style={{
              backgroundColor: selectedRegion === r ? "#C47E5A" : "#F5F3EE",
              color: selectedRegion === r ? "#fff" : "#7A756E",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-[13px] text-text-sub py-8">
            검색 결과가 없어요.
          </p>
        )}
        {filtered.map((c, i) => (
          <a
            key={i}
            href={`tel:${c.tel.replace(/-/g, "")}`}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.04)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(91,168,118,0.1)" }}
            >
              <Building2 size={18} style={{ color: "#5BA876" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#F5F3EE", color: "#7A756E" }}>
                  {c.region}
                </span>
                <p className="text-[14px] font-bold text-text-main truncate">{c.district}</p>
              </div>
              <p className="text-[11px] text-text-sub mt-0.5">{c.dept}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Phone size={13} className="text-primary" />
              <span className="text-[12px] font-bold text-primary">{c.tel}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
