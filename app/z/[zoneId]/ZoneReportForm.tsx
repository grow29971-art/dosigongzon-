"use client";

// QR 지킴판 익명 제보 폼 (B-1)
// - 로그인 불필요·제보자 정보(GPS·계정·연락처) 미수집. 위치 태깅은 zone_id로만.
// - 구조화 선택지 + 선택 자유서술(사법 이관용, 화면 비공개)만 전송.
// - 전송 전 Turnstile 봇 검증 필수 (서버에서 재검증).

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import TurnstileWidget from "@/app/components/TurnstileWidget";

const INCIDENT_OPTIONS = [
  { value: "violence", label: "폭행·위협 목격" },
  { value: "poison_suspect", label: "독극물·이상한 먹이 의심" },
  { value: "trap_suspect", label: "불법 포획틀·덫 의심" },
  { value: "shelter_damage", label: "급식소·쉼터 훼손" },
  { value: "abandonment", label: "유기 목격" },
  { value: "other", label: "기타" },
] as const;

const WHEN_OPTIONS = [
  { value: "now", label: "지금(방금)" },
  { value: "hours_ago", label: "몇 시간 전" },
  { value: "today", label: "오늘 중" },
  { value: "yesterday", label: "어제" },
  { value: "earlier", label: "그 이전" },
  { value: "unknown", label: "모름" },
] as const;

const STATUS_OPTIONS = [
  { value: "fine", label: "무사해 보임" },
  { value: "injured", label: "다침" },
  { value: "dead", label: "죽음" },
  { value: "missing", label: "보이지 않음" },
  { value: "unknown", label: "모름" },
] as const;

export default function ZoneReportForm({ zoneId }: { zoneId: string }) {
  const [incidentType, setIncidentType] = useState("");
  const [occurredWhen, setOccurredWhen] = useState("");
  const [animalStatus, setAnimalStatus] = useState("");
  const [detail, setDetail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!incidentType || !occurredWhen || !animalStatus) {
      setError("세 가지 항목을 모두 선택해주세요.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/zone-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone_id: zoneId,
          incident_type: incidentType,
          occurred_when: occurredWhen,
          animal_status: animalStatus,
          detail: detail.trim() || undefined,
          token,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "접수에 실패했어요.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "접수에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl px-5 py-6 text-center" style={{ backgroundColor: "#F0F7F1", border: "1px solid #CFE3D2" }}>
        <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#4A7B52" }} />
        <p className="text-[15px] font-extrabold text-text-main">제보가 접수됐어요</p>
        <p className="text-[12px] text-text-sub mt-1.5 leading-relaxed">
          운영팀이 확인 후 필요 시 경찰·동물보호센터로 전달해요.
          <br />
          <b>지금 진행 중인 위급 상황이라면 112에 직접 전화해주세요.</b>
        </p>
        <a href="tel:112" className="inline-block mt-3 px-5 py-2.5 rounded-xl text-[13px] font-extrabold text-white" style={{ backgroundColor: "var(--color-primary)" }}>
          112 전화 걸기
        </a>
      </div>
    );
  }

  const chip = (selected: boolean) =>
    `px-3 py-2 rounded-xl text-[12.5px] font-bold active:scale-95 transition-transform ${
      selected ? "text-white" : "text-text-sub"
    }`;
  const chipStyle = (selected: boolean) => ({
    backgroundColor: selected ? "var(--color-primary)" : "var(--color-surface-alt)",
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-extrabold text-text-main mb-1.5">무엇을 보셨나요?</p>
        <div className="flex flex-wrap gap-1.5">
          {INCIDENT_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setIncidentType(o.value)} className={chip(incidentType === o.value)} style={chipStyle(incidentType === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-extrabold text-text-main mb-1.5">언제쯤이었나요?</p>
        <div className="flex flex-wrap gap-1.5">
          {WHEN_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setOccurredWhen(o.value)} className={chip(occurredWhen === o.value)} style={chipStyle(occurredWhen === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-extrabold text-text-main mb-1.5">동물 상태는요?</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setAnimalStatus(o.value)} className={chip(animalStatus === o.value)} style={chipStyle(animalStatus === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-extrabold text-text-main mb-1">상세 설명 (선택)</p>
        <p className="text-[10.5px] text-text-light mb-1.5 leading-relaxed">
          기관 전달용으로만 쓰이고 화면에 공개되지 않아요. <b>사람의 이름·차량번호·얼굴 등 신원 정보는 적지 말아주세요.</b>
        </p>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="상황을 담백하게 적어주세요 (최대 500자)"
          className="w-full px-3.5 py-3 rounded-xl text-[13px] outline-none resize-none"
          style={{ backgroundColor: "var(--color-surface-alt)" }}
        />
      </div>

      <TurnstileWidget onVerify={setToken} onExpire={() => setToken(null)} onError={() => setToken(null)} />

      {error && <p className="text-[12.5px] font-bold" style={{ color: "#B84545" }}>{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-2xl py-4 text-[15px] font-extrabold text-white active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-1.5"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {submitting ? (<><Loader2 size={16} className="animate-spin" /> 접수 중…</>) : "익명으로 제보하기"}
      </button>

      <p className="text-[10.5px] text-text-light text-center leading-relaxed">
        제보자의 위치·계정·연락처는 수집하지 않아요 · 접수 내용은 90일 후 자동 파기돼요
      </p>
    </div>
  );
}
