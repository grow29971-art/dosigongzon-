// 픽셀 게임풍 UI에서 공용으로 쓰는 clip-path/텍스트 아웃라인 헬퍼.
// CatCard(카드 화면)와 배틀 페이지가 같은 톤을 쓰도록 여기서 공유한다.

// 계단 노치 모서리 — 둥근 모서리 대신 NES 창틀식 컷.
export function notchClip(step: number): string {
  const s = step;
  return `polygon(
    0 ${s * 3}px, ${s}px ${s * 3}px, ${s}px ${s * 2}px, ${s * 2}px ${s * 2}px, ${s * 2}px ${s}px, ${s * 3}px ${s}px, ${s * 3}px 0,
    calc(100% - ${s * 3}px) 0, calc(100% - ${s * 3}px) ${s}px, calc(100% - ${s * 2}px) ${s}px, calc(100% - ${s * 2}px) ${s * 2}px, calc(100% - ${s}px) ${s * 2}px, calc(100% - ${s}px) ${s * 3}px, 100% ${s * 3}px,
    100% calc(100% - ${s * 3}px), calc(100% - ${s}px) calc(100% - ${s * 3}px), calc(100% - ${s}px) calc(100% - ${s * 2}px), calc(100% - ${s * 2}px) calc(100% - ${s * 2}px), calc(100% - ${s * 2}px) calc(100% - ${s}px), calc(100% - ${s * 3}px) calc(100% - ${s}px), calc(100% - ${s * 3}px) 100%,
    ${s * 3}px 100%, ${s * 3}px calc(100% - ${s}px), ${s * 2}px calc(100% - ${s}px), ${s * 2}px calc(100% - ${s * 2}px), ${s}px calc(100% - ${s * 2}px), ${s}px calc(100% - ${s * 3}px), 0 calc(100% - ${s * 3}px)
  )`;
}

// 픽셀 텍스트용 하드 아웃라인 — 부드러운 blur 대신 8방향 오프셋 그림자로 두꺼운 외곽선.
export function pixelOutline(color: string, w = 2): string {
  const pts = [[-w, 0], [w, 0], [0, -w], [0, w], [-w, -w], [w, -w], [-w, w], [w, w]];
  return pts.map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(", ");
}
