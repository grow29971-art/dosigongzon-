"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Shield,
  AlertCircle,
  Filter,
  Trash2,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
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

export default function AdminAuthErrorsPage() {
  const router = useRouter();

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

  if (!authChecked || loading) {
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
        <p className="text-[12px] text-text-sub">접근 권한이 없어요.</p>
        <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  const totalCount = stats.reduce((s, x) => s + x.count, 0);
  const providerBreakdown = stats.reduce<Record<string, number>>((acc, s) => {
    const k = s.provider ?? "unknown";
    acc[k] = (acc[k] ?? 0) + s.count;
    return acc;
  }, {});

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-4">
        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3 active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          마이페이지
        </button>
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
            로그인 실패 로그
          </h1>
          <span className="text-[10px] font-semibold text-text-light">Admin · Auth Errors</span>
        </div>
        <p className="text-[12px] text-text-sub">
          OAuth/매직링크/비밀번호 로그인 실패 원인을 확인해요
        </p>
      </div>

      {/* 기간 + 새로고침 + 청소 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1.5 flex-1 overflow-x-auto scrollbar-hide">
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold active:scale-95 shrink-0"
              style={{
                backgroundColor: days === d ? "#2C2C2C" : "rgba(255,255,255,0.95)",
                color: days === d ? "#fff" : "#555",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              최근 {d}일
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="w-9 h-9 rounded-xl bg-white flex items-center justify-center active:scale-90 disabled:opacity-50"
          style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
          aria-label="새로고침"
        >
          {refreshing ? (
            <Loader2 size={14} className="animate-spin text-primary" />
          ) : (
            <RefreshCcw size={14} className="text-text-sub" />
          )}
        </button>
        <button
          type="button"
          onClick={handlePurge}
          className="w-9 h-9 rounded-xl bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
          aria-label="오래된 로그 삭제"
        >
          <Trash2 size={14} style={{ color: "#B84545" }} />
        </button>
      </div>

      {/* 전체 요약 */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: totalCount === 0
            ? "linear-gradient(135deg, rgba(107,142,111,0.10), rgba(107,142,111,0.04))"
            : "linear-gradient(135deg, rgba(216,85,85,0.10), rgba(184,69,69,0.04))",
          border: `1px solid ${totalCount === 0 ? "rgba(107,142,111,0.2)" : "rgba(216,85,85,0.2)"}`,
        }}
      >
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] font-bold" style={{ color: totalCount === 0 ? "#3F5B42" : "#8B2F2F" }}>
            최근 {days}일 실패
          </span>
          <span className="text-[24px] font-extrabold" style={{ color: totalCount === 0 ? "#3F5B42" : "#8B2F2F" }}>
            {totalCount}
            <span className="text-[12px] font-semibold ml-0.5">건</span>
          </span>
        </div>
        {totalCount > 0 && (
          <div className="flex gap-2 flex-wrap mt-2">
            {Object.entries(providerBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([prov, cnt]) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => setProviderFilter(providerFilter === prov ? null : (prov === "unknown" ? null : prov))}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg active:scale-95"
                  style={{
                    backgroundColor: providerFilter === prov ? "#B84545" : "rgba(255,255,255,0.7)",
                    color: providerFilter === prov ? "#fff" : "#8B2F2F",
                  }}
                >
                  {prov === "google" ? "🟦 구글" : prov === "kakao" ? "🟨 카카오" : prov === "magic_link" ? "✉️ 매직링크" : prov}
                  <span className="ml-1 opacity-70">{cnt}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* 에러 코드 TOP */}
      {stats.length > 0 && (
        <div
          className="rounded-2xl p-4 mb-3 bg-white"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={13} style={{ color: "#E88D5A" }} />
            <h2 className="text-[12.5px] font-extrabold text-text-main">
              에러 코드 TOP
            </h2>
            <span className="text-[10px] text-text-light">(클릭하면 해당 코드만 필터)</span>
          </div>
          <div className="space-y-1.5">
            {stats.slice(0, 10).map((s, idx) => {
              const guide = explainAuthError(s.error_code, null, s.provider);
              const active = codeFilter === s.error_code;
              return (
                <button
                  key={`${s.error_code}-${s.provider}`}
                  type="button"
                  onClick={() => setCodeFilter(active ? null : s.error_code)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl active:scale-[0.99] text-left"
                  style={{
                    backgroundColor: active ? "rgba(196,126,90,0.12)" : "#F7F4EE",
                    border: active ? "1px solid rgba(196,126,90,0.3)" : "1px solid transparent",
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold shrink-0"
                    style={{
                      backgroundColor: idx === 0 ? "#D85555" : idx === 1 ? "#E88D5A" : "#C9A961",
                      color: "#fff",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-extrabold text-text-main truncate">
                      {guide.title}
                    </p>
                    <p className="text-[10px] text-text-sub font-mono truncate mt-0.5">
                      {s.error_code} · {s.provider ?? "?"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-extrabold" style={{ color: "#B84545" }}>
                      {s.count}
                    </p>
                    <p className="text-[9px] text-text-light">
                      {formatRelative(s.last_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 필터 표시 */}
      {(providerFilter || codeFilter) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter size={12} className="text-text-sub" />
          <span className="text-[11px] text-text-sub">필터:</span>
          {providerFilter && (
            <button
              type="button"
              onClick={() => setProviderFilter(null)}
              className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
              style={{ backgroundColor: "#E8B84A", color: "#fff" }}
            >
              provider: {providerFilter} ×
            </button>
          )}
          {codeFilter && (
            <button
              type="button"
              onClick={() => setCodeFilter(null)}
              className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
              style={{ backgroundColor: "#E8B84A", color: "#fff" }}
            >
              code: {codeFilter} ×
            </button>
          )}
        </div>
      )}

      {/* 로그 리스트 */}
      <div className="flex items-center gap-2 mb-2 mt-4">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#8B65B8" }} />
        <h2 className="text-[13px] font-extrabold text-text-main">
          최근 로그 {logs.length > 0 && <span className="text-text-light font-bold">({logs.length})</span>}
        </h2>
      </div>

      {logs.length === 0 ? (
        <div
          className="rounded-2xl py-8 text-center bg-white"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
        >
          <Shield size={28} className="mx-auto mb-2 text-text-light" strokeWidth={1.5} />
          <p className="text-[12.5px] font-bold text-text-main">로그가 없어요</p>
          <p className="text-[11px] text-text-sub mt-0.5">로그인 실패가 없거나, 아직 SQL 마이그레이션을 실행하지 않았어요.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const expanded = expandedId === log.id;
            const guide = explainAuthError(log.error_code, log.error_desc, log.provider);
            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.04)" }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left active:bg-gray-50"
                >
                  <AlertCircle
                    size={14}
                    className="mt-0.5 shrink-0"
                    style={{
                      color:
                        guide.severity === "danger" ? "#B84545" :
                        guide.severity === "warn" ? "#B07A1C" : "#3A6CB5",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11.5px] font-extrabold text-text-main">
                        {guide.title}
                      </span>
                      {log.provider && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: log.provider === "google" ? "#E3EBF7" : log.provider === "kakao" ? "#FEF4C8" : "#F0EDF7",
                            color: log.provider === "google" ? "#3A6CB5" : log.provider === "kakao" ? "#7A5F16" : "#5D4785",
                          }}
                        >
                          {log.provider}
                        </span>
                      )}
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: "#F0F0F0", color: "#666" }}
                      >
                        {log.stage}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-text-light">
                      <span className="font-mono">{log.error_code ?? "?"}</span>
                      <span>·</span>
                      <span>{shortUA(log.user_agent)}</span>
                      <span>·</span>
                      <span>{formatRelative(log.created_at)}</span>
                    </div>
                  </div>
                  {expanded ? (
                    <ChevronUp size={14} className="text-text-sub mt-1 shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-text-sub mt-1 shrink-0" />
                  )}
                </button>

                {expanded && (
                  <div
                    className="px-3 pb-3 pt-1 text-[11px] space-y-1.5"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}
                  >
                    <Field label="시각" value={formatAbs(log.created_at)} />
                    <Field label="에러 코드" value={log.error_code ?? "(없음)"} mono />
                    <Field label="설명" value={log.error_desc ?? "(없음)"} />
                    <Field label="User-Agent" value={log.user_agent ?? "(없음)"} mono small />
                    <Field label="URL" value={log.url ?? "(없음)"} mono small />
                    <Field label="Referrer" value={log.referrer ?? "(없음)"} mono small />
                    <div className="flex justify-end pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(log.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold active:scale-95"
                        style={{ backgroundColor: "#FBEAEA", color: "#B84545" }}
                      >
                        <Trash2 size={10} />
                        이 로그 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 w-[72px] text-text-sub font-bold">{label}</span>
      <span
        className={`flex-1 min-w-0 break-all ${mono ? "font-mono" : ""} ${small ? "text-[10px]" : ""}`}
        style={{ color: "#333" }}
      >
        {value}
      </span>
    </div>
  );
}
