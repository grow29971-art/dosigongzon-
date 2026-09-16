// 운영자 → 전체 사용자 일괄 쪽지 발송 (admin 전용)
// 145명 활성화 액션: 환영·재참여·공지 메시지를 코호트별로 발송.
// API: POST /api/admin/broadcast-dm
// 2026-09-16 「익숙한 동네앱」 리디자인: 코호트 카드 → 구분선 리스트(라디오), 템플릿 칩, 헤어라인 섹션. 발송 문구 템플릿·법적 안내 무변경.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Send,
  Users as UsersIcon,
  Sparkles,
  Cat as CatIcon,
  Moon,
  Tag,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import UIButton from "@/app/components/ui/Button";
import UIChip from "@/app/components/ui/Chip";
import { AdminHeader, AdminLoading, AdminPage, AdminSection, HairlineButton, inputCls, inputStyle } from "../_ui";

type Cohort = "all" | "founding" | "no_cat" | "dormant" | "marketing";

const COHORT_OPTIONS: Array<{
  id: Cohort;
  label: string;
  description: string;
  Icon: typeof UsersIcon;
}> = [
  {
    id: "all",
    label: "전체 가입자",
    description: "모든 회원에게 발송 (운영자 본인 제외)",
    Icon: UsersIcon,
  },
  {
    id: "founding",
    label: "창립 멤버",
    description: "5/20 전 가입한 founding_member 타이틀 보유자",
    Icon: Sparkles,
  },
  {
    id: "no_cat",
    label: "첫 등록 미완료",
    description: "가입했지만 고양이 0건 — cold start 대응",
    Icon: CatIcon,
  },
  {
    id: "dormant",
    label: "휴면 (8~30일)",
    description: "최근 미접속자 — 재참여 유도",
    Icon: Moon,
  },
  {
    id: "marketing",
    label: "마케팅 동의자 (광고용)",
    description: "마케팅 수신 동의자만 — 쇼핑·이벤트 등 (광고)성 안내는 반드시 이 코호트로",
    Icon: Tag,
  },
];

const TEMPLATES: Array<{ label: string; text: string }> = [
  {
    label: "이탈·잔존 설문 (전체 발송용)",
    text:
      "안녕하세요! 도시공존 만든 사람이에요 🐾\n\n앱을 더 좋게 고치려고 실제 쓰신 분들 얘기를 직접 듣고 있어요. 바쁘시면 딱 한 줄만 답 주셔도 큰 도움이 됩니다 👇\n\n혹시 마지막으로 도시공존 앱 여신 게 언제쯤이었어요? 그때 뭐 하려고 여셨는지도 기억나시면 같이요!\n\n편하게 \"한 2주 전, 고양이 등록하려고요\" 이렇게 툭 답해주시면 돼요. (칭찬 말고 불편했던 점 들으려는 거라 편하게 말씀해 주셔도 됩니다 🙂) 15분 통화 괜찮으신 분은 말씀 주세요 — 커피 기프티콘 보내드릴게요!\n\n— 김성우 드림",
  },
  {
    label: "쇼핑몰 예고 (광고 · 마케팅 동의자 전용)",
    text:
      "(광고) 도시공존 🛍️\n\n안녕하세요, 도시공존 운영자입니다. 곧 도시공존 안에 작은 굿즈샵이 열릴 준비를 하고 있어요! 길고양이 돌봄에 보탬이 되는 물건들로 준비 중이에요. 오픈하면 제일 먼저 알려드릴게요 🐾\n\n※ 이 안내는 마케팅 정보 수신에 동의하신 분께만 발송돼요.\n수신거부: 마이페이지 > 알림 설정에서 마케팅 알림 끄기\n\n— 김성우 드림",
  },
  {
    label: "환영 인사 (창립 멤버)",
    text:
      "안녕하세요, 도시공존 운영자입니다 ✨\n\n정식 오픈 전부터 함께해 주셔서 진심으로 감사해요. 어떻게 도시공존을 알게 되셨는지, 어떤 점이 좋고 어려운지 한 줄이라도 답장 주시면 직접 챙길게요.\n\n— 김성우 드림",
  },
  {
    label: "첫 등록 격려",
    text:
      "안녕하세요, 도시공존 운영자입니다.\n\n우리 동네 길고양이를 지도에 한 마리만 등록해 보시면 도시공존이 어떤 도구인지 가장 빠르게 체감하실 수 있어요. 막히는 부분이 있으면 답장 주세요. 바로 도와드릴게요.\n\n— 김성우 드림",
  },
  {
    label: "재참여 (휴면)",
    text:
      "안녕하세요, 한동안 못 뵈었네요.\n\n그 사이 우리 동네에 새 친구들이 등록됐어요. 시간 되실 때 잠깐 들러서 한 번 봐주세요 🐾\n\n— 도시공존 운영자",
  },
  {
    label: "초기 200 타이틀 이벤트 (출시 D-3)",
    text:
      "안녕하세요, 도시공존 운영자입니다 🌟\n\n정식 출시(6/1) 직전, 처음부터 함께해 주신 초기 멤버 모두에게 영구 한정 타이틀 '초기 200(🌟 OG 200)'을 부여드렸어요.\n(이미 운영자 부여 타이틀 — 공식 봉사자·커뮤니티 리더 등 — 보유 중이신 분은 그대로 보존돼요. 더 영예로운 타이틀이라 우선합니다.)\n\n• 마이페이지 → 타이틀에서 장착하실 수 있어요\n• 닉네임 옆 🌟 표시로 영구 노출돼요\n• 출시 후 가입자는 받을 수 없는 한정 타이틀이에요\n\n출시까지 D-3. 시작을 함께해 주셔서 진심으로 감사합니다. 한결같이 좋은 서비스 만들겠습니다 🐾\n\n— 김성우 드림",
  },
  {
    label: "안드로이드 앱 Play 스토어 출시 안내",
    text:
      "🎉 안드로이드 앱이 Play 스토어에 출시됐어요!\n\n그동안 모바일에서 도시공존을 더 편하게 쓰고 싶다는 의견이 많았어요. 이제 Play 스토어에서 '도시공존' 검색하거나 아래 링크로 바로 설치하실 수 있습니다.\n\n📲 설치: https://play.google.com/store/apps/details?id=kr.dosigongzon.app\n\n앱에서 달라지는 점:\n• 홈 화면 아이콘으로 한 번에 진입\n• 푸시 알림 더 안정적으로 도착\n• 카메라·위치 권한이 한 번 등록되면 매번 묻지 않음\n• 브라우저 주소창 없이 풀 화면\n\n웹사이트(dosigongzon.com)도 그대로 운영돼요. 사용하시던 계정 그대로 로그인 가능합니다.\n\n— 김성우 드림",
  },
  {
    label: "정식 출시 D-Day 축하 (6/1 당일 발송)",
    text:
      "🎉 오늘, 도시공존이 정식 출시됐어요!\n\n작년부터 매일 한 줄씩 코드를 쌓아왔어요. 처음부터 함께해 주신 한 분 한 분의 손이 없었다면 오늘이 없었습니다. 진심으로 감사드립니다.\n\n오늘부터 달라지는 것:\n• 정식 운영 — 핫픽스 모드 졸업, 정기 업데이트로 전환\n• 출시 이후 가입자는 받을 수 없는 영구 한정 타이틀('초기 200') 마감\n• /celebrate 페이지에서 누적 통계와 감사 메시지 보실 수 있어요\n\n앞으로도 광고 없는 무료 시민 참여 길고양이 지도로 한결같이 운영하겠습니다. 동네 아이들 챙기실 때 도시공존이 작은 도구가 되길 바라요 🐾\n\n— 도시공존 운영자 김성우 드림",
  },
  {
    label: "출시 +7일 회고 (6/1 발송)",
    text:
      "안녕하세요, 도시공존 운영자입니다.\n\n정식 출시 후 첫 한 주가 지났어요. 그 사이 새 이웃이 N분 합류하셨고, M마리의 아이가 지도에 새로 올랐어요. 누군가의 한 끼와 한 장의 사진이 모여 동네 한 곳이 따뜻해졌습니다.\n\n출시 후 처음으로 알려드려요:\n• 첫 주 동안 가장 활발한 동네 TOP 3\n• 길집사 평균 활동 시간 / 가장 많이 등록된 시간대\n• 다음 주에 다듬을 부분 (피드백 반영)\n\n부족한 점·아쉬운 점은 답장으로 알려주세요. 직접 챙기겠습니다.\n\n— 김성우 드림",
  },
  {
    label: "5/18 패치 (Private Circle)",
    text:
      "안녕하세요, 도시공존 운영자입니다.\n\n그동안 '위치 올리는 게 두렵다', '가입자 중에 학대자가 섞여 있으면 어쩌나'라는 걱정의 글을 자주 봤어요. 직접 의견 주신 분들 덕분에 새 기능을 올렸습니다.\n\n🛡 Private Circle (믿는 이웃 서클)\n걱정되는 아이는 '내 서클'로 등록하시면, 내가 직접 승인한 이웃에게만 보입니다. 일반 가입자에게도 외부인에게도 존재 자체가 노출되지 않아요.\n\n사용법:\n• 마이페이지 → 내 서클\n• 닉네임으로 이웃 검색 → 초대\n• 등록할 때 공개 범위 '내 서클' 선택\n• 이미 등록한 아이도 핀 클릭 → 수정에서 변경 가능\n\n함께 강화된 보호: 좌표 ±444m 흐림, 비로그인 외부인 도트만, 위치 단어 자동 차단, 사진 GPS 메타데이터 자동 제거.\n\n— 도시공존 운영자 드림",
  },
];

export default function AdminBroadcastPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [cohort, setCohort] = useState<Cohort>("founding");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | { ok: boolean; sent: number; failed: number; totalTargets: number; cohort: string; firstError?: string | null }
    | null
  >(null);
  const [error, setError] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        setAuthorized(isAdmin);
        setChecking(false);
        if (!isAdmin) router.replace("/");
      })
      .catch(() => {
        setChecking(false);
        router.replace("/");
      });
  }, [router]);

  // 코호트 선택 시 예상 대상 수 미리보기 (실제 발송 없음)
  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewCount(null);
    (async () => {
      try {
        const sb = createClient();
        const { data: { session } } = await sb.auth.getSession();
        const res = await fetch("/api/admin/broadcast-dm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ preview: true, cohort }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && typeof data.count === "number") {
          setPreviewCount(data.count);
        }
      } catch {
        /* 미리보기 실패는 조용히 무시 */
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cohort, authorized]);

  const handleSend = async () => {
    if (sending) return;
    if (!message.trim()) {
      setError("메시지를 입력해주세요.");
      return;
    }
    if (message.length > 1000) {
      setError("메시지는 1000자 이내로 작성해주세요.");
      return;
    }

    // 광고↔코호트 정합성 안전장치 (정보통신망법 위반 방지)
    const hasAdLabel = message.includes("(광고)");
    if (cohort === "marketing" && !hasAdLabel) {
      if (!confirm("마케팅 동의자 발송인데 '(광고)' 표기가 없어요.\n광고성 정보는 '(광고)' 표기 + 수신거부 안내가 법적으로 필요합니다.\n그래도 보낼까요?")) return;
    }
    if (hasAdLabel && cohort !== "marketing") {
      if (!confirm("'(광고)' 표기가 있는데 대상이 '마케팅 동의자'가 아니에요.\n동의하지 않은 분께 광고를 보내면 정보통신망법 위반(최대 3천만원)입니다.\n코호트를 '마케팅 동의자'로 바꾸는 걸 강력히 권장해요.\n그래도 보낼까요?")) return;
    }

    const cohortLabel = COHORT_OPTIONS.find((c) => c.id === cohort)?.label ?? cohort;
    if (
      !confirm(
        `"${cohortLabel}" 코호트에 다음 메시지를 발송합니다.\n\n${message.slice(0, 120)}${message.length > 120 ? "..." : ""}\n\n진행할까요?`,
      )
    ) {
      return;
    }

    setSending(true);
    setError("");
    setResult(null);

    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/admin/broadcast-dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ message: message.trim(), cohort }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "발송 실패");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSending(false);
    }
  };

  // 나에게만 테스트 발송 (본인 받은편지함으로 1통) — 진짜 대량 발송 전 확인용
  const handleTestSend = async () => {
    if (sending) return;
    if (!message.trim()) {
      setError("메시지를 입력해주세요.");
      return;
    }
    setSending(true);
    setError("");
    setResult(null);
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/admin/broadcast-dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ message: message.trim(), test: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "테스트 발송 실패");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSending(false);
    }
  };

  if (checking || !authorized) return <AdminLoading />;

  return (
    <AdminPage>
      <AdminHeader title="전체 쪽지 발송" description="코호트별 일괄 발송 · 도배 trigger 면제 적용됨" />

      {/* 코호트 선택 */}
      <AdminSection title="1. 대상 코호트" padding={false}>
        {COHORT_OPTIONS.map((c) => {
          const Icon = c.Icon;
          const selected = cohort === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCohort(c.id)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0 press"
              style={{ background: selected ? "var(--color-surface-alt)" : undefined, minHeight: 56 }}
              aria-pressed={selected}
            >
              <Icon size={20} className="shrink-0 text-text-sub" strokeWidth={1.8} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main">{c.label}</p>
                <p className="text-[13px] text-text-light mt-0.5 leading-snug">{c.description}</p>
              </div>
              <span
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                style={{ border: `1.5px solid ${selected ? "var(--color-primary)" : "var(--color-gray-300)"}` }}
              >
                {selected && <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-primary)" }} />}
              </span>
            </button>
          );
        })}
      </AdminSection>

      {/* 템플릿 */}
      <AdminSection title="2. 템플릿 (선택)">
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <UIChip key={t.label} active={message === t.text} onClick={() => setMessage(t.text)}>
              {t.label}
            </UIChip>
          ))}
        </div>
      </AdminSection>

      {/* 메시지 입력 */}
      <AdminSection title={`3. 메시지 (${message.length}/1000)`}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={10}
          maxLength={1000}
          placeholder="안녕하세요, 도시공존 운영자입니다..."
          className={`${inputCls} leading-relaxed resize-none`}
          style={inputStyle}
        />

        {/* 예상 대상 수 미리보기 */}
        <div className="my-3 flex items-center justify-center gap-1.5 text-[13px] text-text-sub">
          <UsersIcon size={13} />
          {previewLoading ? (
            <span>예상 대상 계산 중…</span>
          ) : previewCount !== null ? (
            <span>
              이 코호트 예상 대상{" "}
              <b className="text-text-main tabular-nums">{previewCount}명</b>
            </span>
          ) : (
            <span>예상 대상 수 확인 불가</span>
          )}
        </div>

        {/* 나에게 테스트 발송 — 진짜 발송 전 확인 */}
        <HairlineButton
          size="md"
          className="w-full mb-2"
          onClick={handleTestSend}
          disabled={sending || !message.trim()}
          icon={sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        >
          나에게만 테스트 발송 (1통)
        </HairlineButton>

        {/* 발송 버튼 */}
        <UIButton size="lg" full onClick={handleSend} disabled={sending || !message.trim()}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending ? "발송 중…" : "발송하기"}
        </UIButton>
      </AdminSection>

      {error && (
        <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      {result && (
        <AdminSection title={result.ok ? "발송 완료" : "일부 실패"}>
          <p className="text-[13px] tabular-nums" style={{ color: result.ok ? "var(--color-sage)" : "var(--color-warning)" }}>
            대상 {result.totalTargets}명 · 성공 {result.sent}건 · 실패 {result.failed}건
          </p>
          {result.firstError && (
            <p className="mt-2 text-[13px] font-mono break-all text-text-sub">첫 에러: {result.firstError}</p>
          )}
        </AdminSection>
      )}

      <p className="text-center text-[13px] text-text-light mt-4">
        발송된 쪽지는 회수 불가. 메시지·코호트 다시 한 번 확인 후 발송.
      </p>
    </AdminPage>
  );
}
