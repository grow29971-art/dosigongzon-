import { useState } from "react";
import { Device } from "@apps-in-toss/web-framework";
import { loginWithToss } from "../lib/auth";

interface Props { onLoggedIn: () => void }

const TERMS_URL = "https://dosigongzon.com/terms";
const PRIVACY_URL = "https://dosigongzon.com/privacy";

// 진입 화면 — 앱인토스 체크리스트: 서비스 설명 + 토스 로그인만. 자사 로그인 없음.
export default function Login({ onLoggedIn }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="page">
      <img className="logo" src="/icon-192.png" alt="" />
      <h1 className="title">도시공존</h1>
      <p className="sub">우리 동네 길고양이를 지도에 기록하고, 이웃과 함께 돌봐요.</p>

      <div className="card">
        <p style={{ margin: "0 0 6px", fontWeight: 700 }}>이 앱에서 할 수 있는 것</p>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-sub)", fontSize: 14 }}>
          <li>동네 지도에서 이웃이 돌보는 고양이 보기</li>
          <li>밥·물·간식·건강 체크를 돌봄 기록으로 남기기</li>
          <li>고양이 위치는 실제 자리에서 수백 m 떨어진 대략의 위치만 표시돼요</li>
        </ul>
      </div>

      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          <button className="link" type="button" onClick={() => Device.openURL(TERMS_URL)}>이용약관</button>과{" "}
          <button className="link" type="button" onClick={() => Device.openURL(PRIVACY_URL)}>개인정보처리방침</button>에 동의해요
        </span>
      </label>

      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!agreed || busy} onClick={handleLogin}>
        {busy ? "로그인 중…" : "토스로 시작하기"}
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        토스 로그인으로 받은 정보는 계정 식별에만 쓰고, 이름·연락처는 지도에 표시되지 않아요.
      </p>
    </div>
  );
}
