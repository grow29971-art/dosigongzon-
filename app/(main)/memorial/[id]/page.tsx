import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star } from "lucide-react";
import { getCatByIdServer, getMemorialCareLogsServer } from "@/lib/cats-server";
import { CARE_TYPE_MAP, type CareType } from "@/lib/care-logs-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import MemorialFlowerButton from "@/app/components/MemorialFlowerButton";
import MemorialDiary from "@/app/components/MemorialDiary";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cat = await getCatByIdServer(id);
  if (!cat?.memorial_at) return { title: "고양이별" };
  return {
    title: `${cat.name} — 고양이별`,
    description: `${cat.name}(이)와 함께한 기록`,
  };
}

const KST = "Asia/Seoul";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: KST,
  });
}

export default async function MemorialCatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cat = await getCatByIdServer(id);
  if (!cat) notFound();

  // 아직 살아 있는 아이는 추모관이 아니라 원래 상세로
  if (!cat.memorial_at) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-[15px] text-text-sub leading-[1.7]">
          {cat.name}(이)는 아직 지도에 있어요.
        </p>
        <Link
          href={`/cats/${cat.id}`}
          className="h-[46px] px-6 rounded-2xl flex items-center text-[15px] font-bold text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {cat.name} 보러 가기
        </Link>
      </div>
    );
  }

  const logs = await getMemorialCareLogsServer(cat.id);

  const cared = Math.max(
    Math.floor(
      (new Date(cat.memorial_at).getTime() - new Date(cat.created_at).getTime()) / 86400000,
    ),
    0,
  );

  // 요약 — 총 몇 번, 어떤 돌봄이 가장 많았는지, 몇 사람이 함께했는지
  const byType = new Map<string, number>();
  const people = new Set<string>();
  for (const l of logs) {
    byType.set(l.care_type, (byType.get(l.care_type) ?? 0) + 1);
    if (l.author_id) people.add(l.author_id);
  }
  const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  // 날짜별 묶기 (KST)
  const groups = new Map<string, typeof logs>();
  for (const l of logs) {
    const key = new Date(l.logged_at).toLocaleDateString("en-CA", { timeZone: KST });
    const arr = groups.get(key);
    if (arr) arr.push(l);
    else groups.set(key, [l]);
  }

  const photo = sanitizeImageUrl(cat.photo_url);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #07060F 0%, #140F26 34%, #241B3B 68%, #33254A 100%)" }}
    >
      <div className="px-5 pb-28" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        <div className="flex items-center py-3">
          <Link
            href="/memorial"
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(255,255,255,0.1)" }}
            aria-label="고양이별로"
          >
            <ChevronLeft size={20} color="#fff" />
          </Link>
          <span className="text-[13px] font-semibold ml-2" style={{ color: "rgba(255,255,255,0.5)" }}>
            고양이별
          </span>
        </div>

        {/* 프로필 */}
        <div className="flex flex-col items-center text-center pt-6">
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: 128,
              height: 128,
              border: "3px solid rgba(255,233,168,0.55)",
              boxShadow: "0 0 40px rgba(255,233,168,0.3)",
              background: "#2a2340",
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={cat.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[46px]">🐈</div>
            )}
          </div>

          <h1 className="text-[24px] font-bold text-white mt-5">{cat.name}</h1>
          <p className="text-[13px] mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            {cat.region ?? "지역 미상"} · 함께한 {cared}일
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <Star size={12} color="#FFE9A8" fill="#FFE9A8" />
            <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.42)" }}>
              {fmtDate(cat.memorial_at)}에 고양이별로
            </p>
          </div>

          {cat.memorial_note && (
            <p
              className="text-[15px] leading-[1.8] mt-6 px-5 py-4 whitespace-pre-wrap w-full"
              style={{ color: "rgba(255,255,255,0.8)", background: "rgba(0,0,0,0.2)", borderRadius: 18 }}
            >
              {cat.memorial_note}
            </p>
          )}

          <div className="w-full mt-5">
            <MemorialFlowerButton catId={cat.id} />
          </div>
        </div>

        {/* 요약 */}
        {logs.length > 0 && (
          <div
            className="mt-10 px-5 py-5"
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <p className="text-[15px] leading-[1.8] text-white">
              {people.size > 1 ? `${people.size}명이 ` : ""}
              <b style={{ color: "#FFE9A8" }}>{logs.length}번</b>
              {" "}돌봤어요
            </p>
            <div className="flex flex-wrap gap-2 mt-3.5">
              {topTypes.map(([type, n]) => {
                const meta = CARE_TYPE_MAP[type as CareType];
                if (!meta) return null;
                return (
                  <span
                    key={type}
                    className="text-[13px] px-3 py-1.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.78)" }}
                  >
                    {meta.emoji} {meta.label} {n}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 추모일기 — 떠나보낸 뒤 계속 쓰는 자리. 돌봄 기록(과거)보다 위에 둔다 */}
        <MemorialDiary catId={cat.id} catName={cat.name} />

        {/* 돌봄 기록 전체 */}
        <div className="mt-10">
          <h2 className="text-[15px] font-bold text-white mb-1">함께한 기록</h2>
          <p className="text-[13px] mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {logs.length > 0
              ? "지도에서 내려와도 이 기록은 지워지지 않아요."
              : "남겨진 돌봄 기록이 없어요."}
          </p>

          <div className="flex flex-col gap-6">
            {[...groups.entries()].map(([day, items]) => (
              <div key={day}>
                <p className="text-[13px] font-semibold mb-2.5" style={{ color: "rgba(255,233,168,0.72)" }}>
                  {fmtDate(day)}
                </p>
                <div className="flex flex-col gap-2.5">
                  {items.map((l) => {
                    const meta = CARE_TYPE_MAP[l.care_type as CareType];
                    const img = sanitizeImageUrl(l.photo_url);
                    return (
                      <div
                        key={l.id}
                        className="px-4 py-3.5"
                        style={{
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.09)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[15px]">{meta?.emoji ?? "📝"}</span>
                          <span className="text-[13px] font-bold text-white">
                            {meta?.label ?? "돌봄"}
                            {l.amount ? ` · ${l.amount}` : ""}
                          </span>
                          <span className="text-[13px] ml-auto" style={{ color: "rgba(255,255,255,0.38)" }}>
                            {new Date(l.logged_at).toLocaleTimeString("ko-KR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: KST,
                            })}
                          </span>
                        </div>

                        {l.memo && (
                          <p
                            className="text-[13px] leading-[1.7] mt-2 whitespace-pre-wrap"
                            style={{ color: "rgba(255,255,255,0.75)" }}
                          >
                            {l.memo}
                          </p>
                        )}

                        {img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="w-full mt-3 object-cover"
                            style={{ borderRadius: 12, maxHeight: 260 }}
                          />
                        )}

                        {l.author_name && (
                          <p className="text-[13px] mt-2.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {l.author_name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
