// 카카오맵 JS SDK 로더 — 본 앱 map/page.tsx의 스크립트 주입과 동일 방식.
// tossmini.com 도메인 2종(web·private-web)이 카카오 개발자 콘솔 Web 플랫폼에 등록돼 있어야 동작한다.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { kakao: any }
}

let loading: Promise<any> | null = null;

export function loadKakao(): Promise<any> {
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao);
  if (loading) return loading;
  const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
  if (!key) return Promise.reject(new Error("VITE_KAKAO_JS_KEY가 없어요."));
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=clusterer`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    s.onerror = () => { loading = null; reject(new Error("지도를 불러오지 못했어요.")); };
    document.head.appendChild(s);
  });
  return loading;
}
