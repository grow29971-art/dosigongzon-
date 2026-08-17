#!/usr/bin/env node
// PreToolUse(Bash) 훅 — 커맨드에 'git commit'이 포함되면 커밋 전 타입 체크를 돌린다.
// tsc 실패 시 exit 2 로 커밋을 차단(블로킹), 그 외에는 exit 0.
// (Claude Code에 'PreCommit' 이벤트는 없어 통째로 무시됐던 설정을 유효 훅으로 대체.
//  AGENTS.md의 "배포 전 npx tsc --noEmit 통과" 규칙을 커밋 시점에 자동 강제.)
import { spawnSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0); // 입력 파싱 실패 시 커밋을 막지 않는다 (fail-open)
  }
  if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);

  const r = spawnSync("npx", ["tsc", "--noEmit"], { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error("타입 체크 실패 — 커밋을 중단했어요. `npx tsc --noEmit` 오류를 고친 뒤 다시 커밋하세요.");
    process.exit(2); // 블로킹: 커밋 차단
  }
  process.exit(0);
});
