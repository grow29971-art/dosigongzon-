// 냥숏츠(/shorts) 폐지 후 잔존 크롤 정리 — Search Console 404 239건 중 ~200건이 이 경로(2026-09-20 실측).
// 404는 구글이 "언젠가 돌아올 수도"로 보고 계속 재크롤하지만, 410 Gone 은 즉시 색인에서 제거한다.
// 기능 부활 시 이 파일을 지우면 된다.
export function GET() {
  return new Response("이 페이지는 사라졌어요.", { status: 410, headers: { "content-type": "text/plain; charset=utf-8" } });
}
