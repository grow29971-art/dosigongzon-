// 시빅 포스터(대안 C) — 하드코딩 웜 뉴트럴/테라코타 hex 일괄 잉크·뉴트럴 전환 (2026-09-16)
// warm-swap 패턴: 색→색 리터럴 치환이라 style·SVG·canvas·OG 이미지 어디서든 안전.
// 알파 접미사 결합(#B05C3615 등)도 앞 6자리만 바뀌어 그대로 동작한다.
// 대상: app/·lib/ 의 .ts/.tsx (globals.css는 별도 커밋에서 수동 교체). 롤백은 이 커밋 revert.
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const MAP = [
  // 테라코타 계열 → 잉크
  ["#B05C36", "#111111"], ["#C97C52", "#333333"], ["#8A4325", "#000000"],
  // 웜 뉴트럴 → 뉴트럴 (globals.css 새 스케일과 동일 값)
  ["#FAF6F0", "#FFFFFF"], ["#FFFDF9", "#FFFFFF"], ["#F3EEE5", "#F2F2F2"],
  ["#E9E2D8", "#E0E0E0"], ["#F0EAE0", "#EBEBEB"], ["#D8CFC1", "#CFCFCF"],
  ["#C0B7A9", "#B5B5B5"], ["#A39A8D", "#8A8A8A"], ["#857C6E", "#6B6B6B"],
  ["#5D564B", "#555555"], ["#3A342B", "#2A2A2A"], ["#211D17", "#111111"],
  // rgba 형태 (r,g,b 프리픽스만 — 알파는 보존)
  ["rgba(176,92,54", "rgba(17,17,17"], ["rgba(176, 92, 54", "rgba(17, 17, 17"],
  ["rgba(250,246,240", "rgba(255,255,255"], ["rgba(250, 246, 240", "rgba(255, 255, 255"],
  ["rgba(33,29,23", "rgba(17,17,17"], ["rgba(33, 29, 23", "rgba(17, 17, 17"],
  ["rgba(93,86,75", "rgba(85,85,85"], ["rgba(93, 86, 75", "rgba(85, 85, 85"],
  ["rgba(163,154,141", "rgba(138,138,138"], ["rgba(163, 154, 141", "rgba(138, 138, 138"],
  ["rgba(233,226,216", "rgba(224,224,224"], ["rgba(233, 226, 216", "rgba(224, 224, 224"],
  ["rgba(243,238,229", "rgba(242,242,242"], ["rgba(243, 238, 229", "rgba(242, 242, 242"],
  // ── 2차 (같은 날 배포 후 실측): 토큰 밖에 남아 있던 구 웜 팔레트 잔재 ──
  // 배경/서피스 계열 아이보리·베이지 → 순백/뉴트럴 그레이
  ["#F7F4EE", "#FFFFFF"], ["#FBF8F3", "#FFFFFF"], ["#FCFAF6", "#FFFFFF"],
  ["#F5F3EE", "#F7F7F7"], ["#F6EFE3", "#F2F2F2"], ["#F2EBE0", "#EBEBEB"],
  ["#F1ECE4", "#EBEBEB"], ["#E5E0D6", "#E0E0E0"],
  // 피치/크림 틴트(아이콘 박스·강조 배경) → 뉴트럴 틴트
  ["#FFF8F2", "#F2F2F2"], ["#FFF6E8", "#F2F2F2"], ["#FFF9F2", "#F2F2F2"],
  ["#FFF1E6", "#F2F2F2"], ["#FFF3EC", "#F2F2F2"], ["#F4E6CE", "#EBEBEB"],
  ["#F5DAB0", "#E0E0E0"], ["#FFE8C2", "#EBEBEB"], ["#FFCFB5", "#E0E0E0"],
  // 웜 브라운 텍스트/잉크 → 뉴트럴 스케일
  ["#A38E7A", "#8A8A8A"], ["#8B7562", "#6B6B6B"], ["#8B5A3C", "#555555"],
  ["#6B5043", "#555555"], ["#3D2F25", "#2A2A2A"], ["#2A2A28", "#2A2A2A"],
  ["#2C2C2C", "#2A2A2A"], ["#191919", "#111111"],
  // ── 3차: 장식용 카테고리 무지개(보호지침·AI집사·가이드 아이콘 박스) → 잉크/그레이 ──
  // 의미색은 제외: 빨강(#D85555·#B84545 위험/학대), 밝은 초록(#22B573·#2E7D32·#5BA876 성공),
  // 카카오 노랑, 네이버 초록(#03C75A), 관리자 인디고(#6366F1).
  // 지도 마커 slot 구분(#111111 vs #4A7BA8)은 블루→그레이로 옮겨 대비를 유지한다.
  ["#4A7BA8", "#6B6B6B"], ["#5A8AC4", "#6B6B6B"], ["#6B8DAE", "#6B6B6B"],
  ["#48A59E", "#111111"], ["#8B65B8", "#111111"], ["#8B6FB8", "#111111"],
  ["#7A6B8E", "#2A2A2A"], ["#3A2C4D", "#2A2A2A"], ["#D4708F", "#111111"],
  ["#E88D5A", "#111111"], ["#F0762B", "#111111"], ["#E8B040", "#555555"],
  ["#C9A961", "#555555"], ["#6B8E6F", "#555555"], ["#8BA86B", "#6B6B6B"],
  ["#4F6B53", "#2A2A2A"], ["#3F5B42", "#2A2A2A"],
  // AI집사 초록 브랜딩(구 sage #22A366) → 잉크. 성공 의미색은 --color-sage 토큰이 담당.
  ["#22A366", "#111111"], ["#1B7D50", "#000000"], ["#DBEEDD", "#E0E0E0"],
  ["#E8F4E8", "#F2F2F2"], ["#D5EDD5", "#E0E0E0"], ["#FCEFD9", "#E0E0E0"],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      yield* walk(p);
    } else if (/\.(tsx|ts)$/.test(name)) {
      yield p;
    }
  }
}

let filesChanged = 0, total = 0;
for (const root of ["app", "lib"]) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    let out = src;
    let n = 0;
    for (const [from, to] of MAP) {
      const variants = from.startsWith("#") ? [from, from.toLowerCase()] : [from];
      for (const v of variants) {
        const parts = out.split(v);
        n += parts.length - 1;
        out = parts.join(to);
      }
    }
    if (out !== src) {
      writeFileSync(file, out, "utf8");
      filesChanged++;
      total += n;
    }
  }
}
console.log(`done: ${filesChanged} files, ${total} replacements`);
