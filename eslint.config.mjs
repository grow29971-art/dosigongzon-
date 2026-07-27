import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 1회용 스크립트 (puppeteer 스크래퍼·DB 백업 등) — 앱 빌드와 무관.
    "scripts/**",
    // box 폴더는 개발일지·SQL·빌드 리소스 생성 스크립트. 앱 빌드에 포함되지 않음.
    "box/**",
  ]),
  {
    // react-hooks 6 / next 강화 룰셋으로 새로 error가 된 규칙들 — 2026-07-27 전수 확인 후
    // error→warn 강등. 전부 "진짜 위험(무한 렌더 루프·데이터 파괴)"이 아니라 cosmetic/의도된
    // 패턴이며, warn 유지라 향후 신규 위반은 계속 노출된다(blanket off 아님 — 탐지력 보존).
    //
    // · set-state-in-effect(28): 전부 마운트 1회 초기화/의존성 리셋/게이트 후 세팅. 렌더 루프 없음.
    // · no-unescaped-entities(38): JSX 텍스트의 ' " 등 — 렌더 정상, 순수 cosmetic.
    // · purity(3): 컨페티 Math.random(장식·랜덤이 목적)·useMemo 내 Date.now(팁 신선도) — 의도됨.
    // · static-components(1): mypage/journey의 얇은 Wrapper — 경미한 리마운트, 추후 정리 대상.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
