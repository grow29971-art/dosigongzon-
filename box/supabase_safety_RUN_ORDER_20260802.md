# 🛡 학대방지·캣맘보호 SQL 실행 순서 (2026-08-02)

코드는 배포됐지만 **아래 SQL을 실행하기 전까지 B-1(QR 지킴판)·B-2(증거 첨부)는 동작하지 않습니다**
(테이블·버킷이 없어서 안전하게 실패). A-1·A-2(112 전화·내 위치 보내기)는 DB 무관 — 이미 동작 중.

실행 위치: Supabase Dashboard → SQL Editor (Chrome 번역 끄고)

## 실행 순서

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `box/supabase_guardian_qr_migration.sql` | guardian_zones + zone_reports + RLS |
| 2 | `box/supabase_report_evidence_migration.sql` | report-evidence 버킷(비공개) + report_evidence + RLS |

두 파일은 서로 독립 — 순서가 바뀌어도 무방하나 위 순서 권장.

## 실행 후 검증 (필수)

anon 키로 REST 프로브 (PowerShell):
```powershell
$h = @{ apikey = "<ANON_KEY>" }
# 1) 제보 열람 차단 — 빈 배열이어야 함
irm "https://<프로젝트>.supabase.co/rest/v1/zone_reports?select=id" -Headers $h
# 2) 제보 직접 insert 차단 — 401/403이어야 함
irm "https://<프로젝트>.supabase.co/rest/v1/zone_reports" -Method Post -Headers $h -Body '{}' -ContentType "application/json"
# 3) 활성 구역 라벨은 조회 가능 (랜딩용)
irm "https://<프로젝트>.supabase.co/rest/v1/guardian_zones?select=id,label&active=eq.true" -Headers $h
# 4) 증거 열람 차단 — 빈 배열이어야 함
irm "https://<프로젝트>.supabase.co/rest/v1/report_evidence?select=id" -Headers $h
```

기능 검증:
1. `/admin/zones`에서 구역 1개 생성 → QR 저장 → 스캔(또는 `/z/<id>` 직접 접속) → 익명 제보 1건 전송 → admin에서 확인·이관·종결 흐름 확인.
2. 아무 게시글 신고하기 → 사진 1장 첨부 → admin 신고함에서 사진 썸네일 + "기관 이관 서식 복사" 확인.
3. 파기 cron 수동 확인(선택): `POST /api/cron/purge-safety-data` + `Authorization: Bearer <CRON_SECRET>` → `{ zoneReportsPurged: 0, ... }` 200.

## 법적 금지선 자가 검증 결과 (구현 시점)

- [x] 유저 GPS 좌표 서버 저장 경로 0건 — A-1/A-2는 fetch·supabase 호출 없는 클라 전용, B-1은 구역 ID 태깅만(제보자 GPS·IP·UA 미수집), B-2 사진은 canvas 재인코딩으로 EXIF 제거 후 업로드
- [x] 피제보자 신원 컬럼 없음 (guardian_zones·zone_reports·report_evidence 전부)
- [x] 판정 상태값 없음 — zone_reports: received→forwarded→closed만
- [x] "안전 보장/자동신고" 카피 없음 — "전화 앱을 대신 여는 바로가기"로 표기
- [x] 112/119는 2탭 확인 후 tel: 딥링크 (자동발신 불가)
- [x] zone_reports·report_evidence 전 행 purge_at 기본값(+90일) + purge-safety-data cron(매일 03:40 KST)
- [ ] anon RLS 프로브 — **SQL 실행 후 위 검증 절차로 실측 필요**

## 롤백

각 SQL 파일 하단 ROLLBACK 주석 참조. 코드 롤백은 해당 커밋 revert.
