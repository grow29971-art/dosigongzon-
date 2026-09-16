// 가입자 활성도 코호트 분석 — admin 전용.
// 145명 시점에서 누가 활성·휴면·이탈 후보·첫 등록 미완료인지 파악해서
// 운영자가 직접 손길 닿게(쪽지 발송 등) 하기 위함.
// list_all_users RPC + cats count로 클라이언트에서 분류.
// 2026-09-16 「익숙한 동네앱」 리디자인: 코호트 카드 그리드 → 수치 행(선택 가능), 유저 목록 → 구분선 리스트. 토큰만.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Moon,
  AlertTriangle,
  Sparkles,
  Cat as CatIcon,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import { AdminHeader, AdminLoading, AdminPage, AdminSection, EmptyState, type Tone } from "../_ui";

interface RpcUserRow {
  id: string;
  email: string;
  nickname: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface CohortUser extends RpcUserRow {
  catCount: number;
  daysSinceSignup: number;
  daysSinceLastSignIn: number | null;
}

type CohortId = "new" | "active" | "dormant" | "churned" | "no_cat";

const COHORT_META: Record<CohortId, {
  label: string;
  description: string;
  Icon: typeof Activity;
  tone: Tone;
}> = {
  new: {
    label: "신규",
    description: "최근 24시간 안에 가입",
    Icon: Sparkles,
    tone: "primary",
  },
  active: {
    label: "활성",
    description: "최근 7일 안에 접속",
    Icon: Activity,
    tone: "sage",
  },
  dormant: {
    label: "휴면",
    description: "8~30일 미접속",
    Icon: Moon,
    tone: "neutral",
  },
  churned: {
    label: "이탈 후보",
    description: "30일+ 미접속",
    Icon: AlertTriangle,
    tone: "error",
  },
  no_cat: {
    label: "첫 등록 미완료",
    description: "가입했지만 고양이 등록 0건 (cold start 위험)",
    Icon: CatIcon,
    tone: "warning",
  },
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: "var(--color-text-main)",
  error: "var(--color-error)",
  warning: "var(--color-warning)",
  sage: "var(--color-sage)",
  primary: "var(--color-primary)",
  like: "var(--color-like)",
  care: "var(--color-care)",
};

function daysBetween(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / 86400000);
}

function classifyByActivity(u: CohortUser): CohortId {
  if (u.daysSinceSignup < 1) return "new";
  if (u.daysSinceLastSignIn === null) return "churned"; // 가입만 하고 한 번도 로그인 안 한 경우(드물지만)
  if (u.daysSinceLastSignIn <= 7) return "active";
  if (u.daysSinceLastSignIn <= 30) return "dormant";
  return "churned";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const days = daysBetween(iso, Date.now());
  if (days === null) return "—";
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default function AdminActivationPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState<CohortUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CohortId | null>(null);

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        setAuthorized(isAdmin);
        setChecking(false);
        if (!isAdmin) router.replace("/");
      })
      .catch(() => {
        setAuthorized(false);
        setChecking(false);
        router.replace("/");
      });
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const sb = createClient();
        const [{ data: usersData, error: usersErr }, { data: catsData, error: catsErr }] =
          await Promise.all([
            sb.rpc("list_all_users"),
            sb.from("cats").select("caretaker_id"),
          ]);
        if (usersErr) throw usersErr;
        if (catsErr) throw catsErr;

        const catCountByUser = new Map<string, number>();
        for (const c of (catsData ?? []) as Array<{ caretaker_id: string | null }>) {
          if (!c.caretaker_id) continue;
          catCountByUser.set(c.caretaker_id, (catCountByUser.get(c.caretaker_id) ?? 0) + 1);
        }

        const now = Date.now();
        const enriched: CohortUser[] = ((usersData ?? []) as RpcUserRow[]).map((u) => ({
          ...u,
          catCount: catCountByUser.get(u.id) ?? 0,
          daysSinceSignup: daysBetween(u.created_at, now) ?? 0,
          daysSinceLastSignIn: daysBetween(u.last_sign_in_at, now),
        }));

        setUsers(enriched);
      } catch (e) {
        setError(e instanceof Error ? e.message : "데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [authorized]);

  const cohorts = useMemo(() => {
    const map: Record<CohortId, CohortUser[]> = {
      new: [],
      active: [],
      dormant: [],
      churned: [],
      no_cat: [],
    };
    for (const u of users) {
      map[classifyByActivity(u)].push(u);
      if (u.catCount === 0) map.no_cat.push(u);
    }
    // 각 코호트 내부 정렬 — 마지막 접속 최근순
    for (const id of Object.keys(map) as CohortId[]) {
      map[id].sort((a, b) => {
        const at = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
        const bt = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
        return bt - at;
      });
    }
    return map;
  }, [users]);

  if (checking || (!authorized && !error)) return <AdminLoading />;

  const visibleUsers = selected ? cohorts[selected] : [];

  return (
    <AdminPage>
      <AdminHeader
        title="가입자 활성도 코호트"
        description={`전체 ${users.length}명 · 운영자가 손길 닿을 코호트별 분류`}
      />

      {loading && <AdminLoading />}

      {error && (
        <p className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          {/* 코호트 — 수치 행(탭하면 목록) */}
          <AdminSection title="코호트" padding={false}>
            {(Object.keys(COHORT_META) as CohortId[]).map((id) => {
              const meta = COHORT_META[id];
              const count = cohorts[id].length;
              const Icon = meta.Icon;
              const isSelected = selected === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : id)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0 press"
                  style={{ background: isSelected ? "var(--color-surface-alt)" : undefined, minHeight: 56 }}
                >
                  <Icon size={20} className="shrink-0 text-text-sub" strokeWidth={1.8} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-text-main">{meta.label}</p>
                    <p className="text-[13px] text-text-light mt-0.5">{meta.description}</p>
                  </div>
                  <span className="text-[17px] font-bold tabular-nums shrink-0" style={{ color: TONE_TEXT[meta.tone] }}>
                    {count}
                  </span>
                  <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
                </button>
              );
            })}
          </AdminSection>

          {/* 선택된 코호트 사용자 목록 */}
          {selected && (
            <AdminSection
              title={`${COHORT_META[selected].label} · ${visibleUsers.length}명`}
              padding={false}
              right={
                <button type="button" onClick={() => setSelected(null)} className="text-[13px] font-semibold text-text-sub">
                  닫기
                </button>
              }
            >
              {visibleUsers.length === 0 ? (
                <EmptyState>해당 코호트에 사용자가 없어요.</EmptyState>
              ) : (
                <ul className="max-h-[60vh] overflow-y-auto">
                  {visibleUsers.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-text-main truncate">{u.nickname}</p>
                        <p className="text-[13px] text-text-light truncate mt-0.5">
                          {u.email} · 가입 {timeAgo(u.created_at)} · 접속 {timeAgo(u.last_sign_in_at)} · 고양이 {u.catCount}
                        </p>
                      </div>
                      <Link
                        href={`/messages?to=${u.id}`}
                        className="shrink-0 inline-flex items-center gap-1 h-8 px-3 text-[13px] font-semibold text-text-main press"
                        style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-input)" }}
                        aria-label="쪽지 보내기"
                      >
                        <MessageCircle size={12} />
                        쪽지
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminSection>
          )}

          {!selected && (
            <p className="text-[13px] text-text-light px-1">
              행을 누르면 그 코호트 사용자 목록이 나와요. 휴면·이탈 후보·첫 등록 미완료를 우선 손길 대상으로.
            </p>
          )}
        </>
      )}
    </AdminPage>
  );
}
