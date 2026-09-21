import { Device } from "@apps-in-toss/web-framework";

// 앱인토스 WebView는 외부 오리진으로의 이동을 막는다(체크리스트: 외부 이동은 SDK openURL로만). 본 앱 곳곳의
// 평범한 <a href="https://..."> · target=_blank · window.open이 미니앱에서는 눌러도 아무 일이 없어 9/21 번들 -4가
// "외부 링크가 정상적으로 열리지 않아요"로 반려됐다. 한 곳에서 전부 잡는다: 문서 클릭을 가로채 다른 오리진·mailto·tel은
// Device.openURL로 넘기고, window.open도 같은 경로로 돌린다. 같은 오리진 링크는 react-router가 그대로 처리.
export function installExternalLinkBridge(): void {
  const isExternal = (href: string) => {
    if (/^(mailto:|tel:|sms:)/i.test(href)) return true;
    try { return new URL(href, location.href).origin !== location.origin; } catch { return false; }
  };
  const open = (href: string) => { void Device.openURL(href).catch((e) => console.warn("[openURL]", href, e)); };

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (!isExternal(a.href)) return;
    e.preventDefault();
    open(a.href);
  }, true);

  const origOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = url ? String(url) : "";
    if (href && isExternal(href)) { open(href); return null; }
    return origOpen(url as string, target, features);
  }) as typeof window.open;
}
