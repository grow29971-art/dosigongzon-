import { useEffect, useRef } from "react";
import { loadKakao } from "../lib/kakao";
import type { Cat } from "../lib/data";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CENTER_KEY = "dosigongzon-toss-map-center";
const SEOUL = { lat: 37.5665, lng: 126.978, level: 6 };

function readCenter(): { lat: number; lng: number; level: number } {
  try {
    const raw = localStorage.getItem(CENTER_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (typeof c.lat === "number" && typeof c.lng === "number") return { level: 5, ...c };
    }
  } catch { /* 저장소 없음 — 기본값 */ }
  return SEOUL;
}

interface Props {
  cats: Cat[];
  onSelect: (cat: Cat) => void;
}

// 지도 본체. 위치 권한은 쓰지 않는다 — 마지막 본 위치(localStorage)나 서울 중심에서 시작.
export default function CatMap({ cats, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    loadKakao().then((kakao) => {
      if (disposed || !el.current) return;
      const c = readCenter();
      const map = new kakao.maps.Map(el.current, {
        center: new kakao.maps.LatLng(c.lat, c.lng),
        level: c.level,
      });
      mapRef.current = map;
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 5, disableClickZoom: false,
        styles: [{
          width: "36px", height: "36px", lineHeight: "36px", borderRadius: "18px",
          background: "rgba(173,94,59,0.9)", color: "#fff", textAlign: "center", fontSize: "13px", fontWeight: "700",
        }],
      });
      kakao.maps.event.addListener(map, "idle", () => {
        const ct = map.getCenter();
        try { localStorage.setItem(CENTER_KEY, JSON.stringify({ lat: ct.getLat(), lng: ct.getLng(), level: map.getLevel() })); } catch { /* noop */ }
      });
      renderMarkers(kakao);
    }).catch((e) => console.error(e));
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderMarkers(kakao: any) {
    const clusterer = clustererRef.current;
    if (!clusterer) return;
    clusterer.removeMarkers(markersRef.current);
    markersRef.current = cats.map((cat) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(cat.lat, cat.lng),
        title: cat.name,
      });
      kakao.maps.event.addListener(marker, "click", () => onSelectRef.current(cat));
      return marker;
    });
    clusterer.addMarkers(markersRef.current);
  }

  useEffect(() => {
    if (window.kakao?.maps && mapRef.current) renderMarkers(window.kakao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats]);

  return <div ref={el} style={{ position: "absolute", inset: 0 }} />;
}
