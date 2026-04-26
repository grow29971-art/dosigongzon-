"use client";

// 1000명 이벤트 키링 응모자 관리 (admin 전용).
// - 전체 응모자 카드 + 상태 변경(pending → selected → shipped, 또는 rejected)
// - admin_note 메모 가능
// - CSV 내보내기 (배송 전 주소·전화 정리용)

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Gift, Phone, MapPin, Check, X, Truck, Download, RefreshCw,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";

type EntryStatus = "pending" | "selected" | "shipped" | "rejected";

interface Entry {
  id: string;
  user_id: string;
  name: string | null;          // 단순화 후 NULL 가능
  address: string | null;
  phone: string | null;
  cat_photo_url: string | null;
  status: EntryStatus;
  admin_note: string | null;
  created_at: string;
}

interface UserMini {
  nickname: string;
  avatar_url: string | null;
}

const STATUS_META: Record<EntryStatus, { label: string; color: string; bg: string; emoji: string }> = {
  pending:  { label: "대기",   color: "#A38E7A", bg: "#EEE8E0", emoji: "⏳" },
  selected: { label: "당첨",   color: "#5BA876", bg: "#E8ECE5", emoji: "🎉" },
  shipped:  { label: "배송완료", color: "#4A7BA8", bg: "#E5E8ED", emoji: "📦" },
  rejected: { label: "제외",   color: "#D85555", bg: "#FBEAEA", emoji: "✖️" },
};

const STATUS_ORDER: EntryStatus[] = ["pending", "selected", "shipped", "rejected"];

export default function AdminEventKeyringPage() {
  const toast = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserMini>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<EntryStatus | "all">("all");

  useEffect(() => {
    isCurrentUserAdmin()
      .then((ok) => {
        setAuthorized(ok);
        setAuthChecked(true);
      })
      .catch(() => { setAuthorized(false); setAuthChecked(true); });
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("event_keyring_entries")
        .select("*")
        .order("created_at", { ascending: false });
      const list = (data ?? []) as Entry[];
      setEntries(list);

      // 응모자 닉네임/아바타 일괄 조회
      const userIds = Array.from(new Set(list.map((e) => e.user_id)));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nickname, email, avatar_url")
          .in("id", userIds);
        const map: Record<string, UserMini> = {};
        for (const p of (profs ?? []) as { id: string; nickname: string | null; email: string | null; avatar_url: string | null }[]) {
          map[p.id] = {
            nickname: p.nickname ?? p.email?.split("@")[0] ?? "익명",
            avatar_url: p.avatar_url,
          };
        }
        setProfiles(map);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "목록 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const updateStatus = async (id: string, next: EntryStatus) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("event_keyring_entries")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: next } : e)));
      toast.success(`${STATUS_META[next].label} 상태로 변경됐어요`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "상태 변경 실패");
    }
  };

  const updateNote = async (id: string, note: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("event_keyring_entries")
        .update({ admin_note: note || null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, admin_note: note || null } : e)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "메모 저장 실패");
    }
  };

  const exportCsv = () => {
    const visible = filter === "all" ? entries : entries.filter((e) => e.status === filter);
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const header = ["응모자", "이름(구)", "전화", "주소", "상태", "메모", "응모일시"].join(",");
    const rows = visible.map((e) => [
      esc(profiles[e.user_id]?.nickname ?? null),
      esc(e.name),
      esc(e.phone),
      esc(e.address),
      STATUS_META[e.status].label,
      esc(e.admin_note),
      new Date(e.created_at).toLocaleString("ko-KR"),
    ].join(","));
    const csv = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `이벤트응모자_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authChecked) {
    return <div className="min-h-dvh flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }
  if (!authorized) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[15px] font-extrabold text-text-main mb-2">권한 없음</p>
        <Link href="/mypage" className="text-[13px] font-bold text-primary mt-4">마이페이지로</Link>
      </div>
    );
  }

  const counts: Record<EntryStatus | "all", number> = {
    all: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    selected: entries.filter((e) => e.status === "selected").length,
    shipped: entries.filter((e) => e.status === "shipped").length,
    rejected: entries.filter((e) => e.status === "rejected").length,
  };
  const visible = filter === "all" ? entries : entries.filter((e) => e.status === filter);

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin" className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} aria-label="admin">
            <ArrowLeft size={18} className="text-text-main" />
          </Link>
          <div>
            <h1 className="text-[18px] font-extrabold text-text-main flex items-center gap-1.5">
              <Gift size={16} style={{ color: "#C47E5A" }} />
              이벤트 응모자
            </h1>
            <p className="text-[11px] text-text-sub">총 {entries.length}명</p>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={reload} disabled={loading}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90 disabled:opacity-50"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} aria-label="새로고침">
            <RefreshCw size={15} className={`text-text-main ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={exportCsv} disabled={entries.length === 0}
            className="px-3 h-9 rounded-full bg-primary text-white text-[12px] font-extrabold flex items-center gap-1 active:scale-95 disabled:opacity-50"
            style={{ boxShadow: "0 2px 8px rgba(196,126,90,0.25)" }}>
            <Download size={13} />
            CSV
          </button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="px-4 mb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {(["all", ...STATUS_ORDER] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold active:scale-95 transition-transform"
            style={{
              background: filter === k ? "#C47E5A" : "#FFFFFF",
              color: filter === k ? "#FFFFFF" : "#6B5043",
              border: filter === k ? "1px solid #C47E5A" : "1px solid rgba(0,0,0,0.05)",
            }}>
            {k === "all" ? "전체" : STATUS_META[k].label} {counts[k] > 0 && <span className="ml-0.5 opacity-80">{counts[k]}</span>}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="px-4 space-y-3">
        {loading && (
          <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin text-primary" /></div>
        )}
        {!loading && visible.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-white" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <Gift size={32} className="mx-auto mb-2 text-text-light opacity-30" />
            <p className="text-[13px] text-text-sub font-semibold">응모자가 없어요</p>
          </div>
        )}
        {!loading && visible.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            profile={profiles[entry.user_id]}
            onStatus={updateStatus}
            onNote={updateNote}
          />
        ))}
      </div>
    </div>
  );
}

function EntryCard({
  entry, profile, onStatus, onNote,
}: {
  entry: Entry;
  profile: UserMini | undefined;
  onStatus: (id: string, status: EntryStatus) => void;
  onNote: (id: string, note: string) => void;
}) {
  const meta = STATUS_META[entry.status];
  const [note, setNote] = useState(entry.admin_note ?? "");
  const [savingNote, setSavingNote] = useState(false);

  const saveNote = async () => {
    if (note === (entry.admin_note ?? "")) return;
    setSavingNote(true);
    await onNote(entry.id, note);
    setSavingNote(false);
  };

  const displayName = profile?.nickname ?? entry.name ?? "익명";
  const isSimpleEntry = !entry.cat_photo_url && !entry.phone && !entry.address;

  return (
    <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: `1px solid ${meta.color}25` }}>
      <div className="flex items-start gap-3">
        {/* 사진 — 고양이 사진 또는 응모자 아바타 폴백 */}
        {entry.cat_photo_url ? (
          <a href={entry.cat_photo_url} target="_blank" rel="noopener noreferrer"
            className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 80, height: 80 }}>
            <Image src={entry.cat_photo_url} alt="" fill sizes="80px" style={{ objectFit: "cover" }} />
          </a>
        ) : profile?.avatar_url ? (
          <div className="relative shrink-0 rounded-xl overflow-hidden bg-surface-alt" style={{ width: 80, height: 80 }}>
            <Image src={profile.avatar_url} alt="" fill sizes="80px" style={{ objectFit: "cover" }} />
          </div>
        ) : (
          <div className="shrink-0 rounded-xl flex items-center justify-center bg-surface-alt"
            style={{ width: 80, height: 80 }}>
            <Gift size={28} className="text-text-light" />
          </div>
        )}
        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md"
              style={{ background: meta.bg, color: meta.color }}>
              {meta.emoji} {meta.label}
            </span>
            <span className="text-[10px] text-text-light ml-auto">
              {new Date(entry.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          <p className="text-[14.5px] font-extrabold text-text-main truncate">{displayName}</p>
          {entry.phone && (
            <a href={`tel:${entry.phone}`} className="flex items-center gap-1 mt-0.5 text-[12px] font-bold" style={{ color: "#22B573" }}>
              <Phone size={11} />
              {entry.phone}
            </a>
          )}
          {entry.address && (
            <p className="flex items-start gap-1 mt-1 text-[11.5px] text-text-sub leading-snug">
              <MapPin size={11} className="shrink-0 mt-0.5" />
              <span>{entry.address}</span>
            </p>
          )}
          {isSimpleEntry && (
            <p className="mt-1 text-[11px] text-text-light leading-snug">
              사진·연락처 미수집 — 추첨 후 쪽지로 별도 안내 예정
            </p>
          )}
        </div>
      </div>

      {/* 상태 변경 버튼 */}
      <div className="flex gap-1 mt-3 flex-wrap">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          const active = entry.status === s;
          return (
            <button key={s} onClick={() => onStatus(entry.id, s)} disabled={active}
              className="flex-1 min-w-0 py-2 rounded-lg text-[11.5px] font-bold flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
              style={{
                background: active ? m.color : `${m.color}15`,
                color: active ? "#fff" : m.color,
              }}>
              {s === "selected" ? <Check size={12} /> : s === "shipped" ? <Truck size={12} /> : s === "rejected" ? <X size={12} /> : null}
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 메모 */}
      <div className="mt-3">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder="관리자 메모 (예: 운송장 1234567890)"
          maxLength={200}
          disabled={savingNote}
          className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
          style={{ background: "#F6F1EA", border: "1px solid #E3DCD3" }}
        />
      </div>
    </div>
  );
}
