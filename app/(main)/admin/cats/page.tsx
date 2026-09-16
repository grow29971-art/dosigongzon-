"use client";

// 관리자 — 고양이 일괄 관리 (더미/부적절 데이터 정리용)
// 검색 + 체크박스 다중 선택 → 일괄 삭제, 개별 숨김 토글.
// RLS: cats_update_admin / cats_delete_admin (admins 테이블 기반)
// 2026-09-16 「익숙한 동네앱」 리디자인: 카드 목록 → 구분선 리스트(원형 썸네일), 세그먼트 필터, 토큰만.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Eye, EyeOff, Search, Cat as CatIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, HairlineButton,
  SegmentTabs, inputStyle,
} from "../_ui";

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

  if (!authChecked) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  return (
    <AdminPage className="pb-32">
      <AdminHeader
        title="고양이 관리"
        description="지도 고양이 검색·숨김·일괄 삭제"
        right={<span className="text-[13px] font-semibold text-text-light tabular-nums">{cats.length}마리</span>}
      />

      {/* 검색 */}
      <div className="flex items-center gap-2 px-3 h-10 mb-3 bg-surface" style={inputStyle}>
        <Search size={15} className="text-text-light shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·동네·등록자 검색"
          className="flex-1 text-[15px] text-text-main outline-none bg-transparent placeholder:text-text-muted"
        />
      </div>

      {/* 필터 + 전체선택 */}
      <div className="flex items-center gap-2 mb-3">
        <SegmentTabs
          className="flex-1"
          value={filter}
          onChange={setFilter}
          items={[
            { key: "all", label: "전체" },
            { key: "visible", label: "공개" },
            { key: "hidden", label: "숨김" },
          ]}
        />
        <HairlineButton onClick={selectAllVisible} size="md">
          {selected.size === visible.length && visible.length > 0 ? "전체 해제" : "전체 선택"}
        </HairlineButton>
      </div>

      {error && (
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      <AdminSection padding={false}>
        {loading ? (
          <AdminLoading />
        ) : visible.length === 0 ? (
          <EmptyState>조건에 맞는 고양이가 없어요.</EmptyState>
        ) : (
          visible.map((cat) => {
            const checked = selected.has(cat.id);
            const thumb = sanitizeImageUrl(cat.photo_url, "");
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0"
                style={{
                  background: checked ? "var(--color-surface-alt)" : undefined,
                  opacity: cat.hidden ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelect(cat.id)}
                  className="w-4 h-4 shrink-0 accent-primary"
                  aria-label={`${cat.name} 선택`}
                />
                <div
                  className="w-11 h-11 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
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
                  <div className="flex items-center gap-1.5">
                    <p className="text-[15px] font-semibold text-text-main truncate">{cat.name}</p>
                    {cat.hidden && <AdminTag>숨김</AdminTag>}
                  </div>
                  <p className="text-[13px] text-text-light truncate mt-0.5">
                    {cat.region ?? "지역 없음"} · {cat.caretaker_name ?? "등록자 없음"} · {formatDate(cat.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleHidden(cat)}
                  disabled={working}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 press disabled:opacity-40 text-text-sub"
                  style={{ border: "1px solid var(--color-border)" }}
                  aria-label={cat.hidden ? "숨김 해제" : "숨기기"}
                >
                  {cat.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            );
          })
        )}
      </AdminSection>

      {/* 하단 고정 일괄 삭제 바 */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <UIButton variant="danger" size="lg" full onClick={handleBulkDelete} disabled={working}>
            {working ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            선택한 {selected.size}마리 삭제
          </UIButton>
        </div>
      )}
    </AdminPage>
  );
}
