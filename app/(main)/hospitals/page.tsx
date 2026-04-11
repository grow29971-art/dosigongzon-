"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  Phone,
  Clock,
  Stethoscope,
  Pin,
  Loader2,
  Heart,
} from "lucide-react";
import {
  listRescueHospitals,
  groupByCityDistrict,
  type RescueHospital,
} from "@/lib/hospitals-repo";

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<RescueHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("전체");

  useEffect(() => {
    let cancelled = false;
    listRescueHospitals()
      .then((list) => {
        if (!cancelled) setHospitals(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 검색 필터
  const filtered = useMemo(() => {
    const q = search.trim();
    return hospitals.filter((h) => {
      if (cityFilter !== "전체" && h.city !== cityFilter) return false;
      if (!q) return true;
      return (
        h.name.includes(q) ||
        h.city.includes(q) ||
        h.district.includes(q) ||
        (h.address?.includes(q) ?? false) ||
        h.tags.some((t) => t.includes(q))
      );
    });
  }, [hospitals, search, cityFilter]);

  // 시 목록 (필터용)
  const cities = useMemo(() => {
    const set = new Set<string>();
    hospitals.forEach((h) => set.add(h.city));
    return ["전체", ...Array.from(set).sort()];
  }, [hospitals]);

  const groups = useMemo(() => groupByCityDistrict(filtered), [filtered]);

  return (
    <div className="px-4 pt-14 pb-8">
      {/* ── 헤더 ── */}
      <div className="mb-5 px-1">
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[24px] font-extrabold text-text-main tracking-tight">
            구조동물 치료 도움병원
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-[2px] rounded-full"
            style={{ backgroundColor: "#C47E5A", opacity: 0.6 }}
          />
          <p className="text-[12px] font-bold text-text-sub">
            길 위의 아이들 치료를 도와주시는 병원
          </p>
          <span
            className="text-[9px] font-bold tracking-[0.15em]"
            style={{ color: "#C47E5A", opacity: 0.5 }}
          >
            RESCUE VETS
          </span>
        </div>
      </div>

      {/* ── 검색 ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 mb-3"
        style={{
          background: "#FFFFFF",
          borderRadius: 18,
          boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <Search size={18} className="text-text-muted shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="병원명, 지역, 태그로 검색..."
          className="flex-1 text-[13px] text-text-main bg-transparent outline-none placeholder:text-text-muted"
        />
      </div>

      {/* ── 시 필터 ── */}
      {cities.length > 1 && (
        <div className="flex gap-2 pb-4 overflow-x-auto no-scrollbar">
          {cities.map((c) => {
            const active = cityFilter === c;
            return (
              <button
                key={c}
                onClick={() => setCityFilter(c)}
                className="shrink-0 px-4 py-2 rounded-full text-[12.5px] font-bold transition-all"
                style={{
                  backgroundColor: active ? "#C47E5A" : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#A38E7A",
                  border: `1.5px solid ${active ? "#C47E5A" : "#E3DCD3"}`,
                  boxShadow: active ? "0 4px 12px rgba(196,126,90,0.35)" : "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 본문 ── */}
      {loading ? (
        <div className="flex justify-center pt-16">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="pt-16 text-center">
          <Stethoscope
            size={44}
            strokeWidth={1.2}
            className="text-text-light mx-auto mb-3"
          />
          <p className="text-[14px] font-bold text-text-main mb-1">
            {hospitals.length === 0
              ? "아직 등록된 병원이 없어요"
              : "검색 결과가 없어요"}
          </p>
          {hospitals.length === 0 && (
            <p className="text-[11px] text-text-sub">
              관리자가 섭외한 병원이 여기에 표시돼요
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.city}>
              {/* 시 헤더 */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div
                  className="w-1 h-4 rounded-full"
                  style={{ backgroundColor: "#C47E5A" }}
                />
                <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">
                  {group.city}
                </h2>
                <span className="text-[10px] font-bold text-text-light tabular-nums">
                  {group.districts.reduce(
                    (sum, d) => sum + d.hospitals.length,
                    0,
                  )}
                  개
                </span>
              </div>

              {/* 군별 그룹 */}
              <div className="space-y-4">
                {group.districts.map((d) => (
                  <div key={d.district}>
                    <h3 className="text-[12px] font-bold text-text-sub mb-2 px-1 flex items-center gap-1.5">
                      <MapPin size={11} className="text-text-light" />
                      {d.district}
                    </h3>
                    <div className="space-y-2.5">
                      {d.hospitals.map((h) => (
                        <HospitalCard key={h.id} hospital={h} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ 병원 카드 ═══ */
function HospitalCard({ hospital }: { hospital: RescueHospital }) {
  return (
    <div
      className="p-4"
      style={{
        background: "#FFFFFF",
        borderRadius: 18,
        boxShadow: hospital.pinned
          ? "0 8px 24px rgba(196,126,90,0.14), 0 1px 3px rgba(0,0,0,0.03)"
          : "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)",
        border: hospital.pinned
          ? "1.5px solid rgba(196,126,90,0.25)"
          : "1px solid rgba(0,0,0,0.04)",
      }}
    >
      {/* 헤더: 이름 + 고정 마크 + 전화 버튼 */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {hospital.pinned && (
              <span
                className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                style={{ backgroundColor: "#EEE8E0", color: "#C47E5A" }}
              >
                <Pin size={9} /> 추천
              </span>
            )}
            <div
              className="w-6 h-6 rounded-[8px] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #E86B8C 0%, #C55374 100%)",
                boxShadow: "0 3px 8px rgba(232,107,140,0.3), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              <Heart size={12} color="#fff" strokeWidth={2.3} fill="#fff" />
            </div>
            <h4 className="text-[15px] font-extrabold text-text-main tracking-tight">
              {hospital.name}
            </h4>
          </div>
        </div>
        {hospital.phone && (
          <a
            href={`tel:${hospital.phone}`}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            style={{
              background: "linear-gradient(135deg, #6B8E6F 0%, #5A7C5E 100%)",
              boxShadow: "0 4px 10px rgba(107,142,111,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <Phone size={16} color="#fff" strokeWidth={2.3} />
          </a>
        )}
      </div>

      {/* 태그 */}
      {hospital.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {hospital.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: "#F6F1EA", color: "#8B6F5A" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 정보 */}
      <div className="space-y-1 mb-2">
        {hospital.address && (
          <div className="flex items-start gap-2 text-[11.5px] text-text-sub">
            <MapPin size={12} className="text-text-light shrink-0 mt-0.5" />
            <span className="leading-relaxed">{hospital.address}</span>
          </div>
        )}
        {hospital.hours && (
          <div className="flex items-start gap-2 text-[11.5px] text-text-sub">
            <Clock size={12} className="text-text-light shrink-0 mt-0.5" />
            <span className="leading-relaxed">{hospital.hours}</span>
          </div>
        )}
      </div>

      {/* 메모 */}
      {hospital.note && (
        <div
          className="mt-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
          style={{ backgroundColor: "#F6F1EA", color: "#4A3F35" }}
        >
          {hospital.note}
        </div>
      )}
    </div>
  );
}
