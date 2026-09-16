"use client";

// 추모일기 — 떠나보낸 뒤 매일 한 줄씩 쓰는 자리.
// 설계상 넣지 않은 것: 연속 일수, 배지, "오늘 안 썼어요" 알림.
// 슬픔은 선형으로 나아지지 않는다. 못 쓴 날이 실패로 보이는 순간 이 기능은 짐이 된다.
// 그래서 "N일 연속"이 아니라 "N번째 편지"로 세고, 그만 써도 된다고 안내한다.
// 2026-09-16 리디자인: 흰 면 + 헤어라인. 마음 선택은 이모지 대신 글자 칩(DIARY_MOODS.label).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Globe, Trash2, ChevronDown, Info } from "lucide-react";
import {
  listMemorialDiaries,
  createMemorialDiary,
  setMemorialDiaryShared,
  deleteMemorialDiary,
  DIARY_MOODS,
  type MemorialDiary as Diary,
} from "@/lib/cats-repo";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";

const KST = "Asia/Seoul";

function fmt(s: string) {
  return new Date(s).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: KST,
  });
}

export default function MemorialDiary({ catId, catName }: { catId: string; catName: string }) {
  const toast = useToast();
  const [diaries, setDiaries] = useState<Diary[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(async () => {
    setDiaries(await listMemorialDiaries(catId));
  }, [catId]);

  useEffect(() => {
    void load();
    void (async () => {
      const { data } = await createClient().auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, [load]);

  const mine = diaries?.filter((d) => d.author_id === userId) ?? [];

  const handleSubmit = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    try {
      const created = await createMemorialDiary({ catId, body, mood, isShared: shared });
      setDiaries((prev) => [created, ...(prev ?? [])]);
      setBody("");
      setMood(null);
      toast.success("일기를 남겼어요");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "일기를 남기지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async (d: Diary) => {
    const next = !d.is_shared;
    setDiaries((prev) => prev?.map((x) => (x.id === d.id ? { ...x, is_shared: next } : x)) ?? prev);
    try {
      await setMemorialDiaryShared(d.id, next);
    } catch (err) {
      setDiaries((prev) => prev?.map((x) => (x.id === d.id ? { ...x, is_shared: !next } : x)) ?? prev);
      toast.error(err instanceof Error ? err.message : "변경하지 못했어요");
    }
  };

  const handleDelete = async (d: Diary) => {
    if (!confirm("이 일기를 지울까요?")) return;
    try {
      await deleteMemorialDiary(d.id);
      setDiaries((prev) => prev?.filter((x) => x.id !== d.id) ?? prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제하지 못했어요");
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-[17px] font-bold text-text-main mb-0.5">추모일기</h2>
      <p className="text-[13px] mb-3 text-text-sub">
        {mine.length > 0
          ? `${catName}에게 쓴 ${mine.length}번째 편지까지 왔어요.`
          : `${catName}에게 하고 싶은 말을 남겨보세요.`}
      </p>

      {/* 안내 */}
      <div className="mb-3" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
        <button
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left press"
          aria-expanded={guideOpen}
        >
          <Info size={15} className="text-text-sub" />
          <span className="text-[15px] font-semibold text-text-main flex-1">추모일기는 어떻게 쓰나요?</span>
          <ChevronDown
            size={15}
            style={{ color: "var(--color-text-muted)", transform: guideOpen ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}
          />
        </button>

        {guideOpen && (
          <div className="px-4 pb-4 flex flex-col gap-3">
            <p className="text-[13px] leading-[1.8] text-text-main">
              길고양이를 떠나보낸 슬픔은 주변에서 알아주기 어려운 종류예요. &ldquo;남의 고양이잖아&rdquo;,
              &ldquo;길고양이는 원래 그래&rdquo; 같은 말을 들으면 마음을 접게 되고, 접어둔 슬픔은
              더 오래 갑니다. 여기는 그 말을 대신 받아두는 자리예요.
            </p>

            <div>
              <p className="text-[13px] font-semibold text-text-main">잘 쓰지 않아도 돼요</p>
              <p className="text-[13px] leading-[1.7] mt-0.5 text-text-sub">
                한 줄이어도 좋아요. 글이 안 나오는 날은 그날의 마음만 골라두고 나가셔도 됩니다.
                오늘 뭘 했는지, 어디서 생각났는지 같은 사소한 것도 나중엔 기록이 돼요.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-text-main">매일 안 써도 돼요</p>
              <p className="text-[13px] leading-[1.7] mt-0.5 text-text-sub">
                연속으로 며칠 썼는지 세지 않아요. 하루에 여러 번 써도 되고, 한참 안 쓰다 다시 와도
                아무 표시가 남지 않습니다. <b className="text-text-main">괜찮아지면 그만 쓰셔도 돼요.</b>
                {" "}그게 이 일기의 목표예요.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-text-main">기본은 나만 보기</p>
              <p className="text-[13px] leading-[1.7] mt-0.5 text-text-sub">
                쓴 글은 나에게만 보여요. 같은 아이를 알던 이웃과 나누고 싶을 때만 공개로 바꾸면 되고,
                공개했다가 다시 닫을 수도 있어요.
              </p>
            </div>

            <p
              className="text-[13px] leading-[1.7] px-3.5 py-3 text-text-sub"
              style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }}
            >
              며칠이 지나도 잠이 오지 않거나 일상이 어려울 만큼 힘들다면, 혼자 견디지 않으셔도 돼요.
              반려동물을 잃은 슬픔은 전문 상담을 받아도 되는 슬픔이에요.
            </p>
          </div>
        )}
      </div>

      {/* 쓰기 */}
      {userId ? (
        <div className="p-4" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
          <p className="text-[13px] font-semibold mb-2 text-text-sub">
            오늘의 마음 <span className="font-normal text-text-light">(선택)</span>
          </p>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {DIARY_MOODS.map((m) => {
              const active = mood === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setMood(active ? null : m.value)}
                  className="h-8 px-3 text-[13px] font-semibold press-strong"
                  style={{
                    borderRadius: "var(--radius-square)",
                    background: active ? "var(--color-primary)" : "var(--color-surface)",
                    color: active ? "var(--color-surface)" : "var(--color-text-sub)",
                    border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                  }}
                  aria-pressed={active}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder={`${catName}에게 하고 싶은 말을 적어보세요. 한 줄이어도 괜찮아요.`}
            className="w-full text-[15px] leading-[1.7] px-4 py-3 outline-none resize-none text-text-main"
            style={{
              borderRadius: "var(--radius-input)",
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
            }}
          />

          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => setShared((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] h-8 px-3 press-strong"
              style={{
                borderRadius: "var(--radius-square)",
                border: "1px solid var(--color-border)",
                color: shared ? "var(--color-primary)" : "var(--color-text-sub)",
              }}
              aria-pressed={shared}
            >
              {shared ? <Globe size={13} /> : <Lock size={13} />}
              {shared ? "이웃에게 공개" : "나만 보기"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy || !body.trim()}
              className="h-10 px-5 text-[13px] font-semibold text-white press-strong disabled:opacity-40"
              style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
            >
              {busy ? "남기는 중…" : "남기기"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-5 text-center" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
          <p className="text-[13px] leading-[1.7] text-text-sub">
            로그인하면 추모일기를 남길 수 있어요.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/memorial/${catId}`)}`}
            className="inline-flex items-center justify-center h-10 px-5 mt-3 text-[13px] font-semibold text-white"
            style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
          >
            로그인
          </Link>
        </div>
      )}

      {/* 목록 — 구분선 리스트 */}
      <div className="flex flex-col mt-4">
        {diaries?.map((d) => {
          const isMine = d.author_id === userId;
          const m = DIARY_MOODS.find((x) => x.value === d.mood);
          return (
            <div key={d.id} className="py-3.5" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <div className="flex items-center gap-2">
                {m && (
                  <span
                    className="text-[11px] font-semibold px-1.5 py-0.5 text-text-sub"
                    style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
                  >
                    {m.label}
                  </span>
                )}
                <span className="text-[13px] text-text-light">{fmt(d.created_at)}</span>
                {!isMine && d.author_name && (
                  <span className="text-[13px] text-text-light">· {d.author_name}</span>
                )}
                {isMine && (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => handleShare(d)}
                      className="flex items-center gap-1 text-[11px] h-7 px-2 press-strong"
                      style={{
                        borderRadius: "var(--radius-square)",
                        border: "1px solid var(--color-border)",
                        color: d.is_shared ? "var(--color-primary)" : "var(--color-text-sub)",
                      }}
                    >
                      {d.is_shared ? <Globe size={11} /> : <Lock size={11} />}
                      {d.is_shared ? "공개" : "나만"}
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      className="w-7 h-7 rounded-full flex items-center justify-center press-strong text-text-light"
                      aria-label="일기 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[15px] leading-[1.8] mt-2 whitespace-pre-wrap text-text-main">
                {d.body}
              </p>
            </div>
          );
        })}

        {diaries?.length === 0 && (
          <p className="text-[13px] text-center py-6 text-text-light">
            아직 남긴 일기가 없어요.
          </p>
        )}
      </div>
    </div>
  );
}
