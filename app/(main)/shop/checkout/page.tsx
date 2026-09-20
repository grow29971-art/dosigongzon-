"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, X, Construction, Heart, PawPrint, ImageOff } from "lucide-react";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { useAuth } from "@/lib/auth-context";
import { listCartItems, computeCartTotal, type CartItem } from "@/lib/shop-repo";
import { createOrderFromCart, createGuestOrder, cancelGuestOrder, isVirtualOnlyCart } from "@/lib/order-repo";
import { PAYMENT_ENABLED, PAYMENT_DISABLED_MESSAGE } from "@/lib/payments-config";
import { maxPointsUsable, POINTS_MAX_USE_RATE, PURCHASE_REWARD_BASE_RATE, PURCHASE_REWARD_MAX_RATE } from "@/lib/points-config";
import { sanitizeImageUrl } from "@/lib/url-validate";
import UIButton from "@/app/components/ui/Button";
import UIListRow from "@/app/components/ui/ListRow";

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
  // 게스트(비회원) 개인정보 수집·이용 동의 (2026-08-29 법률감사 M2 — 회원은 가입 시 포괄동의,
  // 게스트는 별도 동의 절차가 없어 개인정보보호법 §15·§22 미충족이었음)
  const [privacyConsent, setPrivacyConsent] = useState(false);
  // 후원 지정 — 후원(10%) 중 selfRatio%를 내가 돌보는 고양이에게 배정 (2026-08-30)
  const [myCats, setMyCats] = useState<{ id: string; name: string }[]>([]);
  const [designatedCatId, setDesignatedCatId] = useState<string>("");
  const [selfRatio, setSelfRatio] = useState(70); // 기본 내 아이 70% : 동네 30%

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
        // 내가 돌보는 고양이 — 후원 지정 슬라이더용
        createClient()
          .from("cats")
          .select("id, name")
          .eq("caretaker_id", user.id)
          .is("memorial_at", null)
          .order("created_at", { ascending: true })
          .then(({ data }: { data: { id: string; name: string }[] | null }) => {
            const cats = data ?? [];
            setMyCats(cats);
            if (cats.length > 0) setDesignatedCatId((prev) => prev || cats[0].id);
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

  // 포인트 사용 가능 여부·한도 — 후원/가상 상품 포함 주문은 불가.
  // 사용 한도는 points-config 공유 정책 (상한율 + 최종 결제액 100원 이상).
  const pointsEligible =
    (pointBalance ?? 0) > 0 && !items.some((i) => i.product.is_virtual || i.product.is_donation);
  const maxPoints = pointsEligible ? Math.min(pointBalance ?? 0, maxPointsUsable(grandTotal)) : 0;
  const effectivePoints = Math.max(0, Math.min(pointsInput, maxPoints));
  const finalAmount = grandTotal - effectivePoints;

  // 결제하기 — 주문 생성 후 토스 결제창 호출
  // (결제위젯이 아닌 "결제창" 방식: API 개별 연동 키(test_ck_)로 사용 가능.
  //  결제위젯 UI는 전자결제 이용 신청 후 위젯 키 발급 시 전환 검토)
  const handleSubmit = async () => {
    setError("");
    // 실화폐 결제 하드락(게이트 off) — 대신 "심사 모드": 주문 생성 없이 테스트 결제창만 연다.
    // 토스페이먼츠 계약심사(2026-09-18)가 "실제 구매 경로에서 결제창 호출 확인"을 요구해서,
    // /shop/payment-demo 와 같은 데모 호출(DEMO- 주문번호·승인 API 미호출·복귀는 데모 페이지)을
    // 주문서 버튼에 얹었다(사장님 승인 2026-09-20). 게이트가 켜지면 이 분기는 자연히 죽는다.
    if (!PAYMENT_ENABLED) {
      if (!TOSS_CLIENT_KEY || items.length === 0) { setError(PAYMENT_DISABLED_MESSAGE); return; }
      setSubmitting(true);
      try {
        const toss = await loadTossPayments(TOSS_CLIENT_KEY);
        const payment = toss.payment({ customerKey: ANONYMOUS });
        await payment.requestPayment({
          method: "CARD",
          amount: { currency: "KRW", value: finalAmount },
          orderId: `DEMO-${Date.now()}`,
          orderName: `${items[0].product.name}${items.length > 1 ? ` 외 ${items.length - 1}건` : ""} (심사용 데모)`,
          successUrl: `${window.location.origin}/shop/payment-demo?result=success`,
          failUrl: `${window.location.origin}/shop/payment-demo?result=fail`,
          card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg && !msg.includes("취소")) setError(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!virtualOnly) {
      if (!recipientName.trim()) { setError("수령인 이름을 입력해주세요."); return; }
      if (!recipientPhone.trim() || !/^[\d-]{9,13}$/.test(recipientPhone.trim())) {
        setError("연락처를 정확히 입력해주세요. (숫자와 - 만)"); return;
      }
      if (!postalCode || !address) { setError("주소를 검색해서 선택해주세요."); return; }
      // 비회원은 개인정보 수집·이용 동의 필수 (회원은 가입 시 동의로 갈음)
      if (!user && !privacyConsent) {
        setError("개인정보 수집·이용 동의가 필요해요."); return;
      }
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
        // 후원 지정 — 내 고양이 있고 비율>0일 때만 전달 (가상 상품만 주문이면 후원 배분 무의미)
        const designation =
          !virtualOnly && designatedCatId && selfRatio > 0
            ? { catId: designatedCatId, selfRatio }
            : undefined;
        const o = await createOrderFromCart(items, shipping, effectivePoints, designation);
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
        successUrl: `${window.location.origin}/shop/payment/success`,
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
    background: "var(--color-surface)",
    borderRadius: "var(--radius-input)",
    border: "1px solid var(--color-border)",
  } as const;

  // 섹션은 카드가 아니라 헤어라인으로 구획 (2026-09-16 리디자인 — 당근·토스 주문서 문법)
  const sectionCls = "py-4";
  const sectionStyle = { borderBottom: "1px solid var(--color-divider)" } as const;

  return (
    <div className="pb-32">
      <div className="px-4 pt-12 pb-2 flex items-center gap-1">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong -ml-2"
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </button>
        <h1 className="text-[17px] font-bold text-text-main">주문서</h1>
      </div>

      {loading ? (
        <div className="px-4 mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse" style={{ height: 80, background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-16 px-6">
          <p className="text-[15px] font-semibold text-text-main mb-4">주문할 상품이 없어요</p>
          <UIButton onClick={() => router.push("/shop")}>쇼핑하러가기</UIButton>
        </div>
      ) : (
        <div className="px-4">
          {/* 정식 오픈 준비 중 안내 */}
          <div className="flex items-start gap-2.5 py-3" style={sectionStyle}>
            <Construction size={16} className="shrink-0 mt-0.5 text-text-light" />
            <p className="text-[13px] text-text-sub leading-relaxed">
              쇼핑몰은 정식 오픈을 준비 중이에요. 지금은 테스트 단계라 실제 결제·배송은 이뤄지지 않아요.
            </p>
          </div>

          {/* 주문 상품 */}
          <section className={sectionCls} style={sectionStyle}>
            <h2 className="text-[15px] font-bold text-text-main mb-3">주문 상품 {items.length}건</h2>
            <div className="space-y-3">
              {items.map((item) => {
                const unitPrice = item.product.sale_price ?? item.product.price;
                const thumb = sanitizeImageUrl(item.product.images[0], "");
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div
                      className="relative shrink-0 overflow-hidden flex items-center justify-center"
                      style={{ width: 48, height: 48, background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }}
                    >
                      {thumb ? (
                        <Image src={thumb} alt={item.product.name} fill className="object-cover" />
                      ) : (
                        <ImageOff size={16} style={{ color: "var(--color-text-muted)" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-main truncate">{item.product.name}</p>
                      <p className="text-[11px] text-text-sub">{formatWon(unitPrice)} · {item.quantity}개</p>
                    </div>
                    <span className="text-[13px] font-medium text-text-main shrink-0 tabular-nums">
                      {formatWon(unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 배송지 — 가상(후원) 상품 전용 주문은 배송이 없어 생략 */}
          {virtualOnly ? (
            <div className="flex items-start gap-2.5 py-3" style={sectionStyle}>
              <Heart size={16} className="shrink-0 mt-0.5 text-text-light" />
              <p className="text-[13px] text-text-sub leading-relaxed">
                후원 상품은 배송이 없어요. 배송지 입력 없이 바로 결제할 수 있고, 결제 금액은 길고양이들을 위해 쓰여요.
              </p>
            </div>
          ) : (<>
          <section className={sectionCls} style={sectionStyle}>
            <h2 className="text-[15px] font-bold text-text-main mb-3">배송지 정보</h2>
            <div className="space-y-2.5">
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="수령인 이름"
                className="w-full px-3.5 py-3 text-[15px] outline-none"
                style={inputStyle}
                maxLength={20}
              />
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="연락처 (예: 010-1234-5678)"
                className="w-full px-3.5 py-3 text-[15px] outline-none"
                style={inputStyle}
                maxLength={13}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={postalCode}
                  readOnly
                  placeholder="우편번호"
                  className="w-[110px] px-3.5 py-3 text-[15px] outline-none"
                  style={inputStyle}
                />
                <UIButton variant="secondary" className="flex-1" style={{ height: "auto" }} onClick={() => setPostcodeOpen(true)}>
                  <MapPin size={14} />
                  주소 검색
                </UIButton>
              </div>
              {address && (
                <input
                  type="text"
                  value={address}
                  readOnly
                  className="w-full px-3.5 py-3 text-[15px] outline-none"
                  style={inputStyle}
                />
              )}
              <input
                type="text"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="상세주소 (동/호수 등)"
                className="w-full px-3.5 py-3 text-[15px] outline-none"
                style={inputStyle}
                maxLength={50}
              />
            </div>
          </section>

          {/* 주문 메모 */}
          <section className={sectionCls} style={sectionStyle}>
            <h2 className="text-[15px] font-bold text-text-main mb-3">주문 메모 <span className="text-[13px] font-normal text-text-light">(선택)</span></h2>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="배송 시 요청사항을 입력해주세요"
              className="w-full px-3.5 py-3 text-[15px] outline-none resize-none"
              style={{ ...inputStyle, minHeight: 72 }}
              maxLength={200}
            />
          </section>

          {/* 비회원 개인정보 수집·이용 동의 (2026-08-29 법률감사 M2) */}
          {!user && (
            <label className="flex items-start gap-2.5 py-4 cursor-pointer" style={sectionStyle}>
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--color-primary)]"
              />
              <span className="text-[13px] leading-relaxed text-text-sub">
                <b className="text-text-main">[필수]</b> 주문·배송을 위한 개인정보 수집·이용에 동의합니다.
                <br />
                <span className="text-text-light">
                  수집 항목: 수령인 이름·연락처·주소 / 목적: 주문 처리·배송 / 보유기간: 전자상거래법에 따라 5년.
                  자세한 내용은 <Link href="/privacy" className="underline" style={{ color: "var(--color-primary)" }}>개인정보처리방침</Link>.
                </span>
              </span>
            </label>
          )}

          {/* 후원 배분 — 후원(수익 10%)을 내가 돌보는 고양이에게 배정 (2026-08-30) */}
          {user && myCats.length > 0 && (
            <section className={sectionCls} style={sectionStyle}>
              <h2 className="text-[15px] font-bold text-text-main mb-1">이 주문의 후원, 누구에게?</h2>
              <p className="text-[13px] text-text-sub leading-relaxed mb-3">
                구매 후원(수익의 10%)을 <b className="text-text-main">내가 돌보는 아이</b>에게 먼저 쓰고,
                나머지는 동네 길고양이 중성화에 써요. 후원 금액은 그대로예요.
              </p>
              {myCats.length > 1 && (
                <select
                  value={designatedCatId}
                  onChange={(e) => setDesignatedCatId(e.target.value)}
                  className="w-full mb-3 px-3 py-2.5 text-[15px] outline-none"
                  style={inputStyle}
                >
                  {myCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <div className="flex items-center justify-between text-[13px] font-semibold mb-1.5">
                <span className="text-text-main">
                  {myCats.find((c) => c.id === designatedCatId)?.name ?? "내 아이"} {selfRatio}%
                </span>
                <span className="text-text-sub">동네 {100 - selfRatio}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={selfRatio}
                onChange={(e) => setSelfRatio(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
              <p className="text-[11px] text-text-light mt-1.5">
                {selfRatio === 0
                  ? "전액 동네 길고양이 기금으로 가요."
                  : selfRatio === 100
                    ? "이 아이의 중성화·치료·겨울집에 우선 배정돼요."
                    : `이 아이에게 우선 배정하고, 남으면 동네 기금으로 가요.`}
              </p>
            </section>
          )}
          </>)}

          {/* 포인트 사용 — 주간 출석 적립 (1P=1원). 후원 상품 포함 시 숨김 */}
          {pointsEligible && (
            <section className={sectionCls} style={sectionStyle}>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[15px] font-bold text-text-main">포인트 사용</h2>
                <span className="text-[13px] text-text-sub tabular-nums">
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
                  className="flex-1 px-3 py-2.5 text-[15px] outline-none tabular-nums"
                  style={inputStyle}
                />
                <UIButton variant="secondary" className="shrink-0" style={{ height: "auto" }} onClick={() => setPointsInput(maxPoints)}>
                  최대 사용
                </UIButton>
              </div>
              <p className="text-[11px] text-text-light mt-1.5">
                1P = 1원 · 주문 금액의 {Math.round(POINTS_MAX_USE_RATE * 100)}%까지 사용 가능 (이 주문 최대 {maxPoints.toLocaleString()}P) · 주문 취소 시 자동 반환
              </p>
            </section>
          )}

          {/* 포인트 0P 힌트 — 적립 유도 (후원/가상 상품 주문 아닐 때만) */}
          {(pointBalance ?? 0) === 0 && !items.some((i) => i.product.is_virtual || i.product.is_donation) && (
            <div style={sectionStyle}>
              <UIListRow
                icon={<PawPrint size={20} />}
                title="돌봄 기록을 남기면 포인트가 쌓여요"
                subtitle="다음엔 1P = 1원으로 할인받으세요"
                href="/"
                divider={false}
              />
            </div>
          )}

          {/* 결제 금액 */}
          <section className={sectionCls}>
            <h2 className="text-[15px] font-bold text-text-main mb-3">결제 금액</h2>
            <div className="flex items-center justify-between text-[13px] text-text-sub mb-1.5">
              <span>총 상품금액</span>
              <span className="tabular-nums">{formatWon(productTotal)}</span>
            </div>
            {!virtualOnly && (
              <div className="flex items-center justify-between text-[13px] text-text-sub mb-2.5">
                <span>배송비</span>
                <span className="tabular-nums">{shippingFee > 0 ? formatWon(shippingFee) : "무료"}</span>
              </div>
            )}
            {effectivePoints > 0 && (
              <div className="flex items-center justify-between text-[13px] mb-1.5" style={{ color: "var(--color-sage)" }}>
                <span>포인트 할인</span>
                <span className="tabular-nums">-{formatWon(effectivePoints)}</span>
              </div>
            )}
            <div
              className="flex items-center justify-between pt-2.5 text-[15px] font-bold text-text-main"
              style={{ borderTop: "1px solid var(--color-divider)" }}
            >
              <span>총 결제금액</span>
              <span className="tabular-nums">{formatWon(finalAmount)}</span>
            </div>
            <p className="text-[11px] text-text-light mt-1.5">모든 금액은 부가세(VAT) 포함이에요.</p>
            {/* 구매 적립 안내 — 회원만(게스트는 지갑 없음). 요율은 points-config에서 관리 (2026-08-30) */}
            {user && finalAmount > 0 && (
              <p className="text-[11px] mt-1" style={{ color: "var(--color-sage)" }}>
                구매 시 <b>{Math.floor(finalAmount * PURCHASE_REWARD_BASE_RATE).toLocaleString()}P</b> 적립 예정
                (기본 {Math.round(PURCHASE_REWARD_BASE_RATE * 100)}% · 단골 최대 {Math.round(PURCHASE_REWARD_MAX_RATE * 100)}%)
              </p>
            )}
          </section>

          {error && (
            <p className="text-[13px] font-semibold text-center" style={{ color: "var(--color-error)" }}>{error}</p>
          )}
        </div>
      )}

      {/* 하단 고정 결제 버튼 */}
      {items.length > 0 && !loading && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}
        >
          {!PAYMENT_ENABLED && (
            <p className="text-[13px] text-center mb-2" style={{ color: "var(--color-warning)" }}>
              {PAYMENT_DISABLED_MESSAGE}
            </p>
          )}
          <UIButton size="lg" full onClick={handleSubmit} disabled={submitting}>
            {submitting ? "주문 처리 중…" : `${formatWon(finalAmount)} 결제하기`}
          </UIButton>
        </div>
      )}

      {/* 우편번호 검색 모달 */}
      {postcodeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div
            className="w-full max-w-lg overflow-hidden"
            style={{ background: "var(--color-surface)", borderRadius: "var(--radius-modal) var(--radius-modal) 0 0", height: "70dvh", boxShadow: "var(--shadow-sheet)" }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <span className="text-[15px] font-bold text-text-main">주소 검색</span>
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
