"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || url === "YOUR_SUPABASE_URL") {
      setLoading(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let cancelled = false;

    import("@/lib/supabase/client").then(({ createClient }) => {
      if (cancelled) return;
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event: string, session: { user: User | null } | null) => {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );
      unsub = () => subscription.unsubscribe();
    }).catch(() => {
      // 배포 직후 stale chunk 등으로 클라이언트 로드 실패 시 무한 로딩 방지 —
      // 게이트를 풀어 비로그인 상태로라도 앱이 뜨게 한다.
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const signOut = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
