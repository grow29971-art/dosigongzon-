import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  CARE_LABEL, CARE_TYPES, createCareLog, getCat, listCareLogs, relativeTime,
  type Cat, type CareLog, type CareType,
} from "../lib/data";

export default function CatDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [cat, setCat] = useState<Cat | null | undefined>(undefined);
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [type, setType] = useState<CareType>("feed");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    getCat(id).then(setCat).catch(() => setCat(null));
    listCareLogs(id).then(setLogs);
  }, [id]);

  async function submit() {
    setBusy(true); setError(null); setDone(null);
    try {
      const log = await createCareLog({ cat_id: id, care_type: type, memo });
      setLogs((prev) => [log, ...prev]);
      setMemo("");
      setDone(`${CARE_LABEL[type]} 기록을 남겼어요`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  if (cat === undefined) return <div className="center">불러오는 중…</div>;
  if (cat === null) return <div className="center">고양이를 찾을 수 없어요</div>;

  return (
    <div className="page">
      <div className="topbar">
        <button className="back" type="button" aria-label="뒤로" onClick={() => nav(-1)}>←</button>
        <span className="name">{cat.name}</span>
      </div>
      {cat.photo_url ? <img className="thumb-lg" src={cat.photo_url} alt={cat.name} /> : <div className="thumb-lg" />}
      <p className="muted" style={{ marginTop: 8 }}>
        {cat.region ?? "동네"} · 돌봄 레벨 {cat.card_level ?? 1}
        {cat.neutered === true ? " · 중성화 완료" : cat.neutered === false ? " · 중성화 전" : ""}
        {cat.caretaker_name ? ` · 돌보는 사람 ${cat.caretaker_name}` : ""}
      </p>
      {cat.description && <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-sub)" }}>{cat.description}</p>}

      <div className="hr" />
      <p style={{ margin: 0, fontWeight: 800 }}>오늘 뭐 해줬어요?</p>
      <div className="chips">
        {CARE_TYPES.map((t) => (
          <button key={t.key} type="button" className={`chip${type === t.key ? " on" : ""}`} onClick={() => setType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        className="textarea"
        placeholder="메모 (선택) — 위치를 특정할 수 있는 내용은 적지 말아 주세요"
        value={memo}
        maxLength={300}
        onChange={(e) => setMemo(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      {done && <p className="muted" style={{ color: "var(--primary)" }}>{done}</p>}
      <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={submit}>
        {busy ? "저장 중…" : "돌봄 기록 남기기"}
      </button>

      <div className="hr" />
      <p style={{ margin: "0 0 4px", fontWeight: 800 }}>최근 돌봄 기록</p>
      {logs.length === 0 ? (
        <p className="muted">아직 기록이 없어요. 첫 기록을 남겨 주세요.</p>
      ) : (
        logs.map((l) => (
          <div className="log" key={l.id}>
            <span className="log-type">{CARE_LABEL[l.care_type] ?? l.care_type}</span>
            <span style={{ color: "var(--text-sub)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {l.memo ?? ""}
            </span>
            <span className="log-meta">{l.author_name ?? "길집사"} · {relativeTime(l.logged_at)}</span>
          </div>
        ))
      )}
    </div>
  );
}
