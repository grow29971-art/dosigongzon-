// 브라우저에서 현재 페이지의 og:image 절대 URL을 읽는다(카카오 공유 미리보기용).
//
// 배경(2026-09-16): app/(main)/ 아래 라우트에서 손으로 조립한 `/cats/{id}/opengraph-image` 같은
// 주소는 404다. Next 파일 컨벤션(opengraph-image.tsx)이 <head>에 주입하는 해시 주소
// (`/…/opengraph-image-xxxx?hash`)만 200이므로, 클라이언트는 주소를 조립하지 말고
// 페이지 <meta property="og:image">를 그대로 읽는다. 메타가 없으면 fallback(루트 정적 OG 등).

export function getPageOgImageUrl(fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const content = document
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content")
    ?.trim();
  if (!content) return fallback;
  // 상대 경로가 들어와도 절대 URL로 정규화(카카오 SDK는 절대 URL만 받는다)
  try {
    return new URL(content, window.location.origin).toString();
  } catch {
    return fallback;
  }
}
