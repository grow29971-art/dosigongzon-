import type { CSSProperties, ImgHTMLAttributes } from "react";

// next/image 대체 — 최적화 없이 <img>. fill은 absolute inset:0.
type StaticImageData = { src: string; width?: number; height?: number };
interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | StaticImageData;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
  sizes?: string;
  placeholder?: string;
  blurDataURL?: string;
}
export default function Image({ src, fill, priority, quality, unoptimized, placeholder, blurDataURL, style, ...rest }: Props) {
  void priority; void quality; void unoptimized; void placeholder; void blurDataURL;
  const s = typeof src === "string" ? src : src.src;
  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: (style?.objectFit as CSSProperties["objectFit"]) ?? "cover" }
    : undefined;
  return <img src={s} style={{ ...fillStyle, ...style }} {...rest} />;
}
