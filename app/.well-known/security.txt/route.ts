// RFC 9116 security.txt — 보안 취약점 보고 연락처 공개.
// 접근 URL: https://dosigongzon.com/.well-known/security.txt

export const dynamic = "force-static";
export const revalidate = 86400; // 1일 캐시

export async function GET() {
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const expires = oneYearLater.toISOString();

  const body = [
    `Contact: mailto:grow29971@gmail.com`,
    `Expires: ${expires}`,
    `Preferred-Languages: ko, en`,
    `Canonical: https://dosigongzon.com/.well-known/security.txt`,
    `Policy: https://dosigongzon.com/privacy`,
    ``,
    `# 도시공존 — 길고양이 돌봄 시민 참여 플랫폼`,
    `# 보안 취약점을 발견하셨다면 위 이메일로 연락해주세요.`,
    `# 악의적 탐지·대량 스캔은 삼가주시고, 책임있는 공개(responsible disclosure)를 따라주세요.`,
    ``,
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
