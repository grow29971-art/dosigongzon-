import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { Link as RouterLink } from "react-router";
import { Device } from "@apps-in-toss/web-framework";
import { isMiniAppBlockedPath } from "./miniapp-routes";

// next/link 대체. 내부 경로는 react-router Link, 외부 http(s)는 토스 SDK Device.openURL(외부 브라우저).
// 미니앱에서 막힌 경로(쇼핑·쪽지·서클)는 홈으로 보낸다.
type Href = string | { pathname?: string; query?: Record<string, string | number | undefined>; hash?: string };
interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: Href;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  shallow?: boolean;
}
function toPath(href: Href): string {
  if (typeof href === "string") return href;
  const q = href.query
    ? Object.entries(href.query).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  return `${href.pathname ?? ""}${q ? `?${q}` : ""}${href.hash ?? ""}`;
}
const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, replace, scroll, prefetch, shallow, onClick, children, ...rest }, ref) {
  void scroll; void prefetch; void shallow;
  let to = toPath(href);
  // 자사 사이트 절대 URL(https://dosigongzon.com/...)은 앱 안 라우트로
  const self = /^https?:\/\/(www\.)?dosigongzon\.com(\/[^\s]*)?$/i.exec(to);
  if (self) to = self[2] || "/";
  if (/^(https?:)?\/\//.test(to) || to.startsWith("mailto:") || to.startsWith("tel:")) {
    return (
      <a
        ref={ref}
        href={to}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => { onClick?.(e); if (!e.defaultPrevented) { e.preventDefault(); Device.openURL(to); } }}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return <RouterLink ref={ref} to={isMiniAppBlockedPath(to) ? "/" : to} replace={replace} onClick={onClick} {...rest}>{children}</RouterLink>;
});
export default Link;
