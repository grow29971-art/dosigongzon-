"use client";

import { useState } from "react";
import {
  Search,
  MapPin,
  Phone,
  Clock,
  Star,
  ChevronDown,
  Stethoscope,
  Heart,
  Shield,
} from "lucide-react";

/* ═══ 병원 데이터 ═══ */
interface HospitalData {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  rating: number;
  reviewCount: number;
  tags: { label: string; color: string; bg: string }[];
  prices: { name: string; price: number; avg: number }[];
  district: string;
}

const HOSPITALS: HospitalData[] = [
  {
    id: "h1",
    name: "서울냥이 동물병원",
    address: "서울 강남구 역삼동 123-4",
    phone: "02-1234-5678",
    hours: "09:00 ~ 22:00 (연중무휴)",
    rating: 4.8,
    reviewCount: 127,
    tags: [
      { label: "TNR 협력", color: "#14B8A6", bg: "#CCFBF1" },
      { label: "과잉진료 없음", color: "#22C55E", bg: "#DCFCE7" },
      { label: "24시 응급", color: "#EF4444", bg: "#FEE2E2" },
    ],
    prices: [
      { name: "기본 진료", price: 15000, avg: 20000 },
      { name: "중성화(수컷)", price: 80000, avg: 120000 },
      { name: "예방접종", price: 25000, avg: 30000 },
    ],
    district: "강남구",
  },
  {
    id: "h2",
    name: "마포 고양이 전문병원",
    address: "서울 마포구 합정동 456-7",
    phone: "02-9876-5432",
    hours: "10:00 ~ 21:00 (일요일 휴무)",
    rating: 4.6,
    reviewCount: 89,
    tags: [
      { label: "TNR 협력", color: "#14B8A6", bg: "#CCFBF1" },
      { label: "고양이 전문", color: "#8B5CF6", bg: "#EDE9FE" },
    ],
    prices: [
      { name: "기본 진료", price: 18000, avg: 20000 },
      { name: "중성화(수컷)", price: 100000, avg: 120000 },
      { name: "예방접종", price: 28000, avg: 30000 },
    ],
    district: "마포구",
  },
  {
    id: "h3",
    name: "용산 24시 동물의료센터",
    address: "서울 용산구 이태원동 789-0",
    phone: "02-5555-1234",
    hours: "24시간 (연중무휴)",
    rating: 4.5,
    reviewCount: 203,
    tags: [
      { label: "24시 응급", color: "#EF4444", bg: "#FEE2E2" },
      { label: "과잉진료 없음", color: "#22C55E", bg: "#DCFCE7" },
      { label: "길고양이 할인", color: "#F97316", bg: "#FFEDD5" },
    ],
    prices: [
      { name: "기본 진료", price: 20000, avg: 20000 },
      { name: "중성화(수컷)", price: 90000, avg: 120000 },
      { name: "예방접종", price: 25000, avg: 30000 },
    ],
    district: "용산구",
  },
  {
    id: "h4",
    name: "서초 봄날 동물병원",
    address: "서울 서초구 방배동 321-5",
    phone: "02-3333-7777",
    hours: "09:30 ~ 20:00 (일요일 휴무)",
    rating: 4.9,
    reviewCount: 64,
    tags: [
      { label: "TNR 협력", color: "#14B8A6", bg: "#CCFBF1" },
      { label: "과잉진료 없음", color: "#22C55E", bg: "#DCFCE7" },
      { label: "고양이 전문", color: "#8B5CF6", bg: "#EDE9FE" },
    ],
    prices: [
      { name: "기본 진료", price: 12000, avg: 20000 },
      { name: "중성화(수컷)", price: 70000, avg: 120000 },
      { name: "예방접종", price: 22000, avg: 30000 },
    ],
    district: "서초구",
  },
];

const DISTRICTS = ["전체", "강남구", "마포구", "용산구", "서초구"];

/* ═══ 가격 비교 바 ═══ */
function PriceBar({ name, price, avg }: { name: string; price: number; avg: number }) {
  const pct = Math.min((price / avg) * 100, 100);
  const cheaper = price < avg;
  const color = cheaper ? "#22C55E" : "#F97316";

  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-text-sub w-[72px] shrink-0">{name}</span>
      <div className="flex-1 progress-bar">
        <div style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-bold w-[60px] text-right" style={{ color }}>
        {(price / 10000).toFixed(1)}만
      </span>
    </div>
  );
}

/* ═══ 병원 카드 ═══ */
function HospitalCard({ hospital }: { hospital: HospitalData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card p-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-bold text-text-main">{hospital.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            <Star size={13} className="text-[#FBBF24]" fill="#FBBF24" />
            <span className="text-[13px] font-semibold text-text-main">{hospital.rating}</span>
            <span className="text-[12px] text-text-light">({hospital.reviewCount})</span>
          </div>
        </div>
        <a
          href={`tel:${hospital.phone}`}
          className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
        >
          <Phone size={18} className="text-primary" />
        </a>
      </div>

      {/* 태그 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {hospital.tags.map((tag) => (
          <span
            key={tag.label}
            className="tag"
            style={{ color: tag.color, backgroundColor: tag.bg }}
          >
            {tag.label}
          </span>
        ))}
      </div>

      {/* 정보 */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-[12px] text-text-sub">
          <MapPin size={13} className="text-text-light shrink-0" />
          <span>{hospital.address}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-text-sub">
          <Clock size={13} className="text-text-light shrink-0" />
          <span>{hospital.hours}</span>
        </div>
      </div>

      {/* 가격 비교 토글 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-2xl bg-surface-alt text-[13px] font-semibold text-text-sub active:scale-[0.98] transition-transform"
      >
        진료비 비교
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2.5 pt-3 border-t border-divider">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-text-muted">항목</span>
            <span className="text-[11px] text-text-muted">평균 대비</span>
          </div>
          {hospital.prices.map((p) => (
            <PriceBar key={p.name} {...p} />
          ))}
          <p className="text-[10px] text-text-muted text-center pt-1">
            * 평균가는 서울 지역 기준 참고 자료입니다
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══ 페이지 ═══ */
export default function HospitalsPage() {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("전체");

  const filtered = HOSPITALS.filter((h) => {
    const matchDistrict = district === "전체" || h.district === district;
    const matchSearch =
      !search ||
      h.name.includes(search) ||
      h.address.includes(search) ||
      h.tags.some((t) => t.label.includes(search));
    return matchDistrict && matchSearch;
  });

  return (
    <div className="pb-4">
      {/* ── 헤더 ── */}
      <div className="px-5 pt-14 pb-3">
        <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
          동물병원
        </h1>
        <p className="text-[13px] text-text-sub mt-1">
          길고양이 협력병원 · 진료비 비교
        </p>
      </div>

      {/* ── 검색 ── */}
      <div className="px-5 mb-3">
        <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="병원명, 지역, 태그로 검색..."
            className="flex-1 text-[14px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* ── 지역 필터 ── */}
      <div className="flex gap-2 px-5 pb-4 overflow-x-auto no-scrollbar">
        {DISTRICTS.map((d) => (
          <button
            key={d}
            onClick={() => setDistrict(d)}
            className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold border transition-all ${
              district === d
                ? "bg-primary text-white border-primary"
                : "bg-white text-text-sub border-border"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* ── 통계 요약 ── */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3.5 text-center">
            <Stethoscope size={18} className="text-primary mx-auto mb-1" />
            <p className="text-[18px] font-extrabold text-text-main">{filtered.length}</p>
            <p className="text-[11px] text-text-sub">협력병원</p>
          </div>
          <div className="card p-3.5 text-center">
            <Heart size={18} className="text-[#EF4444] mx-auto mb-1" />
            <p className="text-[18px] font-extrabold text-text-main">
              {filtered.filter((h) => h.tags.some((t) => t.label === "과잉진료 없음")).length}
            </p>
            <p className="text-[11px] text-text-sub">과잉진료 없음</p>
          </div>
          <div className="card p-3.5 text-center">
            <Shield size={18} className="text-[#14B8A6] mx-auto mb-1" />
            <p className="text-[18px] font-extrabold text-text-main">
              {filtered.filter((h) => h.tags.some((t) => t.label === "TNR 협력")).length}
            </p>
            <p className="text-[11px] text-text-sub">TNR 협력</p>
          </div>
        </div>
      </div>

      {/* ── 병원 리스트 ── */}
      <div className="px-5 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center pt-16 text-text-light">
            <Stethoscope size={48} strokeWidth={1.2} />
            <p className="text-base mt-4 text-text-sub">검색 결과가 없습니다</p>
          </div>
        ) : (
          filtered.map((h) => <HospitalCard key={h.id} hospital={h} />)
        )}
      </div>
    </div>
  );
}
