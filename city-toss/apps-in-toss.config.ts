import { defineConfig } from "@apps-in-toss/web-framework/config";

// 앱인토스 미니앱 설정 — appName은 콘솔에 등록한 값과 반드시 같아야 한다
// (deeplink intoss://dosigongzon, 호스팅 https://dosigongzon.web.tossmini.com).
// 위치 권한은 요청하지 않는다 — 본 앱과 동일한 위치정보 무의무 아키텍처(decisions/0001).
export default defineConfig({
  appName: "dosigongzon",
  brand: {
    primaryColor: "#AD5E3B",
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    theme: "light",
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
    allowsBackForwardNavigationGestures: true,
  },
  permissions: [],
  webBundleDir: "dist",
});
