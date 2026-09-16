"use client";

import { useEffect, useState } from "react";
import { Flower2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toggleMemorialFlower } from "@/lib/cats-repo";
import { useToast } from "@/app/components/Toast";

/** 추모관 헌화 — 계정당 1회 토글. 목록(/memorial)과 같은 규칙. */
export default function MemorialFlowerButton({ catId }: { catId: string }) {
  const toast = useToast();
  const [count, setCount] = useState<number | null>(null);
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const [{ count: total }, { data: auth }] = await Promise.all([
        supabase.from("memorial_flowers").select("id", { count: "exact", head: true }).eq("cat_id", catId),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      setCount(total ?? 0);

      if (auth.user) {
        const { data } = await supabase
          .from("memorial_flowers")
          .select("id")
          .eq("cat_id", catId)
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (!cancelled) setMine(Boolean(data));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catId]);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    const was = mine;
    setMine(!was);
    setCount((c) => (c ?? 0) + (was ? -1 : 1));
    try {
      await toggleMemorialFlower(catId);
    } catch (err) {
      setMine(was);
      setCount((c) => (c ?? 0) + (was ? 1 : -1));
      toast.error(err instanceof Error ? err.message : "헌화하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handle}
      className="w-full h-[50px] rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold press transition-transform"
      style={{
        background: mine ? "rgba(255,233,168,0.92)" : "rgba(255,255,255,0.1)",
        color: mine ? "#3a2c4d" : "rgba(255,255,255,0.82)",
      }}
    >
      <Flower2 size={16} />
      {mine ? "헌화했어요" : "헌화하기"}
      {count !== null && count > 0 && ` ${count}`}
    </button>
  );
}
