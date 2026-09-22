import { useEffect, useState } from "react";
import { Link } from "react-router";
import { loginWithToss } from "../lib/auth";
import { supabase } from "../lib/supabase";

interface Props { onLoggedIn: () => void }

// 진입 화면 — 앱인토스 체크리스트: 서비스 설명 + 토스 로그인만. 자사 로그인 없음.
// 약관·처리방침은 외부 브라우저가 아니라 앱 안 라우트(/terms·/privacy)로 연다 — 자사 사이트 이동 금지·"외부 링크가 열리지 않아요" 반려(-4·-6) 대응.
export default function Login({ onLoggedIn }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로컬 개발 전용: ?dev_token_hash=<magiclink hashed_token> 로 세션 생성(scripts/dev-session.mjs). 프로덕션 번들엔 없음.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const th = new URLSearchParams(window.location.search).get("dev_token_hash");
    if (!th) return;
    supabase().auth.verifyOtp({ token_hash: th, type: "magiclink" }).then(({ error: e }) => {
      if (e) setError(e.message); else { history.replaceState(null, "", "/"); onLoggedIn(); }
    });
  }, [onLoggedIn]);

  async function handleLogin() {
    setBusy(true); setError(null);
    try {
      await loginWithToss();
      onLoggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh px-4 pt-6 pb-8 mx-auto w-full max-w-lg" style={{ background: "var(--color-surface)", color: "var(--color-text-main)" }}>
      <img src="/icon-192.png" alt="" className="w-16 h-16 rounded-2xl mt-6 mb-2" />
      <h1 className="text-[22px] font-extrabold tracking-tight mb-1">도시공존</h1>
      <p className="text-[14px] mb-4" style={{ color: "var(--color-text-sub)" }}>우리 동네 길고양이를 지도에 기록하고, 이웃과 함께 돌봐요.</p>

      <div className="rounded-xl p-4" style={{ border: "1px solid var(--color-border)" }}>
        <p className="font-bold mb-1.5">이 앱에서 할 수 있는 것</p>
        <ul className="list-disc pl-[18px] text-[14px] space-y-0.5" style={{ color: "var(--color-text-sub)" }}>
          <li>동네 지도에서 이웃이 돌보는 고양이 보기 · 새 고양이 등록</li>
          <li>밥·물·간식·건강 체크를 돌봄 기록으로 남기기</li>
          <li>커뮤니티 글·댓글, 보호 지침, AI 집사, 고양이별 추모</li>
          <li>고양이 위치는 실제 자리에서 수백 m 떨어진 대략의 위치만 표시돼요</li>
        </ul>
      </div>

      <label className="flex items-start gap-2.5 text-[14px] my-4" style={{ color: "var(--color-text-sub)" }}>
        <input type="checkbox" className="w-5 h-5 mt-[1px]" style={{ accentColor: "var(--color-primary)" }} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          <Link to="/terms" className="underline" style={{ color: "var(--color-text-main)" }}>이용약관</Link>과{" "}
          <Link to="/privacy" className="underline" style={{ color: "var(--color-text-main)" }}>개인정보처리방침</Link>에 동의해요
        </span>
      </label>

      {error && <p className="text-[13px] my-2" style={{ color: "var(--color-danger, #d1433b)" }}>{error}</p>}
      <button
        type="button"
        className="w-full min-h-[52px] rounded-xl font-bold text-[16px] text-white disabled:opacity-45"
        style={{ background: "var(--color-primary)" }}
        disabled={!agreed || busy}
        onClick={handleLogin}
      >
        {busy ? "로그인 중…" : "토스로 시작하기"}
      </button>
      <p className="text-[13px] mt-3" style={{ color: "var(--color-text-light)" }}>
        토스 로그인으로 받은 정보는 계정 식별에만 쓰고, 이름·연락처는 지도에 표시되지 않아요.
      </p>
    </div>
  );
}
