# 실물 쇼핑몰 SQL 실행 순서 (2026-07-10)

새 환경/DB 재구축 시 아래 순서대로 Supabase SQL Editor에서 실행.
(관리자 판별은 기존 `admins` 테이블 재사용 — 별도 SQL 없음)

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | `supabase_shop_migration.sql` | products/cart_items/orders/order_items 테이블 + RLS + 재고/주문 인덱스 |
| 2 | `supabase_shop_orders_delete_pending_migration.sql` | 본인 pending 주문 삭제 정책 (스냅샷 실패 롤백용) |
| 3 | `supabase_shop_v2_migration.sql` | 카테고리 7종 개편(heater→shelter, etc→goods) + badge/is_donation/donation_percent/weight/supplier/is_virtual 컬럼 + updated_at 트리거 |
| 4 | `supabase_shop_stock_rpc_migration.sql` | 원자적 재고 차감/복구 RPC (decrement/increment_product_stock, service_role 전용) |
| 5 | `supabase_shop_donation_migration.sql` | order_items.donation_amount 후원 스냅샷 컬럼 |
| 6 | `supabase_shop_order_item_guard_migration.sql` | order_items INSERT 트리거 — 상품명/단가/소계/후원액을 서버 실제값으로 강제(조작 차단) |
| 7 | `supabase_shop_orders_insert_guard_migration.sql` | **[보안]** orders INSERT status='pending' 강제 — 결제 없이 'paid' 위조 차단 |
| — | `supabase_shop_seed.sql` | (선택) 카테고리별 3개 총 21개 샘플 상품. 실상품 등록 시 불필요 |

## 주의
- 3번은 1번의 category 체크 제약을 교체하므로 반드시 1번 뒤에 실행.
- 5번(donation 컬럼)은 6번(트리거가 그 컬럼 사용)보다 먼저.
- 보안 3종(6·7 + stock RPC의 권한 revoke)은 라이브 결제 전 반드시 적용.

## 무관 (기존 카드게임 상점 — 실물몰과 별개)
- `supabase_shop_buy_rpc_migration.sql`, `supabase_shop_coins_migration.sql` — /mypage/shop 게임 코인 상점용
