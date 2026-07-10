// 테스트 주문 정리 — orders + order_items 전량 삭제 (쇼핑몰 정식 오픈 전 테스트 데이터).
// 실행(미리보기): node --env-file=.env.local box/cleanup_test_orders.mjs
// 실행(삭제):     node --env-file=.env.local box/cleanup_test_orders.mjs --yes
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("❌ env 누락"); process.exit(1); }
const supabase = createClient(url.trim(), key.trim());

const doDelete = process.argv.includes("--yes");

// 현황 집계
const { data: orders, error } = await supabase
  .from("orders")
  .select("id, order_number, status, payment_amount, created_at");
if (error) { console.error("❌ 조회 실패:", error.message); process.exit(1); }

const byStatus = {};
for (const o of orders ?? []) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

console.log(`\n📦 현재 주문 ${orders?.length ?? 0}건`);
for (const [s, n] of Object.entries(byStatus)) console.log(`   - ${s}: ${n}건`);

const { count: itemCount } = await supabase
  .from("order_items")
  .select("*", { count: "exact", head: true });
console.log(`🧾 주문 항목(order_items): ${itemCount ?? 0}건\n`);

if (!doDelete) {
  console.log("👀 미리보기 모드. 실제 삭제하려면 --yes 플래그로 다시 실행하세요.");
  process.exit(0);
}

if ((orders?.length ?? 0) === 0) { console.log("삭제할 주문이 없어요."); process.exit(0); }

// order_items는 orders FK on delete cascade — orders만 지우면 함께 삭제됨.
// 안전하게 order_items 먼저 명시 삭제 후 orders 삭제.
const ids = orders.map((o) => o.id);
const { error: delItems } = await supabase.from("order_items").delete().in("order_id", ids);
if (delItems) { console.error("❌ order_items 삭제 실패:", delItems.message); process.exit(1); }
const { error: delOrders } = await supabase.from("orders").delete().in("id", ids);
if (delOrders) { console.error("❌ orders 삭제 실패:", delOrders.message); process.exit(1); }

console.log(`✅ 주문 ${ids.length}건 + 관련 항목 전부 삭제 완료.`);
console.log("   (products 재고는 그대로 — 필요 시 관리자 상품 관리에서 조정하세요.)");
