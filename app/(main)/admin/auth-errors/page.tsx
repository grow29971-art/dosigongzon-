"use client";

// 로그인 실패 로그 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 그라디언트 요약 카드·순위 색 박스 → 헤어라인 섹션 + 수치 행, 로그 카드 → 구분선 리스트(펼침), 회색 태그. 토큰만.

import { useEffect, useState } from "react";
import {
  Loader2,
  Shield,
  AlertCircle,
  Filter,
  Trash2,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listAuthErrors,
  aggregateByErrorCode,
  purgeOldLogs,
  deleteAuthError,
  type AuthErrorLog,
  type ErrorCodeStat,
} from "@/lib/auth-errors-repo";
import { explainAuthError } from "@/lib/auth-errors";
import UIChip from "@/app/components/ui/Chip";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, HairlineButton, SegmentTabs, StatRow,
} from "../_ui";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function formatAbs(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortUA(ua: string | null): string {
  if (!ua) return "UA 없음";
  // 아주 간단한 파서
  if (/KAKAOTALK/i.test(ua)) return "카카오톡 인앱";
  if (/Instagram/i.test(ua)) return "인스타 인앱";
  if (/FBAN|FBAV/i.test(ua)) return "페북 인앱";
  if (/Line/i.test(ua)) return "라인 인앱";
  if (/CriOS/.test(ua)) return "Chrome iOS";
  if (/FxiOS/.test(ua)) return "Firefox iOS";
  if (/iPhone|iPad/.test(ua) && /Safari/.test(ua)) return "Safari iOS";
  if (/Android/.test(ua) && /Chrome/.test(ua)) return "Chrome Android";
  if (/Edg/.test(ua)) return "Edge";
  if (/Firefox/.test(ua)) return "Firefox";
  if (/Chrome/.test(ua)) return "Chrome";
  if (/Safari/.test(ua)) return "Safari";
  return ua.slice(0, 40);
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  magic_link: "매직링크",
};

export default function AdminAuthErrorsPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [days, setDays] = useState(7);
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState<string | null>(null);

  const [stats, setStats] = useState<ErrorCodeStat[]>([]);
  const [logs, setLogs] = useState<AuthErrorLog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const [agg, list] = await Promise.all([
        aggregateByErrorCode(days),
        listAuthErrors({ provider: providerFilter, errorCode: codeFilter, days, limit: 200 }),
      ]);
      setStats(agg);
      setLogs(list);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const admin = await isCurrentUserAdmin();
      setIsAdmin(admin);
      setAuthChecked(true);
      if (admin) {
        await refresh();
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, providerFilter, codeFilter, isAdmin]);

  const handlePurge = async () => {
    const input = prompt("며칠 이전 로그를 삭제할까요? (기본: 30)", "30");
    if (input === null) return;
    const d = parseInt(input, 10);
    if (isNaN(d) || d < 1) {
      alert("숫자로 입력해주세요 (1 이상)");
      return;
    }
    if (!confirm(`${d}일 이전 로그를 모두 삭제합니다. 계속할까요?`)) return;
    try {
      const count = await purgeOldLogs(d);
      alert(`${count}건 삭제했어요.`);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm("이 로그를 삭제할까요?")) return;
    try {
      await deleteAuthError(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  const totalCount = stats.reduce((s, x) => s + x.count, 0);
  const providerBreakdown = stats.reduce<Record<string, number>>((acc, s) => {
    const k = s.provider ?? "unknown";
    acc[k] = (acc[k] ?? 0) + s.count;
    return acc;
  }, {});

  return (
    <AdminPage>
      <AdminHeader
        title="로그인 실패 로그"
        description="OAuth/매직링크/비밀번호 로그인 실패 원인을 확인해요"
        back="/mypage"
        backLabel="마이페이지"
        right={
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="w-9 h-9 rounded-full flex items-center justify-center press disabled:opacity-50 text-text-sub"
              style={{ border: "1px solid var(--color-border)" }}
              aria-label="새로고침"
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            </button>
            <button
              type="button"
              onClick={handlePurge}
              className="w-9 h-9 rounded-full flex items-center justify-center press"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-error)" }}
              aria-label="오래된 로그 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        }
      />

      {/* 기간 */}
      <SegmentTabs
        className="mb-3"
        value={String(days)}
        onChange={(k) => setDays(Number(k))}
        items={[1, 7, 30].map((d) => ({ key: String(d), label: `최근 ${d}일` }))}
      />

      {/* 전체 요약 */}
      <AdminSection title="요약" padding={false}>
        <StatRow label={`최근 ${days}일 실패`} value={`${totalCount}건`} tone={totalCount === 0 ? "sage" : "error"} />
        {totalCount > 0 && (
          <div className="flex gap-1.5 flex-wrap px-4 py-3">
            {Object.entries(providerBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([prov, cnt]) => (
                <UIChip
                  key={prov}
                  active={providerFilter === prov}
                  onClick={() => setProviderFilter(providerFilter === prov ? null : (prov === "unknown" ? null : prov))}
                >
                  {PROVIDER_LABEL[prov] ?? prov}
                  <span className="tabular-nums opacity-70">{cnt}</span>
                </UIChip>
              ))}
          </div>
        )}
      </AdminSection>

      {/* 에러 코드 TOP */}
      {stats.length > 0 && (
        <AdminSection
          title="에러 코드 TOP"
          padding={false}
          right={<span className="text-[11px] text-text-light">누르면 해당 코드만 필터</span>}
        >
          {stats.slice(0, 10).map((s, idx) => {
            const guide = explainAuthError(s.error_code, null, s.provider);
            const active = codeFilter === s.error_code;
            return (
              <button
                key={`${s.error_code}-${s.provider}`}
                type="button"
                onClick={() => setCodeFilter(active ? null : s.error_code)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0 press text-left"
                style={{ background: active ? "var(--color-surface-alt)" : undefined }}
              >
                <span className="w-4 text-[13px] font-semibold text-text-light tabular-nums shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-text-main truncate">{guide.title}</p>
                  <p className="text-[13px] text-text-light font-mono truncate mt-0.5">
                    {s.error_code} · {s.provider ?? "?"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--color-error)" }}>{s.count}</p>
                  <p className="text-[11px] text-text-light">{formatRelative(s.last_at)}</p>
                </div>
              </button>
            );
          })}
        </AdminSection>
      )}

      {/* 필터 표시 */}
      {(providerFilter || codeFilter) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter size={12} className="text-text-sub" />
          <span className="text-[13px] text-text-sub">필터:</span>
          {providerFilter && (
            <HairlineButton onClick={() => setProviderFilter(null)} icon={<X size={12} />}>
              provider: {providerFilter}
            </HairlineButton>
          )}
          {codeFilter && (
            <HairlineButton onClick={() => setCodeFilter(null)} icon={<X size={12} />}>
              code: {codeFilter}
            </HairlineButton>
          )}
        </div>
      )}

      {/* 로그 리스트 */}
      <AdminSection title={`최근 로그${logs.length > 0 ? ` (${logs.length})` : ""}`} padding={false}>
        {logs.length === 0 ? (
          <div className="py-10 text-center">
            <Shield size={28} className="mx-auto mb-2 text-text-light" strokeWidth={1.5} />
            <p className="text-[13px] font-semibold text-text-main">로그가 없어요</p>
            <p className="text-[13px] text-text-light mt-0.5">로그인 실패가 없거나, 아직 SQL 마이그레이션을 실행하지 않았어요.</p>
          </div>
        ) : (
          logs.map((log) => {
            const expanded = expandedId === log.id;
            const guide = explainAuthError(log.error_code, log.error_desc, log.provider);
            const sevColor =
              guide.severity === "danger" ? "var(--color-error)" :
              guide.severity === "warn" ? "var(--color-warning)" : "var(--color-text-light)";
            return (
              <div key={log.id} className="border-b border-divider last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="w-full flex items-start gap-2.5 px-4 py-3 text-left press"
                >
                  <AlertCircle size={14} className="mt-1 shrink-0" style={{ color: sevColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[15px] font-semibold text-text-main">{guide.title}</span>
                      {log.provider && <AdminTag>{log.provider}</AdminTag>}
                      <AdminTag>{log.stage}</AdminTag>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[13px] text-text-light">
                      <span className="font-mono">{log.error_code ?? "?"}</span>
                      <span>·</span>
                      <span>{shortUA(log.user_agent)}</span>
                      <span>·</span>
                      <span>{formatRelative(log.created_at)}</span>
                    </div>
                  </div>
                  {expanded ? (
                    <ChevronUp size={16} className="mt-1 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  ) : (
                    <ChevronDown size={16} className="mt-1 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  )}
                </button>

                {expanded && (
                  <div className="px-4 pb-3 pt-2 text-[13px] space-y-1.5" style={{ borderTop: "1px solid var(--color-divider)" }}>
                    <Field label="시각" value={formatAbs(log.created_at)} />
                    <Field label="에러 코드" value={log.error_code ?? "(없음)"} mono />
                    <Field label="설명" value={log.error_desc ?? "(없음)"} />
                    <Field label="User-Agent" value={log.user_agent ?? "(없음)"} mono small />
                    <Field label="URL" value={log.url ?? "(없음)"} mono small />
                    <Field label="Referrer" value={log.referrer ?? "(없음)"} mono small />
                    <div className="flex justify-end pt-1.5">
                      <HairlineButton tone="error" onClick={() => handleDeleteOne(log.id)} icon={<Trash2 size={12} />}>
                        이 로그 삭제
                      </HairlineButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </AdminSection>
    </AdminPage>
  );
}

function Field({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 w-[72px] text-text-light">{label}</span>
      <span className={`flex-1 min-w-0 break-all text-text-main ${mono ? "font-mono" : ""} ${small ? "text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
