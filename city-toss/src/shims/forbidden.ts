// 서버 전용 모듈(service_role·next/headers)은 미니앱 번들에 절대 들어오면 안 된다 — import 자체를 실패시킨다.
throw new Error("서버 전용 모듈은 미니앱에서 쓸 수 없어요.");
export {};
