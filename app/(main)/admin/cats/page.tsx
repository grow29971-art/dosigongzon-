"use client";

// 관리자 — 고양이 일괄 관리 (더미/부적절 데이터 정리용)
// 검색 + 체크박스 다중 선택 → 일괄 삭제, 개별 숨김 토글.
// RLS: cats_update_admin / cats_delete_admin (admins 테이블 기반)

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield, Trash2, Eye, EyeOff, Search, Cat as CatIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

interface AdminCatRow {
  id: string;
  name: string;
  photo_url: string | null;
  region: string | null;
  caretaker_id: string | null;
  caretaker_name: string | null;
  hidden: boolean;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul", year: "2-digit", month: "short", day: "numeric",
  });
}

export default function AdminCatsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cats, setCats] = useState<AdminCatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "hidden" | "visible">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: qError } = await supabase
        .from("cats")
        .select("id, name, photo_url, region, caretaker_id, caretaker_name, hidden, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (qError) throw qError;
      setCats((data ?? []) as AdminCatRow[]);
    } catch (e) {
      console.error("[admin/cats] load failed:", e);
      setCats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin().then(async (admin) => {
      if (cancelled) return;
      setIsAdmin(admin);
      setAuthChecked(true);
      if (admin) await refresh();
      else setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refresh]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cats.filter((c) => {
      if (filter === "hidden" && !c.hidden) return false;
      if (filter === "visible" && c.hidden) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.region ?? "").toLowerCase().includes(q) ||
        (c.caretaker_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [cats, query, filter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((c) => c.id)),
    );
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 고양이 ${selected.size}마리를 삭제할까요?\n돌봄일지·댓글 등 연결 데이터도 함께 사라지며 되돌릴 수 없어요.`)) return;
    setWorking(true);
    setError("");
    try {
      const supabase = createClient();
      const ids = Array.from(selected);
      const { error: dError, count } = await supabase
        .from("cats")
        .delete({ count: "exact" })
        .in("id", ids);
      if (dError) throw dError;
      if ((count ?? 0) < ids.length) {
        setError(`${ids.length}마리 중 ${count ?? 0}마리만 삭제됐어요. 관리자 삭제 정책(RLS)을 확인해주세요.`);
      }
      setSelected(new Set());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했어요.");
    } finally {
      setWorking(false);
    }
  };

  const handleToggleHidden = async (cat: AdminCatRow) => {
    setWorking(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: uError } = await supabase
        .from("cats")
        .update({ hidden: !cat.hidden })
        .eq("id", cat.id);
      if (uError) throw uError;
      setCats((prev) => prev.map((c) => (c.id === cat.id ? { ...c, hidden: !c.hidden } : c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했어요.");
    } finally {
      setWorking(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-20 text-center">
        <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
        <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-32">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[17px] font-extrabold text-text-main flex items-center gap-1.5">
          <CatIcon size={17} className="text-primary" /> 고양이 관리
        </h1>
        <span className="text-[11.5px] font-bold text-text-light ml-auto">{cats.length}마리</span>
      </div>

      {/* 검색 */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 mb-3"
        style={{ background: "#fff", borderRadius: "var(--radius-input)", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "var(--shadow-card-sm)" }}
      >
        <Search size={15} className="text-text-light shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·동네·등록자 검색"
          className="flex-1 text-[13px] outline-none bg-transparent"
        />
      </div>

      {/* 필터 + 전체선택 */}
      <div className="flex items-center gap-1.5 mb-3">
        {([["all", "전체"], ["visible", "공개"], ["hidden", "숨김"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded-xl text-[11.5px] font-bold"
            style={{
              background: filter === key ? "var(--color-primary)" : "#fff",
              color: filter === key ? "#fff" : "#666",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={selectAllVisible}
          className="ml-auto px-3 py-1.5 rounded-xl text-[11.5px] font-bold"
          style={{ background: "#fff", color: "var(--color-primary)", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}
        >
          {selected.size === visible.length && visible.length > 0 ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      {error && (
        <p className="text-[12px] font-bold mb-3" style={{ color: "#D85555" }}>{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center pt-10">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center text-[13px] text-text-sub pt-10">조건에 맞는 고양이가 없어요.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((cat) => {
            const checked = selected.has(cat.id);
            const thumb = sanitizeImageUrl(cat.photo_url, "");
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 p-3"
                style={{
                  background: "#fff",
                  borderRadius: "var(--radius-card-sm)",
                  boxShadow: "var(--shadow-card)",
                  border: checked ? "1.5px solid rgba(25, 31, 40,0.45)" : "1px solid rgba(0,0,0,0.04)",
                  opacity: cat.hidden ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelect(cat.id)}
                  className="w-4 h-4 shrink-0 accent-[#191F28]"
                  aria-label={`${cat.name} 선택`}
                />
                <div
                  className="w-11 h-11 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ background: "var(--color-surface-alt)" }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <CatIcon size={18} className="text-text-light" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold text-text-main truncate">
                    {cat.name}
                    {cat.hidden && <span className="ml-1.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(216,85,85,0.12)", color: "#D85555" }}>숨김</span>}
                  </p>
                  <p className="text-[11px] text-text-light truncate mt-0.5">
                    {cat.region ?? "지역 없음"} · {cat.caretaker_name ?? "등록자 없음"} · {formatDate(cat.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleHidden(cat)}
                  disabled={working}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:scale-90 disabled:opacity-40"
                  style={{ background: "var(--color-surface-alt)" }}
                  aria-label={cat.hidden ? "숨김 해제" : "숨기기"}
                >
                  {cat.hidden ? <EyeOff size={15} className="text-text-sub" /> : <Eye size={15} className="text-text-sub" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 하단 고정 일괄 삭제 바 */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ background: "#fff", boxShadow: "0 -4px 16px rgba(20,40,70,0.08)" }}
        >
          <button
            onClick={handleBulkDelete}
            disabled={working}
            className="w-full py-3.5 rounded-2xl text-white text-[14px] font-extrabold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#D85555", boxShadow: "0 6px 20px rgba(216,85,85,0.3)" }}
          >
            {working ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            선택한 {selected.size}마리 삭제
          </button>
        </div>
      )}
    </div>
  );
}
