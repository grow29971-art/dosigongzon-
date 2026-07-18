"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, X } from "lucide-react";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { useAuth } from "@/lib/auth-context";
import { listCartItems, computeCartTotal, type CartItem } from "@/lib/shop-repo";
import { createOrderFromCart, createGuestOrder, cancelGuestOrder, isVirtualOnlyCart } from "@/lib/order-repo";
import { PAYMENT_ENABLED, PAYMENT_DISABLED_MESSAGE } from "@/lib/payments-config";
import { sanitizeImageUrl } from "@/lib/url-validate";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

// ── 다음 우편번호 SDK 타입 (필요한 필드만) ──
interface DaumPostcodeData {
  zonecode: string;      // 우편번호 (5자리)
  roadAddress: string;   // 도로명 주소
  jibunAddress: string;  // 지번 주소
  buildingName: string;
}
interface DaumPostcodeCtor {
  new (opts: {
    oncomplete: (data: DaumPostcodeData) => void;
    width: string;
    height: string;
  }): { embed: (el: HTMLElement) => void };
}
declare global {
  interface Window {
    daum?: { Postcode: DaumPostcodeCtor };
  }
}

const POSTCODE_SCRIPT = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

function loadPostcodeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.daum?.Postcode) { resolve(); return; }
    const existing = document.querySelector(`script[src="${POSTCODE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("주소 검색을 불러올 수 없어요.")));
      return;
    }
    const script = document.createElement("script");
    script.src = POSTCODE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("주소 검색을 불러올 수 없어요."));
    document.head.appendChild(script);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [memo, setMemo] = useState("");

  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const postcodeRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 포인트 (주간 출석 적립 — 1P = 1원 할인). 테이블 미생성/잔액 0이면 섹션 숨김.
  const [pointBalance, setPointBalance] = useState<number | null>(null);
  const [pointsInput, setPointsInput] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    // 게스트도 주문서 접근 — 장바구니는 shop-repo가 로그인/게스트를 알아서 분기
    listCartItems()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // 포인트는 로그인 유저만 (게스트는 적립·사용 불가)
    if (user) {
      import("@/lib/supabase/client").then(({ createClient }) => {
        createClient()
          .from("user_points")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle()
          .then(({ data, error: pErr }: { data: { balance: number } | null; error: unknown }) => {
            if (!pErr && data) setPointBalance(data.balance);
          });
      });
    }
  }, [authLoading, user]);

  // 우편번호 모달 열릴 때 SDK embed
  useEffect(() => {
    if (!postcodeOpen || !postcodeRef.current) return;
    let cancelled = false;
    loadPostcodeScript()
      .then(() => {
        if (cancelled || !postcodeRef.current || !window.daum?.Postcode) return;
        postcodeRef.current.innerHTML = "";
        new window.daum.Postcode({
          oncomplete: (data) => {
            setPostalCode(data.zonecode);
            setAddress(data.roadAddress || data.jibunAddress);
            setPostcodeOpen(false);
          },
          width: "100%",
          height: "100%",
        }).embed(postcodeRef.current);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "주소 검색을 불러올 수 없어요.");
        setPostcodeOpen(false);
      });
    return () => { cancelled = true; };
  }, [postcodeOpen]);

  const { productTotal, shippingFee, grandTotal } = computeCartTotal(items);
  // 전 상품이 가상(후원) 상품이면 배송이 없어 배송지 입력을 생략
  const virtualOnly = isVirtualOnlyCart(items);

  // 포인트 사용 가능 여부·한도 — 후원/가상 상품 포함 주문은 불가, 최종 결제액 100원 이상 유지
  const pointsEligible =
    (pointBalance ?? 0) > 0 && !items.some((i) => i.product.is_virtual || i.product.is_donation);
  const maxPoints = pointsEligible ? Math.max(0, Math.min(pointBalance ?? 0, grandTotal - 100)) : 0;
  const effectivePoints = Math.max(0, Math.min(pointsInput, maxPoints));
  const finalAmount = grandTotal - effectivePoints;

  // 결제하기 — 주문 생성 후 토스 결제창 호출
  // (결제위젯이 아닌 "결제창" 방식: API 개별 연동 키(test_ck_)로 사용 가능.
  //  결제위젯 UI는 전자결제 이용 신청 후 위젯 키 발급 시 전환 검토)
  const handleSubmit = async () => {
    setError("");
    // 통신판매업 신고 완료 전 실화폐 결제 하드락
    if (!PAYMENT_ENABLED) { setError(PAYMENT_DISABLED_MESSAGE); return; }
    if (!virtualOnly) {
      if (!recipientName.trim()) { setError("수령인 이름을 입력해주세요."); return; }
      if (!recipientPhone.trim() || !/^[\d-]{9,13}$/.test(recipientPhone.trim())) {
        setError("연락처를 정확히 입력해주세요. (숫자와 - 만)"); return;
      }
      if (!postalCode || !address) { setError("주소를 검색해서 선택해주세요."); return; }
    }
    if (!TOSS_CLIENT_KEY) {
      setError("결제 수단이 아직 준비 중이에요. 잠시 후 다시 시도해주세요.");
      return;
    }

    const shipping = virtualOnly ? null : {
      recipient_name: recipientName.trim(),
      recipient_phone: recipientPhone.trim(),
      recipient_address: address,
      recipient_address_detail: addressDetail.trim() || undefined,
      postal_code: postalCode,
      memo: memo.trim() || undefined,
    };

    setSubmitting(true);
    // 주문 식별자 — 회원/게스트 공통. 실패 시 정리에 사용.
    let orderId = "";
    let orderNumber = "";
    let paymentAmount = 0;
    let guestToken: string | null = null;
    try {
      if (user) {
        const o = await createOrderFromCart(items, shipping, effectivePoints);
        orderId = o.id; orderNumber = o.order_number; paymentAmount = o.payment_amount;
      } else {
        // 게스트 주문 — 포인트 미사용, 서버가 금액 재계산
        const g = await createGuestOrder(items, shipping);
        orderId = g.order_id; orderNumber = g.order_number;
        paymentAmount = g.payment_amount; guestToken = g.guest_token;
      }

      const toss = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: user ? user.id : ANONYMOUS });
      const orderName = items.length > 1
        ? `${items[0].product.name} 외 ${items.length - 1}건`
        : items[0].product.name;

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: paymentAmount },
        orderId: orderNumber,
        orderName,
        successUrl: `${window.location.origin}/shop/payment/success${guestToken ? `?guest=${encodeURIComponent(guestToken)}` : ""}`,
        failUrl: `${window.location.origin}/shop/payment/fail`,
        ...(virtualOnly ? {} : { customerName: recipientName.trim() }),
        card: {
          useEscrow: false,
          flowMode: "DEFAULT",
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
      // requestPayment는 성공 시 successUrl로 리다이렉트 — 이 아래는 실행되지 않음
    } catch (e) {
      // 결제창 이탈/실패 — 만들어둔 pending 주문 정리
      if (orderId) {
        if (user) {
          fetch("/api/payment/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          }).catch(() => {});
        } else if (guestToken) {
          cancelGuestOrder(orderNumber, guestToken).catch(() => {});
        }
      }
      const msg = e instanceof Error ? e.message : "";
      if (msg && !msg.includes("취소")) {
        setError(msg || "결제를 시작할 수 없어요. 다시 시도해주세요.");
      }
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--color-warm-white)",
    borderRadius: "var(--radius-input)",
    border: "1px solid rgba(0,0,0,0.05)",
  } as const;

  return (
    <div className="pb-32">
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[16px] font-extrabold text-text-main">주문서</h1>
      </div>

      {loading ? (
        <div className="px-4 mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ height: 80, background: "var(--color-surface-alt)" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-16 px-6">
          <p className="text-[14px] font-bold text-text-main mb-4">주문할 상품이 없어요</p>
          <button
            onClick={() => router.push("/shop")}
            className="px-5 py-2.5 rounded-2xl bg-primary text-white text-[13px] font-bold"
          >
            쇼핑하러가기
          </button>
        </div>
      ) : (
        <div className="px-4 mt-3 space-y-4">
          {/* 정식 오픈 준비 중 안내 */}
          <div
            className="flex items-start gap-2.5 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(255,169,39,0.1)", border: "1px solid rgba(255,169,39,0.28)" }}
          >
            <span className="text-[15px] shrink-0">🚧</span>
            <p className="text-[11.5px] font-semibold leading-snug" style={{ color: "#A6741E" }}>
              쇼핑몰은 정식 오픈을 준비 중이에요. 지금은 테스트 단계라 실제 결제·배송은 이뤄지지 않아요. 곧 정식으로 찾아올게요!
            </p>
          </div>

          {/* 주문 상품 */}
          <section
            className="p-4"
            style={{ background: "#fff", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", border: "1px solid rgba(0,0,0,0.04)" }}
          >
            <h2 className="text-[13.5px] font-extrabold text-text-main mb-3">주문 상품 {items.length}건</h2>
            <div className="space-y-2.5">
              {items.map((item) => {
                const unitPrice = item.product.sale_price ?? item.product.price;
                const thumb = sanitizeImageUrl(item.product.images[0], "https://placehold.co/200x200?text=No+Image");
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 48, height: 48 }}>
                      <Image src={thumb} alt={item.product.name} fill className="object-cover" unoptimized={thumb.includes("placehold.co")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-text-main truncate">{item.product.name}</p>
                      <p className="text-[11.5px] text-text-sub">{formatWon(unitPrice)} · {item.quantity}개</p>
                    </div>
                    <span className="text-[12.5px] font-extrabold text-text-main shrink-0">
                      {formatWon(unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 배송지 — 가상(후원) 상품 전용 주문은 배송이 없어 생략 */}
          {virtualOnly ? (
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-2xl"
              style={{ background: "rgba(232,141,90,0.08)", border: "1px solid rgba(232,141,90,0.22)" }}
            >
              <span className="text-[15px] shrink-0">💛</span>
              <p className="text-[11.5px] font-semibold leading-snug" style={{ color: "#B06A42" }}>
                후원 상품은 배송이 없어요. 배송지 입력 없이 바로 결제할 수 있고, 결제 금액은 길고양이들을 위해 쓰여요.
              </p>
            </div>
          ) : (<>
          <section
            className="p-4"
            style={{ background: "#fff", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", border: "1px solid rgba(0,0,0,0.04)" }}
          >
            <h2 className="text-[13.5px] font-extrabold text-text-main mb-3">배송지 정보</h2>
            <div className="space-y-2.5">
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="수령인 이름"
                className="w-full px-3.5 py-3 text-[13.5px] outline-none"
                style={inputStyle}
                maxLength={20}
              />
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="연락처 (예: 010-1234-5678)"
                className="w-full px-3.5 py-3 text-[13.5px] outline-none"
                style={inputStyle}
                maxLength={13}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={postalCode}
                  readOnly
                  placeholder="우편번호"
                  className="w-[110px] px-3.5 py-3 text-[13.5px] outline-none"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setPostcodeOpen(true)}
                  className="flex-1 py-3 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                  style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
                >
                  <MapPin size={14} />
                  주소 검색
                </button>
              </div>
              {address && (
                <input
                  type="text"
                  value={address}
                  readOnly
                  className="w-full px-3.5 py-3 text-[13.5px] outline-none"
                  style={inputStyle}
                />
              )}
              <input
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="상세주소 (동/호수 등)"
                className="w-full px-3.5 py-3 text-[13.5px] outline-none"
                style={inputStyle}
                maxLength={50}
              />
            </div>
          </section>

          {/* 주문 메모 */}
          <section
            className="p-4"
            style={{ background: "#fff", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", border: "1px solid rgba(0,0,0,0.04)" }}
          >
            <h2 className="text-[13.5px] font-extrabold text-text-main mb-3">주문 메모 <span className="text-[11px] font-semibold text-text-light">(선택)</span></h2>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="배송 시 요청사항을 입력해주세요"
              className="w-full px-3.5 py-3 text-[13.5px] outline-none resize-none"
              style={{ ...inputStyle, minHeight: 72 }}
              maxLength={200}
            />
          </section>
          </>)}

          {/* 포인트 사용 — 주간 출석 적립 (1P=1원). 후원 상품 포함 시 숨김 */}
          {pointsEligible && (
            <section
              className="p-4"
              style={{ background: "#fff", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", border: "1px solid rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[13.5px] font-extrabold text-text-main">포인트 사용</h2>
                <span className="text-[11px] font-bold text-text-light tabular-nums">
                  보유 {(pointBalance ?? 0).toLocaleString()}P
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={maxPoints}
                  value={pointsInput === 0 ? "" : pointsInput}
                  placeholder="0"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setPointsInput(isNaN(v) || v < 0 ? 0 : Math.min(v, maxPoints));
                  }}
                  className="flex-1 px-3 py-2.5 rounded-xl text-[13px] outline-none tabular-nums"
                  style={{ backgroundColor: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
                />
                <button
                  type="button"
                  onClick={() => setPointsInput(maxPoints)}
                  className="shrink-0 px-3.5 rounded-xl text-[12px] font-extrabold active:scale-95 transition-transform"
                  style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
                >
                  전액 사용
                </button>
              </div>
              <p className="text-[10px] text-text-light mt-1.5">
                1P = 1원 · 최종 결제 금액은 100원 이상이어야 해요 · 주문 취소 시 자동 반환
              </p>
            </section>
          )}

          {/* 포인트 0P 힌트 — 적립 유도 (후원/가상 상품 주문 아닐 때만) */}
          {(pointBalance ?? 0) === 0 && !items.some((i) => i.product.is_virtual || i.product.is_donation) && (
            <Link
              href="/#daily-box"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl active:scale-[0.99] transition-transform"
              style={{ background: "var(--color-primary-soft)", border: "1px solid rgba(49,130,246,0.18)" }}
            >
              <span className="text-[15px] shrink-0">🐾</span>
              <p className="text-[11px] font-bold leading-snug flex-1" style={{ color: "var(--color-primary-dark)" }}>
                매일 돌봄 출석하면 포인트가 쌓여요 · 다음엔 <b>1P = 1원</b>으로 할인받으세요
              </p>
            </Link>
          )}

          {/* 결제 금액 */}
          <section
            className="p-4"
            style={{ background: "#fff", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", border: "1px solid rgba(0,0,0,0.04)" }}
          >
            <h2 className="text-[13.5px] font-extrabold text-text-main mb-3">결제 금액</h2>
            <div className="flex items-center justify-between text-[12.5px] text-text-sub mb-1.5">
              <span>총 상품금액</span>
              <span>{formatWon(productTotal)}</span>
            </div>
            {!virtualOnly && (
              <div className="flex items-center justify-between text-[12.5px] text-text-sub mb-2.5">
                <span>배송비</span>
                <span>{shippingFee > 0 ? formatWon(shippingFee) : "무료"}</span>
              </div>
            )}
            {effectivePoints > 0 && (
              <div className="flex items-center justify-between text-[12.5px] mb-1.5" style={{ color: "#22A366" }}>
                <span>포인트 할인</span>
                <span className="tabular-nums">-{formatWon(effectivePoints)}</span>
              </div>
            )}
            <div
              className="flex items-center justify-between pt-2.5 text-[15px] font-extrabold text-text-main"
              style={{ borderTop: "1px dashed rgba(0,0,0,0.08)" }}
            >
              <span>총 결제금액</span>
              <span style={{ color: "var(--color-primary)" }}>{formatWon(finalAmount)}</span>
            </div>
          </section>

          {error && (
            <p className="text-[12.5px] font-bold text-center" style={{ color: "#D85555" }}>{error}</p>
          )}
        </div>
      )}

      {/* 하단 고정 결제 버튼 */}
      {items.length > 0 && !loading && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ background: "#fff", boxShadow: "0 -4px 16px rgba(20,40,70,0.08)" }}
        >
          {!PAYMENT_ENABLED && (
            <p className="text-[12px] text-center font-semibold mb-2" style={{ color: "#B8791F" }}>
              {PAYMENT_DISABLED_MESSAGE}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || !PAYMENT_ENABLED}
            className="w-full py-3.5 rounded-2xl bg-primary text-white text-[14.5px] font-extrabold active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-primary)" }}
          >
            {!PAYMENT_ENABLED ? "결제 준비 중" : submitting ? "주문 처리 중…" : `${formatWon(finalAmount)} 결제하기`}
          </button>
        </div>
      )}

      {/* 우편번호 검색 모달 */}
      {postcodeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(20,25,40,0.5)" }}>
          <div
            className="w-full max-w-lg overflow-hidden"
            style={{ background: "#fff", borderRadius: "24px 24px 0 0", height: "70dvh" }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <span className="text-[14px] font-extrabold text-text-main">주소 검색</span>
              <button onClick={() => setPostcodeOpen(false)} aria-label="닫기" className="w-8 h-8 flex items-center justify-center">
                <X size={18} className="text-text-sub" />
              </button>
            </div>
            <div ref={postcodeRef} style={{ width: "100%", height: "calc(70dvh - 49px)" }} />
          </div>
        </div>
      )}
    </div>
  );
}
