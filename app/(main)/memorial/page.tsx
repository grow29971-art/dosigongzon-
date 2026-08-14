"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, Flower2, Undo2, Info, Trash2 } from "lucide-react";
import {
  listMemorialCats,
  listMyFlowerCatIds,
  toggleMemorialFlower,
  restoreCatFromStar,
  type MemorialCat,
} from "@/lib/cats-repo";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { deleteCatByAdmin } from "@/lib/support-repo";
import CatStarPlanet from "@/app/components/CatStarPlanet";

// 배경 별 — id 없이 페이지 고정 시드
function makeStars(count: number) {
  let h = 917503;
  const next = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: count }, () => {
    const depth = next();               // 0=먼 별(작고 흐림), 1=가까운 별(크고 밝음)
    return {
      left: next() * 100,
      top: next() * 100,
      size: depth > 0.92 ? 2.6 + next() * 1.4 : depth > 0.65 ? 1.4 + next() : 0.7 + next() * 0.6,
      delay: next() * 6,
      dur: 2.6 + next() * 3.4,
      opacity: depth > 0.92 ? 0.85 : depth > 0.65 ? 0.45 + next() * 0.35 : 0.18 + next() * 0.25,
    };
  });
}

/**
 * 고양이별 안내.
 * 이 공간이 "삭제 대신"이라는 걸 모르면 아이를 지워버리게 되고, 그러면
 * care_logs·카드·댓글이 CASCADE 로 함께 사라진다 — 되돌릴 수 없다.
 * 그래서 무엇이 남고 무엇이 사라지는지를 분명히 적는다.
 */
function MemorialAbout({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  // 목록 로딩이 끝난 뒤 기본 상태를 정한다(사용자가 직접 여닫았으면 존중)
  useEffect(() => {
    if (!touched) setOpen(defaultOpen);
  }, [defaultOpen, touched]);

  const toggle = () => {
    setTouched(true);
    setOpen((v) => !v);
  };

  return (
    <div
      style={{
        borderRadius: 20,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.11)",
      }}
    >
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <Info size={15} color="rgba(255,233,168,0.9)" />
        <span className="text-[14px] font-bold text-white flex-1">고양이별은 어떤 곳인가요?</span>
        <ChevronDown
          size={16}
          color="rgba(255,255,255,0.5)"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5" style={{ animation: "memFadeIn 300ms ease both" }}>
          <p className="text-[14px] leading-[1.85]" style={{ color: "rgba(255,255,255,0.72)" }}>
            길에서 살아가는 아이들은 언젠가 먼저 떠납니다. 그때 지도에서 이름을 지워버리면
            함께한 시간까지 없던 일이 되는 것 같습니다. 고양이별은 그 아이들이 머무는 곳이에요.
            지도에서만 내려올 뿐, <b className="text-white">이름도 사진도 그동안의 돌봄 기록도 그대로 남습니다.</b>
          </p>

          <div className="mt-5 flex flex-col gap-3.5">
            <div>
              <p className="text-[13px] font-bold" style={{ color: "rgba(255,233,168,0.9)" }}>
                어떻게 보내나요
              </p>
              <p className="text-[13px] leading-[1.8] mt-1" style={{ color: "rgba(255,255,255,0.66)" }}>
                지도에서 아이를 누르고 별 버튼(⭐)을 누르면 됩니다. 마지막 인사를 함께 남길 수 있어요.
                등록한 분과 관리자만 보낼 수 있고, 잘못 보냈다면 여기서 다시 지도로 되돌릴 수 있습니다.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-bold" style={{ color: "rgba(255,233,168,0.9)" }}>
                삭제와 무엇이 다른가요
              </p>
              <p className="text-[13px] leading-[1.8] mt-1" style={{ color: "rgba(255,255,255,0.66)" }}>
                삭제는 돌봄 일지와 사진, 카드까지 <b className="text-white">전부 함께 지워지고 되돌릴 수 없습니다.</b>
                {" "}고양이별로 보내면 지도에서만 내려오고 기록은 남습니다.
                건강 알림도 더 이상 가지 않아요.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-bold" style={{ color: "rgba(255,233,168,0.9)" }}>
                여기서 할 수 있는 일
              </p>
              <p className="text-[13px] leading-[1.8] mt-1" style={{ color: "rgba(255,255,255,0.66)" }}>
                아이를 누르면 그동안의 돌봄 기록을 날짜별로 전부 볼 수 있어요.
                헌화는 기억하고 있다는 표시예요 — 같은 아이를 돌봤던 이웃들의 헌화도 함께 쌓입니다.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-bold" style={{ color: "rgba(255,233,168,0.9)" }}>
                추모일기
              </p>
              <p className="text-[13px] leading-[1.8] mt-1" style={{ color: "rgba(255,255,255,0.66)" }}>
                떠나보낸 뒤 하고 싶은 말을 하나씩 적어두는 자리예요. 기본은 나만 보기고,
                한 줄이어도 괜찮아요. <b className="text-white">며칠 걸러도, 그만 써도 아무 표시가 남지 않아요</b> —
                연속 일수를 세지 않으니까요. 괜찮아지면 안 쓰게 되는 게 맞습니다.
              </p>
            </div>
          </div>

          <p
            className="text-[12px] leading-[1.75] mt-5 px-4 py-3"
            style={{ color: "rgba(255,255,255,0.5)", background: "rgba(0,0,0,0.18)", borderRadius: 12 }}
          >
            떠나보내는 일을 서두르지 않으셔도 돼요. 며칠 보이지 않는 것과 떠난 것은 다르니까요.
          </p>
        </div>
      )}
    </div>
  );
}

function daysBetween(from: string, to: string) {
  const d = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  return Math.max(d, 0);
}

export default function MemorialPage() {
  const toast = useToast();
  const [cats, setCats] = useState<MemorialCat[] | null>(null);
  const [flowered, setFlowered] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  // 보내기는 등록자 또는 관리자가 할 수 있는데(map/page.tsx:2963) 되돌리기는
  // 등록자만 볼 수 있었다. 관리자가 보낸 아이는 되돌릴 UI가 없었다 (2026-08-09 수정)
  const [isAdmin, setIsAdmin] = useState(false);
  // 관리자 영구 삭제 — 이름을 직접 입력받는다(CASCADE 라 복구 없음)
  const [deleteTarget, setDeleteTarget] = useState<MemorialCat | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const stars = useMemo(() => makeStars(70), []);

  const load = useCallback(async () => {
    try {
      const [list, mine] = await Promise.all([listMemorialCats(), listMyFlowerCatIds()]);
      setCats(list);
      setFlowered(mine);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "고양이별을 불러오지 못했어요");
      setCats([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void (async () => {
      const { data } = await createClient().auth.getUser();
      setUserId(data.user?.id ?? null);
      if (data.user) setIsAdmin(await isCurrentUserAdmin());
    })();
  }, [load]);

  const handleFlower = async (catId: string) => {
    // 낙관적 갱신 — 실패하면 되돌린다
    const was = flowered.has(catId);
    setFlowered((prev) => {
      const n = new Set(prev);
      if (was) n.delete(catId); else n.add(catId);
      return n;
    });
    setCats((prev) =>
      prev?.map((c) => (c.id === catId ? { ...c, flower_count: c.flower_count + (was ? -1 : 1) } : c)) ?? prev,
    );
    try {
      await toggleMemorialFlower(catId);
    } catch (err) {
      setFlowered((prev) => {
        const n = new Set(prev);
        if (was) n.add(catId); else n.delete(catId);
        return n;
      });
      setCats((prev) =>
        prev?.map((c) => (c.id === catId ? { ...c, flower_count: c.flower_count + (was ? 1 : -1) } : c)) ?? prev,
      );
      toast.error(err instanceof Error ? err.message : "헌화하지 못했어요");
    }
  };

  // 관리자 영구 삭제. deleteCatByAdmin 은 requireAdmin() 을 거치고
  // DB 쪽에도 cats_delete_admin 정책이 있어 UI가 뚫려도 서버에서 한 번 더 막힌다.
  const handleAdminDelete = async () => {
    if (!deleteTarget || deleting) return;
    if (deleteText.trim() !== deleteTarget.name) return;
    setDeleting(true);
    try {
      await deleteCatByAdmin(deleteTarget.id);
      setCats((prev) => prev?.filter((c) => c.id !== deleteTarget.id) ?? prev);
      toast.success(`${deleteTarget.name}(을)를 삭제했어요`);
      setDeleteTarget(null);
      setDeleteText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제하지 못했어요");
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (cat: MemorialCat) => {
    if (!confirm(`${cat.name}(이)를 다시 지도로 되돌릴까요?`)) return;
    try {
      await restoreCatFromStar(cat.id);
      setCats((prev) => prev?.filter((c) => c.id !== cat.id) ?? prev);
      toast.success(`${cat.name}(이)가 지도로 돌아왔어요`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "되돌리지 못했어요");
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{ background: "linear-gradient(180deg, #07060F 0%, #140F26 34%, #241B3B 68%, #33254A 100%)" }}
    >
      {/* 성운 — 큰 반경 그라디언트 두 겹. 단색 밤하늘의 밋밋함을 없앤다 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 40% at 18% 12%, rgba(120,86,190,0.30), transparent 70%)",
            "radial-gradient(ellipse 60% 35% at 88% 34%, rgba(64,96,180,0.24), transparent 72%)",
            "radial-gradient(ellipse 90% 30% at 50% 96%, rgba(180,110,90,0.16), transparent 75%)",
          ].join(","),
        }}
      />

      {/* 별밭 — 크기·밝기가 다른 세 겹이라 깊이가 생긴다 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              background: "#fff",
              opacity: s.opacity,
              boxShadow: s.size > 2 ? `0 0 ${s.size * 2.5}px rgba(255,255,255,0.55)` : undefined,
              animation: `memStarTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}

        {/* 별똥별 — 아주 가끔만 지나간다 */}
        {[
          { top: "12%", left: "-10%", delay: 6, dur: 2.6 },
          { top: "38%", left: "-14%", delay: 21, dur: 3.1 },
        ].map((m, i) => (
          <span
            key={`meteor-${i}`}
            className="absolute"
            style={{
              top: m.top,
              left: m.left,
              width: 120,
              height: 1.5,
              background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 70%, #fff 100%)",
              borderRadius: 2,
              opacity: 0,
              transform: "rotate(18deg)",
              animation: `memMeteor ${m.dur}s ease-in ${m.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative px-5 pb-28" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        {/* 헤더 */}
        <div className="flex items-center gap-2 py-3">
          <Link
            href="/map"
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(255,255,255,0.1)" }}
            aria-label="뒤로"
          >
            <ChevronLeft size={20} color="#fff" />
          </Link>
        </div>

        <div className="flex flex-col items-center text-center pt-4 pb-10">
          {/* 곁별 수 = 고양이별에 온 아이 수 */}
          <CatStarPlanet size={148} companions={cats?.length ?? 0} />
          <h1 className="text-[24px] font-bold text-white mt-1">고양이별</h1>
          <p className="text-[14px] leading-[1.7] mt-3" style={{ color: "rgba(255,255,255,0.62)" }}>
            먼저 떠난 아이들이 머무는 곳이에요.
            <br />
            이름과 돌본 기록은 지워지지 않아요.
          </p>
        </div>

        {/* 고양이별 안내 — 아이가 없을 땐 펼친 채로, 있을 땐 접어서 목록을 먼저 보여준다 */}
        <MemorialAbout defaultOpen={cats !== null && cats.length === 0} />

        {/* 목록 */}
        {cats === null && (
          <p className="text-center text-[14px] mt-10" style={{ color: "rgba(255,255,255,0.45)" }}>
            불러오는 중…
          </p>
        )}

        {cats?.length === 0 && (
          <div className="text-center pt-12 pb-6">
            <p className="text-[15px] leading-[1.8]" style={{ color: "rgba(255,255,255,0.55)" }}>
              아직 고양이별에 온 아이가 없어요.
              <br />
              모두 잘 지내고 있다는 뜻이에요.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center justify-center h-[46px] px-6 rounded-2xl mt-7 text-[14px] font-bold"
              style={{ background: "rgba(255,255,255,0.92)", color: "#3a2c4d" }}
            >
              지도로 돌아가기
            </Link>
          </div>
        )}

        {cats !== null && cats.length > 0 && <div className="h-8" />}

        <div className="flex flex-col gap-4">
          {cats?.map((cat) => {
            const cared = daysBetween(cat.created_at, cat.memorial_at);
            const canRestore = Boolean(userId && (cat.caretaker_id === userId || isAdmin));
            return (
              <div
                key={cat.id}
                className="p-5"
                style={{
                  borderRadius: 22,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div className="flex items-start gap-4">
                  <Link href={`/memorial/${cat.id}`} className="shrink-0">
                    <div
                      className="rounded-full overflow-hidden"
                      style={{
                        width: 72,
                        height: 72,
                        border: "2px solid rgba(255,233,168,0.5)",
                        boxShadow: "0 0 22px rgba(255,233,168,0.28)",
                        background: "#2a2340",
                      }}
                    >
                      {sanitizeImageUrl(cat.photo_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sanitizeImageUrl(cat.photo_url)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[28px]">🐈</div>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/memorial/${cat.id}`}>
                      <h2 className="text-[17px] font-bold text-white truncate">{cat.name}</h2>
                    </Link>
                    <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {cat.region ?? "지역 미상"} · 함께한 {cared}일
                      {cat.care_log_count > 0 && ` · 돌봄 기록 ${cat.care_log_count}개`}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.34)" }}>
                      {new Date(cat.memorial_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      에 고양이별로
                    </p>
                  </div>
                </div>

                {cat.memorial_note && (
                  <p
                    className="text-[14px] leading-[1.7] mt-4 px-4 py-3 whitespace-pre-wrap"
                    style={{
                      color: "rgba(255,255,255,0.78)",
                      background: "rgba(0,0,0,0.18)",
                      borderRadius: 14,
                    }}
                  >
                    {cat.memorial_note}
                  </p>
                )}

                <Link
                  href={`/memorial/${cat.id}`}
                  className="flex items-center justify-center gap-1 h-[40px] mt-4 text-[13px] font-semibold"
                  style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)", color: "rgba(255,233,168,0.85)" }}
                >
                  {cat.care_log_count > 0 ? `함께한 기록 ${cat.care_log_count}개 보기` : "추모관 들어가기"}
                  <ChevronRight size={14} />
                </Link>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleFlower(cat.id)}
                    className="flex-1 h-[42px] rounded-xl flex items-center justify-center gap-1.5 text-[14px] font-semibold active:scale-[0.97] transition-transform"
                    style={{
                      background: flowered.has(cat.id) ? "rgba(255,233,168,0.92)" : "rgba(255,255,255,0.1)",
                      color: flowered.has(cat.id) ? "#3a2c4d" : "rgba(255,255,255,0.8)",
                    }}
                  >
                    <Flower2 size={15} />
                    {flowered.has(cat.id) ? "헌화했어요" : "헌화하기"}
                    {cat.flower_count > 0 && ` ${cat.flower_count}`}
                  </button>

                  {canRestore && (
                    <button
                      onClick={() => handleRestore(cat)}
                      className="h-[42px] px-4 rounded-xl flex items-center gap-1.5 text-[13px] active:scale-[0.97] transition-transform"
                      style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                      title="다시 지도로"
                    >
                      <Undo2 size={14} />
                      되돌리기
                    </button>
                  )}

                  {/* 영구 삭제 — 관리자만. 되돌리기와 달리 CASCADE 라 복구가 없다 */}
                  {isAdmin && (
                    <button
                      onClick={() => { setDeleteTarget(cat); setDeleteText(""); }}
                      className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 active:scale-[0.97] transition-transform"
                      style={{ background: "rgba(216,85,85,0.16)", color: "rgba(255,150,150,0.9)" }}
                      aria-label={`${cat.name} 영구 삭제 (관리자)`}
                      title="영구 삭제 (관리자)"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 영구 삭제 확인 — 되돌리기와 달리 복구가 없어서 이름을 직접 받는다.
          care_logs·cat_cards·댓글·헌화·추모일기가 전부 CASCADE 로 함께 사라진다. */}
      {deleteTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{ zIndex: 120, background: "rgba(10,7,18,0.72)" }}
          role="dialog"
          aria-modal="true"
          aria-label="영구 삭제 확인"
        >
          <div
            className="w-full bg-white overflow-hidden"
            style={{ maxWidth: 380, borderRadius: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.45)" }}
          >
            <div className="px-6 pt-7 pb-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ background: "rgba(216,85,85,0.12)" }}
              >
                <Trash2 size={20} color="#C94A4A" />
              </div>

              <h2 className="text-[18px] font-bold text-gray-900">
                {deleteTarget.name}(을)를 영구 삭제할까요?
              </h2>
              <p className="text-[14px] leading-[1.7] text-gray-600 mt-2">
                고양이별에서 내리는 게 아니라 <b className="text-gray-900">기록째 지웁니다.</b>{" "}
                되돌릴 수 없어요.
              </p>

              <ul
                className="text-[13px] leading-[1.9] mt-4 px-4 py-3"
                style={{ background: "#FBF3F3", borderRadius: 14, color: "#8B3A3A" }}
              >
                <li>· 돌봄 기록 {deleteTarget.care_log_count}개</li>
                <li>· 헌화 {deleteTarget.flower_count}개</li>
                <li>· 사진 · 카드 · 댓글 · 추모일기 전부</li>
              </ul>

              <p className="text-[13px] text-gray-500 mt-5 mb-2">
                확인을 위해 <b className="text-gray-800">{deleteTarget.name}</b> 을(를) 입력해주세요.
              </p>
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder={deleteTarget.name}
                autoFocus
                className="w-full text-[14px] px-4 py-3 outline-none"
                style={{ borderRadius: 12, background: "#F6F3F0", border: "1px solid #E7E0DA" }}
              />

              <button
                onClick={() => void handleAdminDelete()}
                disabled={deleting || deleteText.trim() !== deleteTarget.name}
                className="w-full h-[50px] rounded-2xl mt-5 text-white text-[15px] font-bold active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: "#C94A4A" }}
              >
                {deleting ? "삭제 중…" : "영구 삭제"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full h-[46px] mt-1 text-[14px] font-medium text-gray-500"
              >
                취소
              </button>
              <p className="text-[12px] text-gray-400 text-center mt-1">
                지도로 되돌리려는 거라면 취소하고 <b>되돌리기</b>를 눌러주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes memStarTwinkle {
          0%, 100% { opacity: 0.18; }
          50%      { opacity: 1; }
        }
        @keyframes memFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes memMeteor {
          0%      { opacity: 0; transform: translate3d(0,0,0) rotate(18deg); }
          4%      { opacity: 1; }
          22%     { opacity: 1; }
          30%,100%{ opacity: 0; transform: translate3d(140vw, 46vh, 0) rotate(18deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="memStarTwinkle"], [style*="memMeteor"], [style*="memFadeIn"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
