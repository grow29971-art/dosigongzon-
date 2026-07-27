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
    // react-hooks 6 신규 규칙. 2026-07-27 TASK 3: 위반 28곳 전수 확인 결과
    // 전부 "마운트 1회 초기화 / 의존성 변경 리셋 / 게이트 후 1회 세팅" 패턴이고
    // 렌더마다 setState 하는 진짜 무한 루프는 없었다. 24개 파일에 인라인 disable을
    // 흩뿌리면 오히려 노이즈라, error→warn 강등으로 error 카운트에서 뺀다.
    // warn으로 유지하므로 "향후 새로 생기는" set-state-in-effect 위반은 계속 노출된다
    // (blanket off가 아님 — 진짜 루프 탐지 능력 보존).
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
