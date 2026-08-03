// catch 게임 기능 플래그 — P3~P5가 공유하는 단일 소스 (2026-08-04).
//
// CATCH_BATTLE_ENABLED: 배틀(PVE/PVP) 축 노출 여부.
//   P3 시점엔 배틀 컨텐츠가 아직 없어 도감의 "배틀" 탭은 자리(빈 상태)만 렌더되고,
//   배틀 전적 기반 업적(streak_5·boss_5)도 이 플래그로 함께 묶인다.
//   P4가 배틀을 이식하면 탭 내용이 채워진다 — 플래그를 끄면 탭·업적이 동시에 숨는다
//   (냥줍 BATTLE_ENABLED 다마고치 피벗과 같은 패턴).
export const CATCH_BATTLE_ENABLED = true;
