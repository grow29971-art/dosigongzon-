// Vercel CLI 한글 호스트명 우회 패치 (2026-08-04)
//
// 증상: PC 호스트명이 한글(김성우)이라 저장된 토큰으로 CLI를 쓰면
//   TypeError: Cannot convert argument to a ByteString ... value of 44608 ('김')
// 원인: CLI가 OAuth 토큰 갱신 요청에 os.hostname()을 헤더로 실어 보낸다.
//       HTTP 헤더는 ByteString(0~255)만 허용 → 비ASCII 호스트명에서 죽는다.
//
// 사용법 (PowerShell):
//   $env:NODE_OPTIONS = "--require C:/Users/grow2/city/box/vercel-hostpatch.cjs"
//   npx vercel inspect <deploymentId> --logs
//   npx vercel env ls
//
// 사용법 (bash):
//   NODE_OPTIONS="--require C:/Users/grow2/city/box/vercel-hostpatch.cjs" npx vercel whoami
//
// 근본 해결: PC 이름을 ASCII로 변경(설정 > 시스템 > 정보 > 이 PC의 이름 바꾸기) 후 재부팅.
const os = require("os");
os.hostname = () => "localhost";
