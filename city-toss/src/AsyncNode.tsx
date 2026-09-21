import { useEffect, useState, type ReactNode } from "react";

// async 서버 컴포넌트(props → Promise<JSX>)를 클라이언트에서 그리는 최소 어댑터 — 함수로 호출해 결과만 렌더.
export default function AsyncNode<P extends object>({ fn, props }: { fn: (p: P) => Promise<ReactNode> | ReactNode; props: P }) {
  const [node, setNode] = useState<ReactNode>(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(fn(props)).then((n) => { if (alive) setNode(n); }).catch((e) => console.error("[AsyncNode]", e));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);
  return <>{node}</>;
}
