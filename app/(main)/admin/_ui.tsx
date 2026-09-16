"use client";

// 관리자 화면군 공용 부품 (2026-09-16 「익숙한 동네앱」 리디자인, 리디자인 13/N)
// 당근·토스 문법: 흰 면 + 1px 헤어라인 섹션, 구분선 리스트, 라벨 좌·숫자 우(tabular) 수치 행,
// 회색 태그(의미색은 오류·거절=error / 대기=warning / 완료=sage 만), 헤어라인 버튼.
// 색은 토큰만 — hex 리터럴 금지. 그림자·그라디언트·틴트 아이콘 박스 없음.
// 관리 기능·권한 체크는 여기 두지 않는다(페이지의 isCurrentUserAdmin 흐름 무변경).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type Tone = "neutral" | "error" | "warning" | "sage" | "primary" | "like" | "care";

const TONE_COLOR: Record<Tone, string> = {
  neutral: "var(--color-text-sub)",
  error: "var(--color-error)",
  warning: "var(--color-warning)",
  sage: "var(--color-sage)",
  primary: "var(--color-primary)",
  like: "var(--color-like)",
  care: "var(--color-care)",
};

const TONE_SOFT: Record<Tone, string> = {
  neutral: "var(--color-surface-alt)",
  error: "var(--color-error-soft)",
  warning: "var(--color-warning-soft)",
  sage: "var(--color-sage-soft)",
  primary: "var(--color-primary-soft)",
  like: "var(--color-like-soft)",
  care: "var(--color-care-soft)",
};

export function toneColor(tone: Tone): string {
  return TONE_COLOR[tone];
}

/* ── 페이지 헤더: 뒤로가기 + 제목(24/700) + 한 줄 설명 ── */
export function AdminHeader({
  title,
  description,
  back = "/admin",
  backLabel = "관리자",
  right,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: string;
  backLabel?: string;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => router.push(back)}
        className="flex items-center gap-1 text-[13px] font-semibold text-text-sub mb-3 press-strong"
      >
        <ArrowLeft size={14} />
        {backLabel}
      </button>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[24px] font-bold text-text-main tracking-tight leading-tight">{title}</h1>
        {right}
      </div>
      {description && <p className="text-[13px] text-text-sub mt-1">{description}</p>}
    </div>
  );
}

/* ── 페이지 바탕: 흰 면, 하단 여백 ── */
export function AdminPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 pt-12 pb-24 min-h-dvh bg-surface max-w-2xl mx-auto ${className}`}>{children}</div>;
}

/* ── 로딩·권한 없음 ── */
export function AdminLoading() {
  return (
    <div className="flex justify-center pt-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );
}

export function AdminForbidden() {
  return (
    <div className="px-5 pt-20 text-center">
      <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
      <p className="text-[15px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
      <p className="text-[13px] text-text-sub">접근 권한이 없어요.</p>
      <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
        마이페이지로 돌아가기
      </Link>
    </div>
  );
}

/* ── 섹션: 흰 면 + 1px 헤어라인, 제목 행은 아래 구분선 ── */
export function AdminSection({
  title,
  right,
  children,
  padding = true,
  className = "",
  style,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  /** false면 본문 패딩 없음(구분선 리스트·표 넣을 때) */
  padding?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={`bg-surface mb-3 ${className}`}
      style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", ...style }}
    >
      {title !== undefined && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-divider">
          <h2 className="text-[15px] font-bold text-text-main">{title}</h2>
          {right}
        </div>
      )}
      <div className={padding ? "px-4 py-3" : ""}>{children}</div>
    </section>
  );
}

/* ── 수치 행: 라벨 좌 · 숫자 우(tabular). 섹션 안에서 구분선 리스트로 쌓는다 ── */
export function StatRow({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0">
      {icon !== undefined && <span className="shrink-0 text-text-light">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-text-main truncate">{label}</p>
        {sub !== undefined && <p className="text-[13px] text-text-light mt-0.5">{sub}</p>}
      </div>
      <span
        className="text-[17px] font-bold tabular-nums shrink-0"
        style={{ color: tone === "neutral" ? "var(--color-text-main)" : TONE_COLOR[tone] }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── 키·값 행(작은 글씨): 라벨 좌 · 값 우 ── */
export function KeyValueRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-text-light shrink-0">{label}</span>
      <span className="text-text-main text-right tabular-nums break-all">{value}</span>
    </div>
  );
}

/* ── 태그: 기본 회색, 의미색은 tone 으로만 ── */
export function AdminTag({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${className}`}
      style={{
        borderRadius: "var(--radius-square)",
        background: TONE_SOFT[tone],
        color: TONE_COLOR[tone],
      }}
    >
      {children}
    </span>
  );
}

/* ── 헤어라인 버튼: 흰 면 + 1px 테두리. tone 으로 글자색만 바꾼다 ── */
export function HairlineButton({
  tone = "neutral",
  size = "sm",
  icon,
  children,
  className = "",
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: "sm" | "md";
  icon?: ReactNode;
}) {
  const color = tone === "neutral" ? "var(--color-text-main)" : TONE_COLOR[tone];
  return (
    <button
      type="button"
      className={`press inline-flex items-center justify-center gap-1 font-semibold disabled:opacity-40 ${className}`}
      style={{
        height: size === "sm" ? 32 : 40,
        padding: size === "sm" ? "0 12px" : "0 16px",
        fontSize: size === "sm" ? 13 : 15,
        borderRadius: "var(--radius-input)",
        background: "var(--color-surface)",
        color,
        border: "1px solid var(--color-border)",
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ── 세그먼트 탭: gray-100 트랙 + 흰 활성 ── */
export function SegmentTabs<T extends string>({
  items,
  value,
  onChange,
  className = "",
}: {
  items: { key: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex p-1 gap-1 ${className}`}
      style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-square-lg)" }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className="flex-1 flex items-center justify-center gap-1 h-8 text-[13px] font-semibold press"
            style={{
              borderRadius: "var(--radius-square)",
              background: active ? "var(--color-surface)" : "transparent",
              color: active ? "var(--color-text-main)" : "var(--color-text-sub)",
              border: active ? "1px solid var(--color-border)" : "1px solid transparent",
            }}
          >
            {it.label}
            {it.count !== undefined && it.count > 0 && (
              <span className="text-[11px] tabular-nums text-text-light">{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── 빈 상태 ── */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-12 text-center text-[13px] text-text-light">{children}</p>;
}

/* ── 입력창 공통 클래스 ── */
export const inputCls =
  "w-full px-3 py-2.5 text-[15px] text-text-main bg-surface placeholder:text-text-muted outline-none focus:border-primary transition-colors disabled:opacity-50";
export const inputStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-input)",
};

/* ── 작은 라벨(필드 이름) ── */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-semibold text-text-sub mb-1.5">{children}</p>;
}
