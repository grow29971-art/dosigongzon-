// OG 이미지용 사진 변환 — satori(next/og)는 webp를 못 그린다(2026-09-16 findings).
// 허용 호스트의 사진을 받아 sharp로 400px jpeg로 바꿔 data URI로 넘긴다. 실패하면 ""(회색 면 폴백).
// runtime="nodejs" OG 라우트에서만 import — sharp는 edge에서 못 쓴다.
import "server-only";

const MAX_BYTES = 8 * 1024 * 1024;

export async function ogPhotoDataUri(url: string, size = 400): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return "";
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(buf).rotate().resize(size, size, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.warn("[og-photo] 변환 실패 — 사진 없이 렌더:", err instanceof Error ? err.message : err);
    return "";
  }
}
