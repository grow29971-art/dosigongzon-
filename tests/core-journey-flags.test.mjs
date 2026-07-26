// ══════════════════════════════════════════
// core-journey-flags fail-closed 계약 테스트
// 실행: npm run test:flags  (Node 내장 test runner, 별도 러너 불필요)
// ══════════════════════════════════════════

import { beforeEach, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CORE_JOURNEY_STAGES,
  CORE_JOURNEY_FLAG_ENV_NAMES,
  KILL_SWITCH_ENV_NAME,
  KILL_SWITCH_PUBLIC_ENV_NAME,
  parseFlagValue,
  parseKillSwitchValue,
  isKillSwitchOn,
  isCoreJourneyEnabled,
} from "../lib/core-journey-flags.ts";

const ALL_ENV_NAMES = [
  ...Object.values(CORE_JOURNEY_FLAG_ENV_NAMES),
  KILL_SWITCH_ENV_NAME,
  KILL_SWITCH_PUBLIC_ENV_NAME,
];

// 테스트 간 오염 방지: 관련 환경변수를 백업 후 완전 초기화, 종료 시 복원.
let saved;

beforeEach(() => {
  saved = {};
  for (const name of ALL_ENV_NAMES) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ALL_ENV_NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("parseFlagValue — 명시적 on만 true", () => {
  it("on 값: '1' / 'true' / 'on' (공백·대소문자 무시)", () => {
    for (const raw of ["1", "true", "on", " TRUE ", "On", "  1  "]) {
      assert.equal(parseFlagValue(raw), true, `raw=${JSON.stringify(raw)}`);
    }
  });

  it("그 외 전부 false (fail-closed)", () => {
    for (const raw of [undefined, null, "", "0", "false", "off", "yes", "enabled", "ture", "켜짐"]) {
      assert.equal(parseFlagValue(raw), false, `raw=${JSON.stringify(raw)}`);
    }
  });
});

describe("parseKillSwitchValue — 애매하면 차단", () => {
  it("비활성: 미설정·명시적 off만", () => {
    for (const raw of [undefined, null, "", "0", "false", "off", " OFF ", "False"]) {
      assert.equal(parseKillSwitchValue(raw), false, `raw=${JSON.stringify(raw)}`);
    }
  });

  it("활성: on 값은 물론 오타·해석 불가 값도 차단으로 간주", () => {
    for (const raw of ["1", "true", "on", "ture", "kill", "차단", " 1 "]) {
      assert.equal(parseKillSwitchValue(raw), true, `raw=${JSON.stringify(raw)}`);
    }
  });
});

describe("isCoreJourneyEnabled — 기본 off / 개별 on / kill switch 우선", () => {
  it("아무것도 설정 안 하면 모든 스테이지 false", () => {
    for (const stage of CORE_JOURNEY_STAGES) {
      assert.equal(isCoreJourneyEnabled(stage), false, stage);
    }
  });

  it("각 스테이지는 자기 flag로만 켜진다 (이름표 ↔ 실제 읽기 일치 검증)", () => {
    for (const stage of CORE_JOURNEY_STAGES) {
      process.env[CORE_JOURNEY_FLAG_ENV_NAMES[stage]] = "1";
      for (const other of CORE_JOURNEY_STAGES) {
        assert.equal(
          isCoreJourneyEnabled(other),
          other === stage,
          `${stage} on일 때 ${other}`
        );
      }
      delete process.env[CORE_JOURNEY_FLAG_ENV_NAMES[stage]];
    }
  });

  it("서버 kill switch가 켜지면 flag가 on이어도 전부 false", () => {
    for (const stage of CORE_JOURNEY_STAGES) {
      process.env[CORE_JOURNEY_FLAG_ENV_NAMES[stage]] = "1";
    }
    process.env[KILL_SWITCH_ENV_NAME] = "1";
    for (const stage of CORE_JOURNEY_STAGES) {
      assert.equal(isCoreJourneyEnabled(stage), false, stage);
    }
  });

  it("클라이언트 미러 kill switch도 동일하게 전부 차단", () => {
    process.env[CORE_JOURNEY_FLAG_ENV_NAMES.P1] = "true";
    process.env[KILL_SWITCH_PUBLIC_ENV_NAME] = "true";
    assert.equal(isCoreJourneyEnabled("P1"), false);
  });

  it("kill switch 오타(해석 불가 값)도 차단으로 동작", () => {
    process.env[CORE_JOURNEY_FLAG_ENV_NAMES.P3] = "1";
    process.env[KILL_SWITCH_ENV_NAME] = "ture";
    assert.equal(isCoreJourneyEnabled("P3"), false);
  });

  it("kill switch가 명시적 off면 개별 flag가 그대로 동작", () => {
    process.env[CORE_JOURNEY_FLAG_ENV_NAMES.P2] = "on";
    process.env[KILL_SWITCH_ENV_NAME] = "false";
    process.env[KILL_SWITCH_PUBLIC_ENV_NAME] = "0";
    assert.equal(isKillSwitchOn(), false);
    assert.equal(isCoreJourneyEnabled("P2"), true);
    assert.equal(isCoreJourneyEnabled("P4"), false);
  });

  it("flag 값이 해석 불가면 off 유지 (fail-closed)", () => {
    process.env[CORE_JOURNEY_FLAG_ENV_NAMES.P5] = "yes";
    assert.equal(isCoreJourneyEnabled("P5"), false);
  });
});
