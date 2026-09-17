import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import MapPage from "./pages/MapPage";
import CatDetail from "./pages/CatDetail";

// 세션이 없으면 어느 경로든 로그인 화면. 세션이 생기면 그 경로로 진행.
export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) return <div className="center">잠시만요…</div>;
  if (!authed) return <Login onLoggedIn={() => setAuthed(true)} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/cats/:id" element={<CatDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
