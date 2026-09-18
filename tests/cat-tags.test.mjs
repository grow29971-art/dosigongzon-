import assert from "node:assert/strict";
import test from "node:test";

import { toggleCatTag, CAT_TAG_PRESETS } from "../lib/cat-tags.ts";

test("배타 묶음: TNR 완료를 켜면 TNR 필요가 꺼진다 (반대도)", () => {
  assert.deepEqual(toggleCatTag(["TNR 필요", "온순"], "TNR 완료"), ["온순", "TNR 완료"]);
  assert.deepEqual(toggleCatTag(["TNR 완료"], "TNR 필요"), ["TNR 필요"]);
  assert.deepEqual(toggleCatTag(["어린 고양이", "새끼 동반"], "성묘"), ["새끼 동반", "성묘"]);
});

test("같은 태그를 다시 누르면 꺼지고, 무관한 태그는 그대로", () => {
  assert.deepEqual(toggleCatTag(["온순", "야행성"], "온순"), ["야행성"]);
  assert.deepEqual(toggleCatTag(["TNR 완료"], "새끼 동반"), ["TNR 완료", "새끼 동반"]);
});

test("프리셋에 중복이 없다", () => {
  assert.equal(new Set(CAT_TAG_PRESETS).size, CAT_TAG_PRESETS.length);
});
