"use client";

// ══════════════════════════════════════════
// 내 위치 보내기 (A-2) — 서버 무경유
//
// ⚠️ 법적 설계 원칙 (box/학대방지_캣맘보호_구현프롬프트.md):
// - 좌표는 클라이언트에서 1회 획득 → OS 공유시트(navigator.share)/sms: 로만 흘려보낸다.
//   서버·DB·로그·애널리틱스에 단 1바이트도 전송하지 않는다 (이 파일에 fetch·supabase 금지).
// - 보호 연락처(별칭+번호)는 localStorage에만 저장. 서버 저장 금지.
// - 위치 획득 실패는 침묵하지 않고 즉시 표기.
// - 실시간 추적·상시 공유 아님 — 누를 때 1회 링크 전송뿐.
// ══════════════════════════════════════════

import { useEffect, useState } from "react";
import { Share2, MessageSquare, Plus, Trash2, Loader2, Send } from "lucide-react";

const GUARDIANS_KEY = "dosi_guardians_v1";
const MAX_GUARDIANS = 3;

type Guardian = { name: string; phone: string };

function loadGuardians(): Guardian[] {
  try {
    const raw = localStorage.getItem(GUARDIANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g): g is Guardian => typeof g?.name === "string" && typeof g?.phone === "string")
      .slice(0, MAX_GUARDIANS);
  } catch {
    return [];
  }
}

function saveGuardians(list: Guardian[]) {
  try { localStorage.setItem(GUARDIANS_KEY, JSON.stringify(list.slice(0, MAX_GUARDIANS))); } catch {}
}

// sms: 딥링크 — iOS는 &body=, 그 외(Android)는 ?body=
function smsHref(phone: string, body: string): string {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const sep = isIOS ? "&" : "?";
  return `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
}

export default function ShareMyLocation() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  // 위치 링크 — 획득 성공 시에만 채워짐. 컴포넌트 state(메모리)에만 존재.
  const [shareText, setShareText] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    setGuardians(loadGuardians());
  }, []);

  const getLocation = () => {
    setError("");
    setShareText(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("이 기기에서 위치를 확인할 수 없어요.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const link = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        setShareText(`[도시공존] 지금 제 위치예요. 와주시거나 연락해주세요.\n${link}`);
      },
      () => {
        setLocating(false);
        setError("위치 확인 실패 — 위치 권한과 GPS를 확인해주세요.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    );
  };

  const shareViaSheet = async () => {
    if (!shareText) return;
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("공유 기능이 없는 브라우저라 링크를 복사했어요. 문자에 붙여넣어 보내주세요.");
      }
    } catch { /* 유저가 공유 시트를 닫음 — 정상 */ }
  };

  const addGuardian = () => {
    const name = newName.trim();
    const phone = newPhone.replace(/[^0-9+\-]/g, "").trim();
    if (!name) { setError("별칭을 입력해주세요."); return; }
    if (phone.replace(/\D/g, "").length < 9) { setError("전화번호를 확인해주세요."); return; }
    const next = [...guardians, { name, phone }].slice(0, MAX_GUARDIANS);
    setGuardians(next);
    saveGuardians(next);
    setNewName(""); setNewPhone(""); setAddOpen(false); setError("");
  };

  const removeGuardian = (idx: number) => {
    const next = guardians.filter((_, i) => i !== idx);
    setGuardians(next);
    saveGuardians(next);
  };

  return (
    <div className="rounded-2xl px-4 py-3.5 mt-3" style={{ backgroundColor: "var(--color-surface-alt)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Send size={13} className="text-primary" />
        <span className="text-[11px] font-bold text-text-sub">내 위치 보내기</span>
      </div>
      <p className="text-[11px] text-text-light leading-relaxed mb-2.5">
        믿을 수 있는 사람에게 지금 위치 링크를 문자·공유로 <b>직접</b> 보내요.
        위치는 서버를 거치지 않고 내 폰에서 바로 전송돼요.
      </p>

      {!shareText ? (
        <button
          onClick={getLocation}
          disabled={locating}
          className="w-full rounded-xl py-3 text-[15px] font-bold text-white press-strong transition-transform flex items-center justify-center gap-1.5 disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {locating ? (<><Loader2 size={15} className="animate-spin" /> 위치 확인 중…</>) : "지금 위치 링크 만들기"}
        </button>
      ) : (
        <div className="space-y-2">
          <button
            onClick={shareViaSheet}
            className="w-full rounded-xl py-3 text-[15px] font-bold text-white press-strong transition-transform flex items-center justify-center gap-1.5"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Share2 size={15} /> 공유로 보내기 (카톡·문자 등)
          </button>
          {guardians.map((g, i) => (
            <a
              key={`${g.phone}-${i}`}
              href={smsHref(g.phone, shareText)}
              className="w-full rounded-xl py-3 text-[15px] font-bold press-strong transition-transform flex items-center justify-center gap-1.5"
              style={{ backgroundColor: "#fff", color: "var(--color-text-main)", border: "1px solid var(--color-divider)" }}
            >
              <MessageSquare size={15} className="text-primary" /> {g.name}에게 문자 보내기
            </a>
          ))}
          <button onClick={getLocation} className="w-full text-[11px] text-text-light underline underline-offset-2 pt-0.5">
            위치 다시 확인하기
          </button>
        </div>
      )}

      {error && (
        <p className="text-[13px] font-bold mt-2" style={{ color: "#B84545" }}>{error}</p>
      )}

      {/* 보호 연락처 관리 — 내 폰(localStorage)에만 저장 */}
      <div className="mt-3 pt-2.5" style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-text-sub">보호 연락처 (내 폰에만 저장 · 최대 {MAX_GUARDIANS}명)</span>
          {guardians.length < MAX_GUARDIANS && (
            <button onClick={() => setAddOpen((v) => !v)} className="text-[11px] font-bold text-primary flex items-center gap-0.5 press-strong">
              <Plus size={12} /> 추가
            </button>
          )}
        </div>
        {guardians.length === 0 && !addOpen && (
          <p className="text-[11px] text-text-light mt-1">미리 등록해두면 위급할 때 한 번에 문자를 보낼 수 있어요.</p>
        )}
        {guardians.map((g, i) => (
          <div key={`${g.phone}-list-${i}`} className="flex items-center justify-between mt-1.5">
            <span className="text-[13px] text-text-main font-semibold">{g.name} <span className="text-text-light font-normal">{g.phone}</span></span>
            <button onClick={() => removeGuardian(i)} className="p-1.5 press-strong" aria-label={`${g.name} 삭제`}>
              <Trash2 size={13} className="text-text-light" />
            </button>
          </div>
        ))}
        {addOpen && (
          <div className="flex gap-1.5 mt-2">
            <input
              value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="별칭 (예: 언니)"
              className="w-24 px-2.5 py-2 rounded-lg text-[13px] outline-none bg-white" maxLength={10}
            />
            <input
              value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="전화번호" inputMode="tel"
              className="flex-1 px-2.5 py-2 rounded-lg text-[13px] outline-none bg-white" maxLength={16}
            />
            <button onClick={addGuardian} className="px-3 rounded-lg text-[13px] font-bold text-white press-strong" style={{ backgroundColor: "var(--color-primary)" }}>
              저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
