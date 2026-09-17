// ══════════════════════════════════════════
// 앱인토스(Apps in Toss) 파트너 API 클라이언트 — 서버 전용
// 토스 로그인 토큰 교환·사용자 조회는 mTLS(파트너 클라이언트 인증서)로만 호출된다.
// 인증서·복호화 키는 Vercel 환경변수(PEM 본문)로만 존재하고 리포에 두지 않는다.
//
// 환경변수:
//   TOSS_AIT_CLIENT_CERT   — 파트너 클라이언트 인증서 PEM (콘솔 발급)
//   TOSS_AIT_CLIENT_KEY    — 개인키 PEM
//   TOSS_AIT_DECRYPT_KEY   — 사용자 정보 복호화 AES-256 키 (base64, 콘솔 발급)
//   TOSS_AIT_AAD           — 복호화 AAD 문자열 (콘솔 발급)
// 참고: 토스페이먼츠(PG) 키와는 전혀 다른 계약·키 체계다 — 섞지 말 것.
// ══════════════════════════════════════════

import "server-only";
import https from "node:https";
import crypto from "node:crypto";

const AUTH_API_BASE = "https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2";

export function isTossAitConfigured(): boolean {
  return !!(process.env.TOSS_AIT_CLIENT_CERT && process.env.TOSS_AIT_CLIENT_KEY
    && process.env.TOSS_AIT_DECRYPT_KEY && process.env.TOSS_AIT_AAD);
}

// Vercel 환경변수는 개행을 "\n" 리터럴로 저장하기도 한다(engineering-notes env 개행 함정) — 양쪽 다 받는다.
function pem(v: string): string {
  return v.replace(/\\n/g, "\n").trim();
}

interface TossEnvelope<T> {
  resultType?: "SUCCESS" | "FAIL";
  success?: T;
  error?: { errorCode?: string; reason?: string };
}

function mtlsRequest<T>(url: string, method: "GET" | "POST", body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: TossEnvelope<T> }> {
  const u = new URL(url);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method,
      cert: pem(process.env.TOSS_AIT_CLIENT_CERT!),
      key: pem(process.env.TOSS_AIT_CLIENT_KEY!),
      rejectUnauthorized: true,
      timeout: 10_000,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode ?? 0, data: raw ? JSON.parse(raw) : {} }); }
        catch { reject(new Error(`토스 API 응답 파싱 실패 (${res.statusCode})`)); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("토스 API 응답 지연")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export interface TossTokens { accessToken: string; refreshToken: string; expiresIn: number }

export async function exchangeAuthorizationCode(authorizationCode: string, referrer: string): Promise<TossTokens> {
  const { status, data } = await mtlsRequest<TossTokens>(`${AUTH_API_BASE}/generate-token`, "POST", { authorizationCode, referrer });
  if (status !== 200 || data.resultType !== "SUCCESS" || !data.success?.accessToken) {
    throw new Error(`토스 토큰 교환 실패 (${status} ${data.error?.errorCode ?? ""})`);
  }
  return data.success;
}

// login-me 응답: userKey는 평문, 개인정보 필드는 AES-256-GCM 암호문(base64: IV12 + 암호문 + 태그16).
interface TossUserRaw {
  userKey: number | string;
  scope?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  ci?: string | null;
}

export interface TossUser { userKey: string; name: string | null; email: string | null }

function decryptField(encryptedBase64: string): string {
  const key = Buffer.from(process.env.TOSS_AIT_DECRYPT_KEY!, "base64");
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const body = buf.subarray(12, buf.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAAD(Buffer.from(process.env.TOSS_AIT_AAD!));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

// 이름·이메일만 복호화한다 — 전화·CI는 요청 scope에 없고, 받더라도 저장하지 않는다.
export async function fetchTossUser(accessToken: string): Promise<TossUser> {
  const { status, data } = await mtlsRequest<TossUserRaw>(`${AUTH_API_BASE}/login-me`, "GET", undefined, { Authorization: accessToken });
  if (status !== 200 || data.resultType !== "SUCCESS" || data.success?.userKey === undefined) {
    throw new Error(`토스 사용자 조회 실패 (${status} ${data.error?.errorCode ?? ""})`);
  }
  const u = data.success;
  const safe = (v: string | null | undefined) => {
    if (typeof v !== "string" || !v) return null;
    try { return decryptField(v); } catch { return null; }
  };
  return { userKey: String(u.userKey), name: safe(u.name), email: safe(u.email) };
}

// 토스 쪽 연결 해제(계정 연결 끊기 콜백 대응용) — 실패해도 우리 세션 정리는 진행한다.
export async function removeTossAccessByUserKey(userKey: string): Promise<void> {
  try { await mtlsRequest(`${AUTH_API_BASE}/access/remove-by-user-key`, "POST", { userKey }); }
  catch (e) { console.warn("[toss-ait] remove-by-user-key 실패:", e instanceof Error ? e.message : e); }
}
