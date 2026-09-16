// 접속 팝업 공지 관리 (admin 전용)
// 등록하면 사용자 최초 접속 시 모달로 1회 표시. 내리기로 즉시 중단.
// 2026-09-16 「익숙한 동네앱」 리디자인: 헤어라인 섹션·토큰·회색 선 아이콘.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, EyeOff } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  getActiveAnnouncement,
  publishAnnouncement,
  clearAnnouncements,
  type Announcement,
} from "@/lib/announcements-repo";
import UIButton from "@/app/components/ui/Button";
import { AdminHeader, AdminLoading, AdminPage, AdminSection, EmptyState, HairlineButton, inputCls, inputStyle } from "../_ui";

export default function AdminAnnouncementPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        setAuthorized(isAdmin);
        setChecking(false);
        if (!isAdmin) router.replace("/");
        else getActiveAnnouncement().then(setCurrent).catch(() => {});
      })
      .catch(() => {
        setChecking(false);
        router.replace("/");
      });
  }, [router]);

  const refresh = () => getActiveAnnouncement().then(setCurrent).catch(() => {});

  const handlePublish = async () => {
    if (busy) return;
    if (!message.trim()) {
      setError("공지 내용을 입력해주세요.");
      return;
    }
    if (
      !confirm(
        "이 공지를 지금부터 모든 접속자에게 팝업으로 띄웁니다.\n(기존 공지는 자동으로 내려가요.)\n진행할까요?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    try {
      await publishAnnouncement(message.trim());
      setDone("공지를 등록했어요. 이제 접속자에게 팝업으로 표시됩니다.");
      setMessage("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (busy) return;
    if (!confirm("현재 팝업 공지를 내릴까요? (더 이상 표시되지 않아요.)")) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      await clearAnnouncements();
      setDone("공지를 내렸어요.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "내리기 실패");
    } finally {
      setBusy(false);
    }
  };

  if (checking || !authorized) return <AdminLoading />;

  return (
    <AdminPage>
      <AdminHeader title="접속 팝업 공지" description="사용자 최초 접속 시 모달로 1회 표시 · 쪽지와 별개" />

      {/* 현재 공지 */}
      <AdminSection title="현재 표시 중인 공지">
        {current ? (
          <div>
            <p className="text-[15px] text-text-main whitespace-pre-wrap leading-relaxed">{current.body}</p>
            <HairlineButton tone="error" onClick={handleClear} disabled={busy} icon={<EyeOff size={13} />} className="mt-3">
              이 공지 내리기
            </HairlineButton>
          </div>
        ) : (
          <EmptyState>표시 중인 공지가 없어요.</EmptyState>
        )}
      </AdminSection>

      {/* 새 공지 작성 */}
      <AdminSection title={`새 공지 (${message.length}/1000)`}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          maxLength={1000}
          placeholder="예) 도시공존에 곧 굿즈샵이 열려요. 준비되면 알려드릴게요"
          className={`${inputCls} leading-relaxed resize-none`}
          style={inputStyle}
        />
        <UIButton onClick={handlePublish} disabled={busy || !message.trim()} size="lg" full className="mt-3">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          팝업 공지로 등록
        </UIButton>
      </AdminSection>

      {error && (
        <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
      {done && (
        <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--color-sage)" }}>
          {done}
        </p>
      )}

      <p className="text-[13px] text-text-light mt-4 leading-relaxed">
        각 사용자에게 1회만 표시됩니다(닫으면 다시 안 뜸). 광고성 내용은 별도 규제 대상이니 서비스 안내 위주로.
      </p>
    </AdminPage>
  );
}
