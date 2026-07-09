// 하단 네비게이션 전용 "스티커 스타일" 아이콘 세트.
// 사용자가 제공한 참고 스크린샷(흰색/파스텔 채우기 + 굵은 남색 테두리의 컬러풀한
// 플랫 아이콘) 스타일을 SVG로 재현. 원본 아이콘 파일이 없어서 직접 벡터로 제작.
// 전부 24x24 viewBox, 같은 두께의 outline(#1B3A5C)을 공유해 하나의 세트처럼 보이게 함.

const STROKE = "#1B3A5C";
const SW = 1.4;

export function NavHomeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5 12 4l8 7.5" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" fill="#FFF6E8" />
      <path d="M5.5 10.5V19a1 1 0 0 0 1 1H9.5v-4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3a1 1 0 0 0 1-1v-8.5"
        stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" fill="#FFFDF8" />
      <path d="M4 11.5 12 4l8 7.5" stroke="#E14B3C" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function NavMapIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 6.2 9 4.5l6 1.7 5-1.7v13.3l-5 1.7-6-1.7-5 1.7Z" fill="#EAF6E0" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M9 4.5v13.3M15 6.2v13.3" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M4 6.2 9 4.5v13.3l-5 1.7Z" fill="#BFE6A8" />
      <path d="M15 6.2 20 4.5v13.3l-5 1.7Z" fill="#8FCBEA" />
      <g>
        <path d="M12.5 3.2c-1.5 0-2.7 1.2-2.7 2.7 0 1.9 2.7 4.6 2.7 4.6s2.7-2.7 2.7-4.6c0-1.5-1.2-2.7-2.7-2.7Z"
          fill="#E14B3C" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
        <circle cx="12.5" cy="5.9" r="1" fill="#fff" />
      </g>
    </svg>
  );
}

export function NavGuideIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v13a1 1 0 0 1-1 1h-10a1.5 1.5 0 0 1-1.5-1.5Z"
        fill="#7C6FD8" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M5.5 4.5A1.5 1.5 0 0 0 4 6v12.5A1.5 1.5 0 0 0 5.5 20" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" fill="none" />
      <rect x="5.2" y="18.3" width="2.2" height="2" rx="0.5" fill="#E14B3C" stroke={STROKE} strokeWidth={1} />
      <circle cx="12" cy="9.3" r="3.1" fill="#fff" stroke={STROKE} strokeWidth={SW} />
      <circle cx="12" cy="7.9" r="0.55" fill="#7C6FD8" />
      <rect x="11.4" y="9" width="1.2" height="2.4" rx="0.5" fill="#7C6FD8" />
    </svg>
  );
}

export function NavAiButlerIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5 3.5 8l2.5 2-2 2.3L6.5 15" stroke="#5C9BEE" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="7" y="3.5" width="10" height="17" rx="2.2" fill="#FFFDF8" stroke={STROKE} strokeWidth={SW} />
      <rect x="8.6" y="6" width="6.8" height="9.4" rx="1.2" fill="#F4A03C" />
      <path d="M10.4 9.6c0-1.1.9-2 2-2h.4c.6 0 1.1.3 1.4.8" stroke={STROKE} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <circle cx="12" cy="10.9" r="1.5" fill="#fff" stroke={STROKE} strokeWidth={1} />
      <path d="M11.3 10.6q0.4-0.5 0.7 0M12.3 10.6q0.4-0.5 0.7 0" stroke={STROKE} strokeWidth={0.9} strokeLinecap="round" />
      <circle cx="12" cy="18.1" r="0.7" fill={STROKE} opacity={0.5} />
    </svg>
  );
}

export function NavCommunityIcon({ size = 24 }: { size?: number }) {
  const person = (cx: number, cy: number, r: number) => (
    <g>
      <circle cx={cx} cy={cy - r * 0.6} r={r * 0.55} fill="#DCEBFB" stroke={STROKE} strokeWidth={1} />
      <path d={`M${cx - r} ${cy + r} a${r} ${r} 0 0 1 ${r * 2} 0Z`} fill="#DCEBFB" stroke={STROKE} strokeWidth={1} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="12" x2="5" y2="6.5" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <line x1="12" y1="12" x2="19" y2="6.5" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <line x1="12" y1="12" x2="5" y2="18" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <line x1="12" y1="12" x2="19" y2="18" stroke={STROKE} strokeWidth={1} opacity={0.55} />
      <circle cx="12" cy="12" r="3.4" fill="#EAF3FC" stroke={STROKE} strokeWidth={SW} />
      <path d="M8.9 12h6.2M12 8.9v6.2M9.8 9.8l4.4 4.4M14.2 9.8l-4.4 4.4" stroke="#5C9BEE" strokeWidth={0.7} opacity={0.7} />
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
        fill="#E8935A" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <rect x="5.3" y="3.8" width="9.5" height="13.5" rx="1.8"
        fill="#F6C94A" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx="10" cy="10.5" r="2.5" fill="#fff" stroke={STROKE} strokeWidth={1.1} />
      <path d="M7.5 10.5h5" stroke={STROKE} strokeWidth={1.1} />
      <circle cx="10" cy="10.5" r="0.8" fill="#E8935A" stroke={STROKE} strokeWidth={0.8} />
      <path d="M18.3 3.3l0.5 1.3 1.3 0.5-1.3 0.5-0.5 1.3-0.5-1.3-1.3-0.5 1.3-0.5Z" fill="#FFE9A8" stroke={STROKE} strokeWidth={0.6} />
    </svg>
  );
}

export function NavStoreIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 8.2h10l1 11a1.6 1.6 0 0 1-1.6 1.8H7.6A1.6 1.6 0 0 1 6 19.2Z"
        fill="#FCE7B8" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M8.5 8.2V6.6a3.5 3.5 0 0 1 7 0v1.6" stroke={STROKE} strokeWidth={SW} strokeLinecap="round" fill="none" />
      <path d="M8.5 8.2V6.6a3.5 3.5 0 0 1 7 0v1.6" stroke="#E8935A" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.55} />
      <circle cx="9.3" cy="11.2" r="0.9" fill="#fff" stroke={STROKE} strokeWidth={0.9} />
      <circle cx="14.7" cy="11.2" r="0.9" fill="#fff" stroke={STROKE} strokeWidth={0.9} />
      <path d="M15.6 4.3l0.4 1 1 0.4-1 0.4-0.4 1-0.4-1-1-0.4 1-0.4Z" fill="#8FCBEA" stroke={STROKE} strokeWidth={0.5} />
    </svg>
  );
}

export function NavMyIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#5C93D8" stroke={STROKE} strokeWidth={SW} />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="#fff" strokeWidth={1} opacity={0.35} />
      <circle cx="12" cy="10" r="3" fill="#EAF3FC" />
      <path d="M6.2 18.5c0.6-3 2.9-4.6 5.8-4.6s5.2 1.6 5.8 4.6" fill="#EAF3FC" />
    </svg>
  );
}
