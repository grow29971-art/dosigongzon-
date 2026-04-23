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
]);

export default eslintConfig;
