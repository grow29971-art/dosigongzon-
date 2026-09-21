// 앱인토스 미니앱(city-toss/) 실행 여부. 미니앱 main.tsx가 window 표식을 세운다.
// 앱인토스 심사 규칙상 미니앱에서 숨기는 것: 쇼핑(토스페이 외 결제 금지)·채팅/쪽지(채팅 필수 사항)·
// 웹푸시·본 앱 로그인 유도. 본 앱 동작은 바꾸지 않는다 — 이 함수가 false면 기존 그대로.
export function isMiniApp(): boolean {
  return typeof window !== "undefined" && (window as Window & { __DOSIGONGZON_MINIAPP__?: boolean }).__DOSIGONGZON_MINIAPP__ === true;
}

// 미니앱에서 통째로 숨길 컴포넌트를 감싼다(훅 순서 규칙을 지키기 위해 컴포넌트 밖에서 분기).
export function hideInMiniApp<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  const Hidden = (props: P) => (isMiniApp() ? null : <Component {...props} />);
  Hidden.displayName = `hideInMiniApp(${Component.displayName ?? Component.name ?? "Component"})`;
  return Hidden;
}
