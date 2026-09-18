import assert from "node:assert/strict";
import test from "node:test";

import { josa } from "../lib/josa.ts";

test("받침 유무로 을/를·이/가를 고른다", () => {
  assert.equal(josa("오콩이", "을/를"), "오콩이를");
  assert.equal(josa("대감", "을/를"), "대감을");
  assert.equal(josa("치즈", "이/가"), "치즈가");
  assert.equal(josa("눈탱이", "이/가"), "눈탱이가");
  assert.equal(josa("김돌김", "이/가"), "김돌김이");
});

test("한글이 아니면 병기 표기를 유지한다", () => {
  assert.equal(josa("Tom", "을/를"), "Tom을(를)");
  assert.equal(josa("치즈2", "이/가"), "치즈2이(가)");
});
