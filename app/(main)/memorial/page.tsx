"use client";

import { useCallback, useEffect, useState } from "react";
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
import { catArtWalkSvg } from "@/lib/cat-art";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { deleteCatByAdmin } from "@/lib/support-repo";
import CatStarPlanet from "@/app/components/CatStarPlanet";
import { SkeletonListRow } from "@/app/components/Skeleton";

// 2026-09-16 리디자인 「익숙한 동네앱」: 밤하늘 그라디언트·별밭·글로우를 걷어내고
// 흰 면 + 헤어라인 구분선 리스트. 고양이별의 정서는 카피와 행성 아이콘(CatStarPlanet)으로만 남긴다.

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
    <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-3.5 text-left press"
        aria-expanded={open}
      >
        <Info size={16} className="text-text-sub" />
        <span className="text-[15px] font-semibold text-text-main flex-1">고양이별은 어떤 곳인가요?</span>
        <ChevronDown
          size={16}
          style={{ color: "var(--color-text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}
        />
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ animation: "memFadeIn 300ms ease both" }}>
          <p className="text-[15px] leading-[1.8] text-text-main">
            길에서 살아가는 아이들은 언젠가 먼저 떠납니다. 그때 지도에서 이름을 지워버리면
            함께한 시간까지 없던 일이 되는 것 같습니다. 고양이별은 그 아이들이 머무는 곳이에요.
            지도에서만 내려올 뿐, <b>이름도 사진도 그동안의 돌봄 기록도 그대로 남습니다.</b>
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <p className="text-[13px] font-semibold text-text-main">어떻게 보내나요</p>
              <p className="text-[13px] leading-[1.7] mt-0.5 text-text-sub">
                지도에서 아이를 누르고 별 버튼을 누르면 됩니다. 마지막 인사를 함께 남길 수 있어요.
                등록한 분과 관리자만 보낼 수 있고, 잘못 보냈다면 여기서 다시 지도로 되돌릴 수 있습니다.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-text-main">삭제와 무엇이 다른가요</p>
              <p className="text-[13px] leading-[1.7] mt-0.5 text-text-sub">
                삭제는 돌봄 일지와 사진, 카드까지 <b className="text-text-main">전부 함께 지워지고 되돌릴 수 없습니다.</b>
                {" "}고양이별로 보내면 지도에서만 내려오고 기록은 남습니다.
                건강 알림도 더 이상 가지 않아요.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-text-main">여기서 할 수 있는 일</p>
              <p className="text-[13px] leading-[1.7] mt-0.5 text-text-sub">
                아이를 누르면 그동안의 돌봄 기록을 날짜별로 전부 볼 수 있어요.
                헌화는 기억하고 있다는 표시예요 — 같은 아이를 돌봤던 이웃들의 헌화도 함께 쌓입니다.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-text-main">추모일기</p>
              <p className="text-[13px] leading-[1.7] mt-0.5 text-text-sub">
                떠나보낸 뒤 하고 싶은 말을 하나씩 적어두는 자리예요. 기본은 나만 보기고,
                한 줄이어도 괜찮아요. <b className="text-text-main">며칠 걸러도, 그만 써도 아무 표시가 남지 않아요</b> —
                연속 일수를 세지 않으니까요. 괜찮아지면 안 쓰게 되는 게 맞습니다.
              </p>
            </div>
          </div>

          <p
            className="text-[13px] leading-[1.7] mt-4 px-3.5 py-3 text-text-sub"
            style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }}
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
    <div className="min-h-screen relative" style={{ background: "var(--color-surface)" }}>
      <div className="relative px-4 pb-28" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        {/* 헤더 */}
        <div className="flex items-center gap-2 py-3">
          <Link
            href="/map"
            className="w-9 h-9 rounded-full flex items-center justify-center press-strong"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            aria-label="뒤로"
          >
            <ChevronLeft size={20} className="text-text-main" />
          </Link>
          <span className="text-[13px] font-semibold text-text-sub">지도</span>
        </div>

        <div className="flex flex-col items-center text-center pt-4 pb-8">
          {/* 곁별 수 = 고양이별에 온 아이 수 */}
          <CatStarPlanet size={120} companions={cats?.length ?? 0} />
          <h1 className="text-[24px] font-bold text-text-main mt-2">고양이별</h1>
          <p className="text-[15px] leading-[1.7] mt-2 text-text-sub">
            먼저 떠난 아이들이 머무는 곳이에요. 이름과 돌본 기록은 지워지지 않아요.
          </p>
        </div>

        {/* 고양이별 안내 — 아이가 없을 땐 펼친 채로, 있을 땐 접어서 목록을 먼저 보여준다 */}
        <MemorialAbout defaultOpen={cats !== null && cats.length === 0} />

        {/* 목록 */}
        {cats === null && (
          <div className="flex flex-col gap-2 mt-4"><SkeletonListRow /><SkeletonListRow /><SkeletonListRow /><SkeletonListRow /></div>
        )}

        {cats?.length === 0 && (
          <div className="text-center pt-12 pb-6">
            <p className="text-[15px] leading-[1.8] text-text-sub">
              아직 고양이별에 온 아이가 없어요. 모두 잘 지내고 있다는 뜻이에요.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center justify-center h-12 px-6 mt-6 text-[15px] font-semibold text-white press"
              style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
            >
              지도로 돌아가기
            </Link>
          </div>
        )}

        {cats !== null && cats.length > 0 && <div className="h-6" />}

        {/* 구분선 리스트 — 아이 한 명이 한 행(사진·이름·메타 + 행동 줄) */}
        <div className="flex flex-col">
          {cats?.map((cat) => {
            const cared = daysBetween(cat.created_at, cat.memorial_at);
            const canRestore = Boolean(userId && (cat.caretaker_id === userId || isAdmin));
            const photo = sanitizeImageUrl(cat.photo_url);
            return (
              <div
                key={cat.id}
                className="py-4"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <div className="flex items-start gap-3">
                  <Link href={`/memorial/${cat.id}`} className="shrink-0">
                    <div
                      className="rounded-full overflow-hidden flex items-center justify-center"
                      style={{ width: 56, height: 56, background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
                    >
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span
                          aria-hidden
                          dangerouslySetInnerHTML={{ __html: catArtWalkSvg(cat.id, 44, { walking: false }) }}
                        />
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/memorial/${cat.id}`}>
                      <h2 className="text-[15px] font-semibold text-text-main truncate">{cat.name}</h2>
                    </Link>
                    <p className="text-[13px] mt-0.5 text-text-sub">
                      {cat.region ?? "지역 미상"} · 함께한 {cared}일
                      {cat.care_log_count > 0 && ` · 돌봄 기록 ${cat.care_log_count}개`}
                    </p>
                    <p className="text-[13px] mt-0.5 text-text-light">
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
                    className="text-[13px] leading-[1.7] mt-3 px-3.5 py-3 whitespace-pre-wrap text-text-main"
                    style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-input)" }}
                  >
                    {cat.memorial_note}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <Link
                    href={`/memorial/${cat.id}`}
                    className="flex-1 flex items-center justify-center gap-1 h-10 text-[13px] font-semibold text-text-main press"
                    style={{ borderRadius: "var(--radius-input)", background: "var(--color-gray-100)" }}
                  >
                    {cat.care_log_count > 0 ? `함께한 기록 ${cat.care_log_count}개` : "추모관"}
                    <ChevronRight size={14} />
                  </Link>

                  <button
                    onClick={() => handleFlower(cat.id)}
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 text-[13px] font-semibold press-strong"
                    style={{
                      borderRadius: "var(--radius-input)",
                      background: flowered.has(cat.id) ? "var(--color-primary)" : "var(--color-surface)",
                      color: flowered.has(cat.id) ? "var(--color-surface)" : "var(--color-text-main)",
                      border: `1px solid ${flowered.has(cat.id) ? "var(--color-primary)" : "var(--color-border)"}`,
                    }}
                  >
                    <Flower2 size={14} />
                    {flowered.has(cat.id) ? "헌화했어요" : "헌화하기"}
                    {cat.flower_count > 0 && ` ${cat.flower_count}`}
                  </button>

                  {canRestore && (
                    <button
                      onClick={() => handleRestore(cat)}
                      className="h-10 w-10 flex items-center justify-center shrink-0 press-strong text-text-sub"
                      style={{ borderRadius: "var(--radius-input)", border: "1px solid var(--color-border)" }}
                      title="다시 지도로"
                      aria-label="다시 지도로 되돌리기"
                    >
                      <Undo2 size={15} />
                    </button>
                  )}

                  {/* 영구 삭제 — 관리자만. 되돌리기와 달리 CASCADE 라 복구가 없다 */}
                  {isAdmin && (
                    <button
                      onClick={() => { setDeleteTarget(cat); setDeleteText(""); }}
                      className="w-10 h-10 flex items-center justify-center shrink-0 press-strong"
                      style={{ borderRadius: "var(--radius-input)", border: "1px solid var(--color-border)", color: "var(--color-error)" }}
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
          style={{ zIndex: 120, background: "rgba(0,0,0,0.55)" }}
          role="dialog"
          aria-modal="true"
          aria-label="영구 삭제 확인"
        >
          <div
            className="w-full overflow-hidden"
            style={{ maxWidth: 380, background: "var(--color-surface)", borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
          >
            <div className="px-6 pt-6 pb-6">
              <div className="mb-3" style={{ color: "var(--color-error)" }}>
                <Trash2 size={20} />
              </div>

              <h2 className="text-[20px] font-bold text-text-main">
                {deleteTarget.name}(을)를 영구 삭제할까요?
              </h2>
              <p className="text-[15px] leading-[1.7] text-text-sub mt-2">
                고양이별에서 내리는 게 아니라 <b className="text-text-main">기록째 지웁니다.</b>{" "}
                되돌릴 수 없어요.
              </p>

              <ul
                className="text-[13px] leading-[1.9] mt-4 px-4 py-3"
                style={{ background: "var(--color-error-soft)", borderRadius: "var(--radius-input)", color: "var(--color-error)" }}
              >
                <li>· 돌봄 기록 {deleteTarget.care_log_count}개</li>
                <li>· 헌화 {deleteTarget.flower_count}개</li>
                <li>· 사진 · 카드 · 댓글 · 추모일기 전부</li>
              </ul>

              <p className="text-[13px] text-text-sub mt-5 mb-2">
                확인을 위해 <b className="text-text-main">{deleteTarget.name}</b> 을(를) 입력해주세요.
              </p>
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder={deleteTarget.name}
                autoFocus
                className="w-full text-[15px] px-4 py-3 outline-none text-text-main"
                style={{ borderRadius: "var(--radius-input)", background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
              />

              <button
                onClick={() => void handleAdminDelete()}
                disabled={deleting || deleteText.trim() !== deleteTarget.name}
                className="w-full h-12 mt-5 text-white text-[15px] font-semibold press disabled:opacity-40"
                style={{ background: "var(--color-error)", borderRadius: "var(--radius-input)" }}
              >
                {deleting ? "삭제 중…" : "영구 삭제"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full h-11 mt-1 text-[15px] font-medium text-text-sub"
              >
                취소
              </button>
              <p className="text-[13px] text-text-light text-center mt-1">
                지도로 되돌리려는 거라면 취소하고 <b>되돌리기</b>를 눌러주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes memFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="memFadeIn"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
