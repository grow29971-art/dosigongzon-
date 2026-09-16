// 하단 네비게이션 전용 아이콘 세트(보존용 — 현재 BottomNav는 lucide 모노크롬을 쓴다).
// 2026-09-16 「익숙한 동네앱」 리디자인: 하드코딩 hex(남색 테두리·파스텔 채움)를 전부 걷어내고
// 선은 currentColor, 면은 토큰(surface·gray·primary)만 쓴다. 형태(패스)는 그대로.
// 전부 24x24 viewBox, 같은 두께의 outline을 공유해 하나의 세트처럼 보이게 함.

const STROKE = "currentColor";
const SW = 1.4;
const FILL = "var(--color-surface)";
const FILL_ALT = "var(--color-gray-100)";
const FILL_DEEP = "var(--color-gray-200)";
const ACCENT = "var(--color-primary)";

export function NavHomeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5 12 4l8 7.5" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" fill={FILL_ALT} />
      <path d="M5.5 10.5V19a1 1 0 0 0 1 1H9.5v-4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3a1 1 0 0 0 1-1v-8.5"
        stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" fill={FILL} />
      <path d="M4 11.5 12 4l8 7.5" stroke={ACCENT} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function NavMapIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 6.2 9 4.5l6 1.7 5-1.7v13.3l-5 1.7-6-1.7-5 1.7Z" fill={FILL_ALT} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M9 4.5v13.3M15 6.2v13.3" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M4 6.2 9 4.5v13.3l-5 1.7Z" fill={FILL_DEEP} />
      <path d="M15 6.2 20 4.5v13.3l-5 1.7Z" fill={FILL_DEEP} />
      <g>
        <path d="M12.5 3.2c-1.5 0-2.7 1.2-2.7 2.7 0 1.9 2.7 4.6 2.7 4.6s2.7-2.7 2.7-4.6c0-1.5-1.2-2.7-2.7-2.7Z"
          fill={ACCENT} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
        <circle cx="12.5" cy="5.9" r="1" fill={FILL} />
      </g>
    </svg>
  );
}

export function NavGuideIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v13a1 1 0 0 1-1 1h-10a1.5 1.5 0 0 1-1.5-1.5Z"
        fill={FILL_DEEP} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M5.5 4.5A1.5 1.5 0 0 0 4 6v12.5A1.5 1.5 0 0 0 5.5 20" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" fill="none" />
      <rect x="5.2" y="18.3" width="2.2" height="2" rx="0.5" fill={ACCENT} stroke={STROKE} strokeWidth={1} />
      <circle cx="12" cy="9.3" r="3.1" fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <circle cx="12" cy="7.9" r="0.55" fill={STROKE} />
      <rect x="11.4" y="9" width="1.2" height="2.4" rx="0.5" fill={STROKE} />
    </svg>
  );
}

export function NavAiButlerIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5 3.5 8l2.5 2-2 2.3L6.5 15" stroke={ACCENT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="7" y="3.5" width="10" height="17" rx="2.2" fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <rect x="8.6" y="6" width="6.8" height="9.4" rx="1.2" fill={FILL_DEEP} />
      <path d="M10.4 9.6c0-1.1.9-2 2-2h.4c.6 0 1.1.3 1.4.8" stroke={STROKE} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <circle cx="12" cy="10.9" r="1.5" fill={FILL} stroke={STROKE} strokeWidth={1} />
      <path d="M11.3 10.6q0.4-0.5 0.7 0M12.3 10.6q0.4-0.5 0.7 0" stroke={STROKE} strokeWidth={0.9} strokeLinecap="round" />
      <circle cx="12" cy="18.1" r="0.7" fill={STROKE} opacity={0.5} />
    </svg>
  );
}

export function NavCommunityIcon({ size = 24 }: { size?: number }) {
  const person = (cx: number, cy: number, r: number) => (
    <g>
      <circle cx={cx} cy={cy - r * 0.6} r={r * 0.55} fill={FILL_ALT} stroke={STROKE} strokeWidth={1} />
      <path d={`M${cx - r} ${cy + r} a${r} ${r} 0 0 1 ${r * 2} 0Z`} fill={FILL_ALT} stroke={STROKE} strokeWidth={1} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="12" x2="5" y2="6.5" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <line x1="12" y1="12" x2="19" y2="6.5" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <line x1="12" y1="12" x2="5" y2="18" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <line x1="12" y1="12" x2="19" y2="18" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <circle cx="12" cy="12" r="3.4" fill={FILL_ALT} stroke={STROKE} strokeWidth={SW} />
      <path d="M8.9 12h6.2M12 8.9v6.2M9.8 9.8l4.4 4.4M14.2 9.8l-4.4 4.4" stroke={ACCENT} strokeWidth={0.7} opacity={0.7} />
      {person(4.6, 6.2, 1.7)}
      {person(19.4, 6.2, 1.7)}
      {person(4.6, 18.4, 1.7)}
      {person(19.4, 18.4, 1.7)}
    </svg>
  );
}

export function NavCardGameIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="8.2" y="4" width="9.5" height="13" rx="1.8" transform="rotate(11 8.2 4)"
        fill={FILL_DEEP} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <rect x="5.3" y="3.8" width="9.5" height="13.5" rx="1.8"
        fill={FILL_ALT} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx="10" cy="10.5" r="2.5" fill={FILL} stroke={STROKE} strokeWidth={1.1} />
      <path d="M7.5 10.5h5" stroke={STROKE} strokeWidth={1.1} />
      <circle cx="10" cy="10.5" r="0.8" fill={ACCENT} stroke={STROKE} strokeWidth={0.8} />
      <path d="M18.3 3.3l0.5 1.3 1.3 0.5-1.3 0.5-0.5 1.3-0.5-1.3-1.3-0.5 1.3-0.5Z" fill={FILL_ALT} stroke={STROKE} strokeWidth={0.6} />
    </svg>
  );
}

export function NavStoreIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 8.2h10l1 11a1.6 1.6 0 0 1-1.6 1.8H7.6A1.6 1.6 0 0 1 6 19.2Z"
        fill={FILL_ALT} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M8.5 8.2V6.6a3.5 3.5 0 0 1 7 0v1.6" stroke={STROKE} strokeWidth={SW} strokeLinecap="round" fill="none" />
      <path d="M8.5 8.2V6.6a3.5 3.5 0 0 1 7 0v1.6" stroke={ACCENT} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.55} />
      <circle cx="9.3" cy="11.2" r="0.9" fill={FILL} stroke={STROKE} strokeWidth={0.9} />
      <circle cx="14.7" cy="11.2" r="0.9" fill={FILL} stroke={STROKE} strokeWidth={0.9} />
      <path d="M15.6 4.3l0.4 1 1 0.4-1 0.4-0.4 1-0.4-1-1-0.4 1-0.4Z" fill={FILL_DEEP} stroke={STROKE} strokeWidth={0.5} />
    </svg>
  );
}

export function NavMyIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill={FILL_DEEP} stroke={STROKE} strokeWidth={SW} />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke={FILL} strokeWidth={1} opacity={0.35} />
      <circle cx="12" cy="10" r="3" fill={FILL} />
      <path d="M6.2 18.5c0.6-3 2.9-4.6 5.8-4.6s5.2 1.6 5.8 4.6" fill={FILL} />
    </svg>
  );
}
