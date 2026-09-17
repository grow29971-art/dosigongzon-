import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import CatMap from "../components/CatMap";
import { listCats, type Cat } from "../lib/data";

export default function MapPage() {
  const nav = useNavigate();
  const [cats, setCats] = useState<Cat[]>([]);
  const [selected, setSelected] = useState<Cat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCats().then(setCats).catch((e) => setError(e instanceof Error ? e.message : "불러오기 실패"));
  }, []);

  return (
    <div className="map-wrap">
      <CatMap cats={cats} onSelect={setSelected} />
      <div className="map-top">
        <span className="pill">동네 고양이 {cats.length}마리</span>
        {error && <span className="pill" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
      {selected && (
        <div className="sheet" role="button" onClick={() => nav(`/cats/${selected.id}`)}>
          {selected.photo_url
            ? <img className="thumb" src={selected.photo_url} alt="" />
            : <div className="thumb" />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="name">{selected.name}</div>
            <div className="muted">
              {selected.region ?? "동네"} · 돌봄 레벨 {selected.card_level ?? 1}
              {selected.caretaker_name ? ` · ${selected.caretaker_name}` : ""}
            </div>
          </div>
          <button className="btn btn-sm" type="button">기록하기</button>
        </div>
      )}
    </div>
  );
}
