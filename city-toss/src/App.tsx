import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/app/components/Toast";
import BottomNav from "@/app/components/BottomNav";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import ServerPage from "./ServerPage";
import { isMiniAppBlockedPath } from "./shims/miniapp-routes";
import { ErrorBoundary, ErrorToast } from "./ErrorOverlay";

// 본 앱 화면을 그대로 라우팅한다. "use client" 페이지는 lazy 컴포넌트로, async 서버 페이지는 ServerPage 어댑터로.
// 미니앱 제외 경로(shims/miniapp-routes.ts)는 홈으로 보낸다.
const C = (load: () => Promise<{ default: ComponentType }>) => {
  const L = lazy(load);
  return <Suspense fallback={<Loading />}><L /></Suspense>;
};
const S = (load: () => Promise<{ default: unknown }>) => <ServerPage load={load as never} />;
// params Promise를 받는 "use client" 페이지(use(params) 패턴)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParamsPage = ComponentType<{ params: Promise<any> }>;
function WithParams({ Page }: { Page: ParamsPage }) {
  const params = useParams();
  const clean = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? ""]));
  return <Page params={Promise.resolve(clean)} />;
}
const P = (load: () => Promise<{ default: ParamsPage }>) => {
  const L = lazy(load);
  return <Suspense fallback={<Loading />}><WithParams Page={L} /></Suspense>;
};

function BackToLogin() {
  const nav = useNavigate();
  return (
    <button type="button" className="m-4 text-[14px] underline" style={{ color: "var(--color-text-sub)" }} onClick={() => nav("/")}>← 돌아가기</button>
  );
}

function Loading() {
  return <div className="flex items-center justify-center min-h-[50vh] text-sm" style={{ color: "var(--color-text-light)" }}>불러오는 중…</div>;
}

const MapIntroSheet = lazy(() => import("@/app/components/MapIntroSheet"));

function Shell() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  if (isMiniAppBlockedPath(pathname)) return <Navigate to="/" replace />;
  return (
    <div className="min-h-dvh" style={{ background: "var(--color-surface)" }}>
      <ErrorToast />
      <main className="pb-24 mx-auto w-full max-w-lg">
        <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={C(() => import("./pages/Home"))} />
          <Route path="/map" element={<><Suspense fallback={null}><MapIntroSheet /></Suspense>{C(() => import("@/app/(main)/map/page"))}</>} />
          <Route path="/cats/:id" element={S(() => import("@/app/(main)/cats/[id]/page"))} />
          <Route path="/cats/:id/report" element={S(() => import("@/app/(main)/cats/[id]/report/page"))} />
          <Route path="/community" element={C(() => import("@/app/(main)/community/page"))} />
          <Route path="/community/popular" element={S(() => import("@/app/(main)/community/popular/page"))} />
          <Route path="/community/write" element={C(() => import("@/app/(main)/community/write/page"))} />
          <Route path="/community/category/:cat" element={C(() => import("@/app/(main)/community/category/[cat]/page"))} />
          <Route path="/community/:id" element={P(() => import("@/app/(main)/community/[id]/page"))} />
          <Route path="/hospitals" element={C(() => import("@/app/(main)/hospitals/page"))} />
          <Route path="/shelters" element={S(() => import("@/app/(main)/shelters/page"))} />
          <Route path="/memorial" element={C(() => import("@/app/(main)/memorial/page"))} />
          <Route path="/memorial/:id" element={S(() => import("@/app/(main)/memorial/[id]/page"))} />
          <Route path="/mypage" element={C(() => import("@/app/(main)/mypage/page"))} />
          <Route path="/mypage/activity-regions" element={C(() => import("@/app/(main)/mypage/activity-regions/page"))} />
          <Route path="/mypage/blocked-users" element={C(() => import("@/app/(main)/mypage/blocked-users/page"))} />
          <Route path="/mypage/inquiries" element={C(() => import("@/app/(main)/mypage/inquiries/page"))} />
          <Route path="/mypage/watching" element={C(() => import("@/app/(main)/mypage/watching/page"))} />
          <Route path="/mypage/journey" element={S(() => import("@/app/(main)/mypage/journey/page"))} />
          <Route path="/mypage/monthly-report" element={S(() => import("@/app/(main)/mypage/monthly-report/page"))} />
          <Route path="/mypage/report" element={S(() => import("@/app/(main)/mypage/report/page"))} />
          <Route path="/neighborhood" element={C(() => import("@/app/(main)/neighborhood/page"))} />
          <Route path="/news" element={S(() => import("@/app/(main)/news/page"))} />
          <Route path="/news/:id" element={P(() => import("@/app/(main)/news/[id]/page"))} />
          <Route path="/notifications" element={C(() => import("@/app/(main)/notifications/page"))} />
          <Route path="/protection" element={C(() => import("@/app/(main)/protection/page"))} />
          <Route path="/protection/district-contacts" element={C(() => import("@/app/(main)/protection/district-contacts/page"))} />
          <Route path="/protection/disease-guide" element={S(() => import("@/app/(main)/protection/disease-guide/page"))} />
          <Route path="/protection/emergency-guide" element={S(() => import("@/app/(main)/protection/emergency-guide/page"))} />
          <Route path="/protection/feeding-guide" element={S(() => import("@/app/(main)/protection/feeding-guide/page"))} />
          <Route path="/protection/kitten-guide" element={S(() => import("@/app/(main)/protection/kitten-guide/page"))} />
          <Route path="/protection/legal" element={S(() => import("@/app/(main)/protection/legal/page"))} />
          <Route path="/protection/pharmacy-guide" element={S(() => import("@/app/(main)/protection/pharmacy-guide/page"))} />
          <Route path="/protection/shelter-guide" element={S(() => import("@/app/(main)/protection/shelter-guide/page"))} />
          <Route path="/protection/trapping-guide" element={S(() => import("@/app/(main)/protection/trapping-guide/page"))} />
          <Route path="/ranking" element={S(() => import("@/app/(main)/ranking/page"))} />
          <Route path="/rescue" element={S(() => import("@/app/(main)/rescue/page"))} />
          <Route path="/caretakers" element={S(() => import("@/app/(main)/caretakers/page"))} />
          <Route path="/search" element={C(() => import("@/app/(main)/search/page"))} />
          <Route path="/collection" element={C(() => import("@/app/(main)/collection/page"))} />
          <Route path="/tips" element={S(() => import("@/app/(main)/tips/page"))} />
          <Route path="/tips/:slug" element={S(() => import("@/app/(main)/tips/[slug]/page"))} />
          <Route path="/users/:id" element={S(() => import("@/app/(main)/users/[id]/page"))} />
          <Route path="/event/keyring" element={C(() => import("@/app/(main)/event/keyring/page"))} />
          <Route path="/experiment" element={C(() => import("@/app/(main)/experiment/page"))} />
          <Route path="/about" element={S(() => import("@/app/about/page"))} />
          <Route path="/faq" element={S(() => import("@/app/faq/page"))} />
          <Route path="/guide" element={S(() => import("@/app/guide/page"))} />
          <Route path="/maker" element={S(() => import("@/app/maker/page"))} />
          <Route path="/privacy" element={S(() => import("@/app/privacy/page"))} />
          <Route path="/terms" element={S(() => import("@/app/terms/page"))} />
          <Route path="/account-deletion" element={S(() => import("@/app/account-deletion/page"))} />
          <Route path="/celebrate" element={S(() => import("@/app/celebrate/page"))} />
          <Route path="/areas" element={S(() => import("@/app/areas/page"))} />
          <Route path="/areas/:slug" element={S(() => import("@/app/areas/[slug]/page"))} />
          <Route path="/areas/:slug/:dong" element={S(() => import("@/app/areas/[slug]/[dong]/page"))} />
          <Route path="/regions" element={S(() => import("@/app/regions/page"))} />
          <Route path="/regions/:sido" element={S(() => import("@/app/regions/[sido]/page"))} />
          <Route path="/z/:zoneId" element={S(() => import("@/app/z/[zoneId]/page"))} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}

// 세션이 없으면 어느 경로든 토스 로그인 화면. 세션이 생기면 그 경로로 진행.
export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = supabase();
    // 로컬 개발 전용: ?dev_anon=1 이면 세션 없이 화면을 연다(anon RLS로 공개 데이터만 보임, 렌더 점검용)
    const devAnon = import.meta.env.DEV && new URLSearchParams(window.location.search).has("dev_anon");
    sb.auth.getSession().then(({ data }) => setAuthed(!!data.session || devAnon));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setAuthed(!!session || devAnon));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) return <Loading />;

  return (
    // HashRouter: 토스 정적 호스팅은 /mypage 같은 중첩 경로의 직접 로드(새로고침·백그라운드 복귀·본 앱 코드의 location.href 대입)를
    // 보장하지 않는다. 해시 라우팅이면 전체 로드가 항상 index.html로 떨어진다.
    <HashRouter>
      {authed ? (
        <AuthProvider>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </AuthProvider>
      ) : (
        // 비로그인: 로그인 화면 + 약관·처리방침(앱 안에서 읽을 수 있어야 한다 — 외부 브라우저 의존 금지)
        <Routes>
          <Route path="/terms" element={<div className="mx-auto w-full max-w-lg"><BackToLogin />{S(() => import("@/app/terms/page"))}</div>} />
          <Route path="/privacy" element={<div className="mx-auto w-full max-w-lg"><BackToLogin />{S(() => import("@/app/privacy/page"))}</div>} />
          <Route path="*" element={<Login onLoggedIn={() => setAuthed(true)} />} />
        </Routes>
      )}
    </HashRouter>
  );
}
