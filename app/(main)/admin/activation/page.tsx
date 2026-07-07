// 가입자 활성도 코호트 분석 — admin 전용.
// 145명 시점에서 누가 활성·휴면·이탈 후보·첫 등록 미완료인지 파악해서
// 운영자가 직접 손길 닿게(쪽지 발송 등) 하기 위함.
// list_all_users RPC + cats count로 클라이언트에서 분류.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Activity,
  Moon,
  AlertTriangle,
  Sparkles,
  Cat as CatIcon,
  MessageCircle,
  Users,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";

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
  color: string;
  bg: string;
}> = {
  new: {
    label: "신규",
    description: "최근 24시간 안에 가입",
    Icon: Sparkles,
    color: "#5C8DEE",
    bg: "rgba(92,141,238,0.10)",
  },
  active: {
    label: "활성",
    description: "최근 7일 안에 접속",
    Icon: Activity,
    color: "#5BA876",
    bg: "rgba(91,168,118,0.12)",
  },
  dormant: {
    label: "휴면",
    description: "8~30일 미접속",
    Icon: Moon,
    color: "#9D7AB8",
    bg: "rgba(157,122,184,0.12)",
  },
  churned: {
    label: "이탈 후보",
    description: "30일+ 미접속",
    Icon: AlertTriangle,
    color: "#D85555",
    bg: "rgba(216,85,85,0.12)",
  },
  no_cat: {
    label: "첫 등록 미완료",
    description: "가입했지만 고양이 등록 0건 (cold start 위험)",
    Icon: CatIcon,
    color: "#E88D5A",
    bg: "rgba(232,141,90,0.14)",
  },
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

  if (checking || (!authorized && !error)) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const visibleUsers = selected ? cohorts[selected] : [];

  return (
    <div className="px-4 pt-12 pb-24 max-w-2xl mx-auto" style={{ background: "#F7F4EE", minHeight: "100dvh" }}>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="어드민 홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main tracking-tight flex items-center gap-2">
            <Users size={18} className="text-primary" />
            가입자 활성도 코호트
          </h1>
          <p className="text-[11.5px] text-text-sub">
            전체 {users.length}명 · 운영자가 손길 닿을 코호트별 분류
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div
          className="rounded-2xl p-4 mb-4 text-[13px]"
          style={{ background: "#FBEAEA", color: "#B84545" }}
        >
          {error}
        </div>
      )}

      {/* 코호트 카드 그리드 */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-2.5 mb-6">
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
                  className="text-left rounded-2xl p-3.5 active:scale-[0.98] transition-transform"
                  style={{
                    background: isSelected ? meta.bg : "#FFFFFF",
                    border: isSelected
                      ? `1.5px solid ${meta.color}`
                      : "1px solid rgba(0,0,0,0.04)",
                    boxShadow: isSelected
                      ? `0 6px 18px ${meta.color}22`
                      : "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: meta.bg }}
                    >
                      <Icon size={14} color={meta.color} />
                    </span>
                    <span
                      className="text-[12px] font-extrabold"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-[24px] font-extrabold leading-none" style={{ color: "#3D2F25" }}>
                    {count}
                  </p>
                  <p className="text-[10.5px] mt-1.5 leading-snug" style={{ color: "rgba(60,46,35,0.55)" }}>
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 선택된 코호트 사용자 목록 */}
          {selected && (
            <section
              className="rounded-2xl bg-white p-4"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-extrabold" style={{ color: "#3D2F25" }}>
                  {COHORT_META[selected].label} · {visibleUsers.length}명
                </h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-[11px] text-text-sub"
                >
                  닫기
                </button>
              </div>
              {visibleUsers.length === 0 ? (
                <p className="text-[12px] text-text-light py-4 text-center">
                  해당 코호트에 사용자가 없어요.
                </p>
              ) : (
                <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {visibleUsers.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{ background: "rgba(247,244,238,0.6)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold truncate" style={{ color: "#3D2F25" }}>
                          {u.nickname}
                        </p>
                        <p className="text-[10.5px] truncate" style={{ color: "rgba(60,46,35,0.55)" }}>
                          {u.email} · 가입 {timeAgo(u.created_at)} · 접속 {timeAgo(u.last_sign_in_at)}
                          {" · "}🐾 {u.catCount}
                        </p>
                      </div>
                      <Link
                        href={`/messages?to=${u.id}`}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-extrabold active:scale-[0.97]"
                        style={{
                          background: "linear-gradient(135deg, #5C8DEE 0%, #A8684A 100%)",
                          color: "#fff",
                        }}
                        aria-label="쪽지 보내기"
                      >
                        <MessageCircle size={12} />
                        쪽지
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!selected && (
            <p className="text-center text-[11.5px] mt-2" style={{ color: "rgba(60,46,35,0.5)" }}>
              카드를 누르면 그 코호트 사용자 목록이 나와요. 휴면·이탈 후보·첫 등록 미완료를 우선 손길 대상으로.
            </p>
          )}
        </>
      )}
    </div>
  );
}
