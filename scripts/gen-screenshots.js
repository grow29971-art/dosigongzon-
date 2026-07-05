// App Store 스크린샷 생성 — iPhone 6.5" (1242x2688 = 414x896 @3x)
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const OUT = path.join("C:\\Users\\1\\Desktop\\AppStoreScreenshots");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const W = 414, H = 896, DPR = 3;

const STATUS = `
<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px 8px;background:transparent;font-size:15px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px;">
  <span>9:41</span>
  <div style="display:flex;gap:6px;align-items:center;">
    <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="#1a1a1a"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="#1a1a1a"/><rect x="9" y="0.5" width="3" height="11.5" rx="1" fill="#1a1a1a"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#1a1a1a"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.5 14.2 5.2L15.5 3.8C13.6 1.8 11 0.5 8 0.5C5 0.5 2.4 1.8 0.5 3.8L1.8 5.2C3.3 3.5 5.5 2.5 8 2.5Z" fill="#1a1a1a"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.3L13.6 5.9C12.1 4.5 10.1 3.5 8 3.5C5.9 3.5 3.9 4.5 2.4 5.9L3.7 7.3C4.8 6.2 6.3 5.5 8 5.5Z" fill="#1a1a1a"/><circle cx="8" cy="10" r="1.5" fill="#1a1a1a"/></svg>
    <div style="display:flex;align-items:center;gap:2px;">
      <div style="width:25px;height:12px;border:1.5px solid #1a1a1a;border-radius:3px;padding:1.5px;display:flex;align-items:center;">
        <div style="width:75%;height:100%;background:#1a1a1a;border-radius:1.5px;"></div>
      </div>
    </div>
  </div>
</div>`;

const BOTTOM_NAV = (active) => {
  const items = [
    { key:"home", icon:`<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`, label:"홈" },
    { key:"map", icon:`<circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/>`, label:"지도" },
    { key:"community", icon:`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`, label:"커뮤니티" },
    { key:"shop", icon:`<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`, label:"쇼핑" },
    { key:"my", icon:`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`, label:"마이" },
  ];
  return `<div style="display:flex;background:white;border-top:1px solid #f0ede8;padding:8px 0 20px;">
    ${items.map(it => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${it.key===active?'#C47E5A':'#999'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><${it.icon.startsWith('<')?'':''}/>${it.icon}</svg>
      <span style="font-size:10px;color:${it.key===active?'#C47E5A':'#999'};font-weight:${it.key===active?'700':'500'};">${it.label}</span>
    </div>`).join("")}
  </div>`;
};

const BASE = `font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;margin:0;padding:0;background:#F5F3EE;`;
const CARD = `background:white;border-radius:18px;box-shadow:0 4px 16px rgba(0,0,0,0.07);`;
const BTN_PRIMARY = `background:linear-gradient(135deg,#C47E5A,#A85E3A);color:white;border:none;border-radius:14px;font-weight:800;font-size:16px;padding:16px;width:100%;cursor:pointer;`;

const screens = [
/* ─── 01 히어로 ─────────────────────────────── */
{ name:"01_hero", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(160deg,#FDF9F5 0%,#F5EDE3 50%,#EDD9C8 100%);}</style></head><body>
${STATUS}
<div style="padding:30px 28px 0;text-align:center;">
  <div style="width:80px;height:80px;background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:24px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(196,126,90,0.4);">
    <span style="font-size:40px;">🐾</span>
  </div>
  <p style="font-size:13px;font-weight:700;color:#C47E5A;letter-spacing:0.12em;margin:0 0 10px;">FOR THE CITY</p>
  <h1 style="font-size:28px;font-weight:900;color:#1a1a1a;line-height:1.25;margin:0 0 14px;letter-spacing:-0.5px;">전국 길고양이<br>돌봄 시민 참여 플랫폼</h1>
  <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 28px;">케어테이커가 고양이의 TNR·건강·급식을<br>기록하고, 이웃과 함께 돌봐요.</p>

  <div style="display:flex;gap:12px;margin-bottom:28px;">
    <div style="${CARD}flex:1;padding:18px;text-align:center;">
      <p style="font-size:26px;font-weight:900;color:#C47E5A;margin:0 0 4px;">220<span style="font-size:14px;">마리</span></p>
      <p style="font-size:11px;color:#999;margin:0;">등록된 고양이</p>
    </div>
    <div style="${CARD}flex:1;padding:18px;text-align:center;">
      <p style="font-size:26px;font-weight:900;color:#C47E5A;margin:0 0 4px;">288<span style="font-size:14px;">명</span></p>
      <p style="font-size:11px;color:#999;margin:0;">케어테이커</p>
    </div>
    <div style="${CARD}flex:1;padding:18px;text-align:center;">
      <p style="font-size:26px;font-weight:900;color:#C47E5A;margin:0 0 4px;">17<span style="font-size:14px;">개</span></p>
      <p style="font-size:11px;color:#999;margin:0;">도시 참여</p>
    </div>
  </div>

  <button style="${BTN_PRIMARY}margin-bottom:14px;">🐾 지금 시작하기 — 무료</button>
  <p style="font-size:12px;color:#aaa;margin:0;">광고 없음 · 10초 가입 · 완전 무료</p>
</div>
<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("home")}
</div>
</body></html>` },

/* ─── 02 지도 ─────────────────────────────── */
{ name:"02_map", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;background:#E8E0D5;}</style></head><body>
${STATUS}
<div style="background:#F5F3EE;padding:8px 16px 12px;display:flex;gap:8px;align-items:center;">
  <div style="flex:1;background:white;border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <span style="font-size:13px;color:#bbb;">이름·태그로 찾기</span>
  </div>
  <div style="background:white;border-radius:12px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C47E5A" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
  </div>
</div>

<!-- 지도 배경 -->
<div style="position:relative;height:480px;background:linear-gradient(180deg,#E8EAD3 0%,#D5D9B8 100%);overflow:hidden;">
  <!-- 도로 -->
  <div style="position:absolute;top:120px;left:0;right:0;height:28px;background:#F2EFE4;opacity:0.8;"></div>
  <div style="position:absolute;top:280px;left:0;right:0;height:22px;background:#F2EFE4;opacity:0.8;"></div>
  <div style="position:absolute;top:0;bottom:0;left:160px;width:20px;background:#F2EFE4;opacity:0.8;"></div>
  <div style="position:absolute;top:0;bottom:0;left:280px;width:16px;background:#F2EFE4;opacity:0.8;"></div>
  <!-- 건물 블록 -->
  <div style="position:absolute;top:50px;left:40px;width:100px;height:55px;background:#D8D2C2;border-radius:6px;opacity:0.7;"></div>
  <div style="position:absolute;top:50px;left:190px;width:75px;height:55px;background:#D8D2C2;border-radius:6px;opacity:0.7;"></div>
  <div style="position:absolute;top:50px;left:305px;width:85px;height:55px;background:#D8D2C2;border-radius:6px;opacity:0.7;"></div>
  <div style="position:absolute;top:160px;left:40px;width:105px;height:105px;background:#D2CCB8;border-radius:6px;opacity:0.7;"></div>
  <div style="position:absolute;top:160px;left:190px;width:80px;height:105px;background:#D2CCB8;border-radius:6px;opacity:0.7;"></div>
  <div style="position:absolute;top:160px;left:305px;width:85px;height:105px;background:#D2CCB8;border-radius:6px;opacity:0.7;"></div>
  <div style="position:absolute;top:315px;left:40px;width:105px;height:120px;background:#D8D2C2;border-radius:6px;opacity:0.7;"></div>
  <div style="position:absolute;top:315px;left:190px;width:80px;height:120px;background:#D8D2C2;border-radius:6px;opacity:0.7;"></div>
  <!-- 고양이 마커 -->
  <div style="position:absolute;top:60px;left:55px;">
    <div style="background:#C47E5A;color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(196,126,90,0.5);">🐱 도이</div>
    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #C47E5A;margin:0 auto;"></div>
  </div>
  <div style="position:absolute;top:80px;left:200px;">
    <div style="background:#5A8BC4;color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(90,139,196,0.5);">🐱 펑이</div>
    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #5A8BC4;margin:0 auto;"></div>
  </div>
  <div style="position:absolute;top:170px;left:60px;">
    <div style="background:#7BAE5A;color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(123,174,90,0.5);">🐱 고양이</div>
    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #7BAE5A;margin:0 auto;"></div>
  </div>
  <div style="position:absolute;top:195px;left:200px;">
    <div style="background:#C47E5A;color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(196,126,90,0.5);">🐱 미야</div>
    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #C47E5A;margin:0 auto;"></div>
  </div>
  <div style="position:absolute;top:325px;left:55px;">
    <div style="background:#AE5A8B;color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(174,90,139,0.5);">🐱 냥이</div>
    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #AE5A8B;margin:0 auto;"></div>
  </div>
  <!-- 내 위치 -->
  <div style="position:absolute;top:295px;left:195px;width:20px;height:20px;background:#4285F4;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(66,133,244,0.6);"></div>
  <div style="position:absolute;top:291px;left:191px;width:28px;height:28px;background:rgba(66,133,244,0.2);border-radius:50%;"></div>

  <!-- 고양이 수 배지 -->
  <div style="position:absolute;top:16px;right:16px;background:white;border-radius:12px;padding:8px 14px;box-shadow:0 4px 14px rgba(0,0,0,0.15);">
    <p style="font-size:11px;color:#999;margin:0 0 1px;">이 지역 고양이</p>
    <p style="font-size:18px;font-weight:900;color:#C47E5A;margin:0;">5마리</p>
  </div>
  <!-- + 버튼 -->
  <div style="position:absolute;bottom:16px;right:16px;width:52px;height:52px;background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(196,126,90,0.5);">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </div>
</div>

<!-- 하단 필터 탭 -->
<div style="background:#F5F3EE;padding:10px 16px;display:flex;gap:8px;overflow-x:auto;">
  <div style="background:#C47E5A;color:white;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;">전체 5</div>
  <div style="background:white;color:#666;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid #eee;white-space:nowrap;">내 활동동</div>
  <div style="background:white;color:#666;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid #eee;white-space:nowrap;">TNR 완료</div>
  <div style="background:white;color:#666;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid #eee;white-space:nowrap;">급식 중</div>
</div>

<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("map")}
</div>
</body></html>` },

/* ─── 03 고양이 등록 ─────────────────────────────── */
{ name:"03_register", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="padding:0 20px;background:#F5F3EE;">
  <div style="display:flex;align-items:center;padding:4px 0 16px;gap:12px;">
    <div style="width:36px;height:36px;background:white;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
    </div>
    <h2 style="font-size:20px;font-weight:900;color:#1a1a1a;margin:0;">우리 동네 고양이 등록</h2>
  </div>
</div>

<div style="overflow-y:auto;height:calc(${H}px - 140px);padding:0 20px 20px;background:#F5F3EE;">
  <!-- 고양이 사진 -->
  <div style="text-align:center;margin-bottom:20px;">
    <div style="width:110px;height:110px;background:linear-gradient(135deg,#EDD9C8,#D4B896);border-radius:32px;margin:0 auto;display:flex;align-items:center;justify-content:center;border:3px dashed #C47E5A;position:relative;">
      <div style="text-align:center;">
        <span style="font-size:40px;">🐱</span>
        <p style="font-size:11px;color:#C47E5A;font-weight:700;margin:4px 0 0;">사진 추가</p>
      </div>
    </div>
  </div>

  <!-- 입력 필드들 -->
  <div style="${CARD}padding:20px;margin-bottom:14px;">
    <p style="font-size:12px;font-weight:700;color:#C47E5A;margin:0 0 8px;letter-spacing:0.05em;">고양이 이름</p>
    <div style="background:#F8F5F2;border-radius:10px;padding:12px 14px;font-size:15px;color:#1a1a1a;font-weight:600;">도이</div>
  </div>

  <div style="${CARD}padding:20px;margin-bottom:14px;">
    <p style="font-size:12px;font-weight:700;color:#C47E5A;margin:0 0 12px;letter-spacing:0.05em;">특징 태그</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <div style="background:#FDF0E8;border:1.5px solid #C47E5A;color:#C47E5A;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;">🎀 암컷</div>
      <div style="background:#FDF0E8;border:1.5px solid #C47E5A;color:#C47E5A;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;">✂️ TNR 완료</div>
      <div style="background:#F5F3EE;border:1.5px solid #ddd;color:#999;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">🍼 수유중</div>
      <div style="background:#F5F3EE;border:1.5px solid #ddd;color:#999;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">🏥 치료중</div>
      <div style="background:#F5F3EE;border:1.5px solid #ddd;color:#999;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">🔴 긴급</div>
    </div>
  </div>

  <div style="${CARD}padding:20px;margin-bottom:20px;">
    <p style="font-size:12px;font-weight:700;color:#C47E5A;margin:0 0 8px;letter-spacing:0.05em;">서식지 위치</p>
    <div style="background:#F0EDE8;border-radius:12px;height:80px;display:flex;align-items:center;justify-content:center;gap:8px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C47E5A" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/></svg>
      <span style="font-size:13px;color:#C47E5A;font-weight:700;">검단1동 아파트 화단 앞</span>
    </div>
  </div>

  <button style="${BTN_PRIMARY}">🐾 고양이 등록하기</button>
</div>
</body></html>` },

/* ─── 04 케어 기록 ─────────────────────────────── */
{ name:"04_care", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="padding:0 20px 16px;background:#F5F3EE;">
  <h2 style="font-size:22px;font-weight:900;color:#1a1a1a;margin:4px 0 4px;">도이의 케어 기록 📋</h2>
  <p style="font-size:13px;color:#999;margin:0;">최근 활동 · 오늘 급식 완료 ✅</p>
</div>

<div style="overflow-y:auto;height:calc(${H}px - 155px);padding:0 20px 16px;background:#F5F3EE;">
  <!-- 오늘 요약 -->
  <div style="background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:20px;padding:20px;margin-bottom:16px;color:white;">
    <p style="font-size:12px;font-weight:600;opacity:0.8;margin:0 0 6px;">오늘의 케어 요약</p>
    <div style="display:flex;gap:20px;">
      <div style="text-align:center;"><p style="font-size:24px;font-weight:900;margin:0;">2</p><p style="font-size:11px;opacity:0.8;margin:0;">급식</p></div>
      <div style="text-align:center;"><p style="font-size:24px;font-weight:900;margin:0;">1</p><p style="font-size:11px;opacity:0.8;margin:0;">건강체크</p></div>
      <div style="text-align:center;"><p style="font-size:24px;font-weight:900;margin:0;">✓</p><p style="font-size:11px;opacity:0.8;margin:0;">TNR</p></div>
    </div>
  </div>

  <!-- 타임라인 -->
  ${[
    { time:"오후 6:20", type:"급식", icon:"🍚", color:"#7BAE5A", desc:"건식 50g + 간식 1개, 잘 먹었어요 😊", badge:"급식"},
    { time:"오전 10:15", type:"건강 체크", icon:"💊", color:"#5A8BC4", desc:"눈 충혈 호전, 항생제 점안 완료", badge:"건강"},
    { time:"어제 저녁", type:"급식", icon:"🍚", color:"#7BAE5A", desc:"건식 40g, 물 교체 완료", badge:"급식"},
    { time:"2일 전", type:"특이사항", icon:"⚠️", color:"#E8A838", desc:"오른쪽 눈 충혈 발견, 병원 방문 예정", badge:"긴급"},
  ].map(r => `
  <div style="${CARD}padding:16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;">
    <div style="width:40px;height:40px;background:${r.color}20;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${r.icon}</div>
    <div style="flex:1;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:800;color:#1a1a1a;">${r.type}</span>
        <span style="font-size:11px;color:#bbb;">${r.time}</span>
      </div>
      <p style="font-size:12px;color:#666;margin:0;line-height:1.5;">${r.desc}</p>
    </div>
  </div>`).join("")}
</div>

<!-- FAB -->
<div style="position:absolute;bottom:88px;right:20px;width:56px;height:56px;background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(196,126,90,0.5);">
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
</div>

<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("map")}
</div>
</body></html>` },

/* ─── 05 커뮤니티 ─────────────────────────────── */
{ name:"05_community", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="padding:0 20px 14px;background:#F5F3EE;display:flex;justify-content:space-between;align-items:center;">
  <h2 style="font-size:22px;font-weight:900;color:#1a1a1a;margin:4px 0 0;">커뮤니티 💬</h2>
  <div style="background:white;border-radius:10px;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C47E5A" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </div>
</div>

<!-- 카테고리 탭 -->
<div style="display:flex;gap:8px;padding:0 20px 14px;background:#F5F3EE;overflow-x:auto;">
  <div style="background:#C47E5A;color:white;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;">전체</div>
  <div style="background:white;color:#666;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid #eee;white-space:nowrap;">🐱 목격/제보</div>
  <div style="background:white;color:#666;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid #eee;white-space:nowrap;">💊 건강/의료</div>
  <div style="background:white;color:#666;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid #eee;white-space:nowrap;">🍚 급식팁</div>
</div>

<div style="overflow-y:auto;height:calc(${H}px - 185px);padding:0 20px 16px;background:#F5F3EE;">
${[
  { cat:"🐱 목격/제보", title:"검단1동 주유소 옆 고양이 다쳐있어요", user:"이웃사랑", time:"방금", likes:12, comments:8, urgent:true },
  { cat:"💊 건강/의료", title:"TNR 수술 후 회복 잘 되고 있어요 🎉 사진 공유!", user:"펑이엄마", time:"2시간 전", likes:34, comments:15, urgent:false },
  { cat:"🍚 급식팁", title:"겨울철 급식소 보온 방법 공유해요 ❄️", user:"도시지킴이", time:"3시간 전", likes:28, comments:22, urgent:false },
  { cat:"🐱 목격/제보", title:"도이가 오늘도 건강하게 밥 잘 먹었어요", user:"고양이친구", time:"5시간 전", likes:19, comments:7, urgent:false },
].map(p => `
<div style="${CARD}padding:16px;margin-bottom:10px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="width:34px;height:34px;background:linear-gradient(135deg,#EDD9C8,#C47E5A);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">🐾</div>
      <div>
        <p style="font-size:12px;font-weight:700;color:#1a1a1a;margin:0;">${p.user}</p>
        <p style="font-size:11px;color:#bbb;margin:0;">${p.time}</p>
      </div>
    </div>
    ${p.urgent ? `<div style="background:#FF4757;color:white;padding:3px 10px;border-radius:8px;font-size:10px;font-weight:800;">긴급</div>` : `<div style="background:#FDF0E8;color:#C47E5A;padding:3px 10px;border-radius:8px;font-size:10px;font-weight:700;">${p.cat}</div>`}
  </div>
  <p style="font-size:14px;font-weight:700;color:#1a1a1a;margin:0 0 12px;line-height:1.4;">${p.title}</p>
  <div style="display:flex;gap:16px;border-top:1px solid #f5f5f5;padding-top:10px;">
    <div style="display:flex;align-items:center;gap:5px;color:#999;font-size:12px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      ${p.likes}
    </div>
    <div style="display:flex;align-items:center;gap:5px;color:#999;font-size:12px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ${p.comments}
    </div>
  </div>
</div>`).join("")}
</div>

<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("community")}
</div>
</body></html>` },

/* ─── 06 AI 집사 ─────────────────────────────── */
{ name:"06_ai", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="background:white;padding:8px 20px 14px;border-bottom:1px solid #f0ede8;display:flex;align-items:center;gap:12px;">
  <div style="width:40px;height:40px;background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;">🐾</div>
  <div>
    <h3 style="font-size:16px;font-weight:900;color:#1a1a1a;margin:0;">AI 집사</h3>
    <p style="font-size:11px;color:#7BAE5A;font-weight:600;margin:0;">● 온라인</p>
  </div>
</div>

<div style="padding:16px 20px;background:#F5F3EE;height:calc(${H}px - 200px);overflow:hidden;display:flex;flex-direction:column;gap:12px;">
  <!-- 사용자 질문 -->
  <div style="display:flex;justify-content:flex-end;">
    <div style="background:#C47E5A;color:white;padding:12px 16px;border-radius:18px 18px 4px 18px;max-width:75%;font-size:14px;font-weight:500;line-height:1.5;box-shadow:0 4px 12px rgba(196,126,90,0.35);">
      도이가 눈이 충혈돼 있어요. 어떻게 해야 하나요? 😢
    </div>
  </div>
  <!-- AI 응답 -->
  <div style="display:flex;gap:10px;align-items:flex-start;">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🐾</div>
    <div style="background:white;padding:14px 16px;border-radius:4px 18px 18px 18px;max-width:78%;box-shadow:0 4px 14px rgba(0,0,0,0.08);">
      <p style="font-size:13px;color:#1a1a1a;line-height:1.6;margin:0 0 10px;font-weight:500;">눈 충혈은 여러 원인이 있어요. 주로 결막염이나 이물질이 원인이에요! 🏥</p>
      <div style="background:#FDF0E8;border-radius:12px;padding:12px;">
        <p style="font-size:12px;font-weight:800;color:#C47E5A;margin:0 0 8px;">✅ 즉시 해야 할 것</p>
        <p style="font-size:12px;color:#555;line-height:1.7;margin:0;">1. 생리식염수로 눈 세척<br>2. 긁지 못하게 넥카라 착용<br>3. 48시간 내 동물병원 방문<br>4. 이후 건강 기록에 메모</p>
      </div>
    </div>
  </div>
  <!-- 사용자 답변 -->
  <div style="display:flex;justify-content:flex-end;">
    <div style="background:#C47E5A;color:white;padding:12px 16px;border-radius:18px 18px 4px 18px;max-width:75%;font-size:14px;line-height:1.5;box-shadow:0 4px 12px rgba(196,126,90,0.35);">
      가까운 동물병원은 어디 있나요?
    </div>
  </div>
  <!-- AI 두번째 -->
  <div style="display:flex;gap:10px;align-items:flex-start;">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🐾</div>
    <div style="background:white;padding:14px 16px;border-radius:4px 18px 18px 18px;max-width:78%;box-shadow:0 4px 14px rgba(0,0,0,0.08);">
      <p style="font-size:13px;color:#1a1a1a;line-height:1.6;margin:0;font-weight:500;">지도 탭에서 주변 동물병원을 찾을 수 있어요! 필터에서 🏥 병원을 선택하면 거리순으로 보여요.</p>
    </div>
  </div>
</div>

<!-- 입력창 -->
<div style="position:absolute;bottom:0;left:0;right:0;background:white;padding:12px 16px 28px;border-top:1px solid #f0ede8;display:flex;gap:10px;align-items:center;">
  <div style="flex:1;background:#F5F3EE;border-radius:22px;padding:11px 18px;font-size:14px;color:#bbb;">고양이 케어를 물어보세요...</div>
  <div style="width:44px;height:44px;background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  </div>
</div>
</body></html>` },

/* ─── 07 보호지침 ─────────────────────────────── */
{ name:"07_guide", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="padding:0 20px 14px;background:#F5F3EE;">
  <h2 style="font-size:22px;font-weight:900;color:#1a1a1a;margin:4px 0 2px;">보호지침 📚</h2>
  <p style="font-size:13px;color:#999;margin:0;">고양이를 올바르게 돌봐요</p>
</div>

<div style="overflow-y:auto;height:calc(${H}px - 155px);padding:0 20px 16px;background:#F5F3EE;">
  <!-- 배너 -->
  <div style="background:linear-gradient(135deg,#1a3a2a,#2d6a4f);border-radius:20px;padding:20px;margin-bottom:16px;color:white;">
    <p style="font-size:12px;font-weight:600;opacity:0.7;margin:0 0 4px;">🌿 CARE GUIDE</p>
    <h3 style="font-size:18px;font-weight:900;margin:0 0 6px;line-height:1.3;">TNR이란 무엇인가요?</h3>
    <p style="font-size:12px;opacity:0.8;margin:0 0 14px;line-height:1.5;">중성화 수술로 개체 수를 조절하고<br>고양이와 도시가 공존해요.</p>
    <div style="background:rgba(255,255,255,0.2);display:inline-block;padding:7px 16px;border-radius:10px;font-size:12px;font-weight:700;">자세히 알아보기 →</div>
  </div>

  <!-- 가이드 카드들 -->
  ${[
    { icon:"🍚", title:"올바른 급식 방법", desc:"위생 급식소 설치 · 물 교체 · 적정량 제공", color:"#7BAE5A" },
    { icon:"💊", title:"약품 안전 가이드", desc:"고양이에게 위험한 약품 목록 확인하기", color:"#5A8BC4" },
    { icon:"🏥", title:"응급 상황 대처법", desc:"부상·질병 발견 시 즉시 해야 할 것들", color:"#E86B8C" },
    { icon:"❄️", title:"계절별 케어 팁", desc:"여름·겨울 길고양이를 지키는 방법", color:"#C47E5A" },
    { icon:"⚖️", title:"동물보호법 알기", desc:"고양이 학대는 범죄입니다. 신고 방법 안내", color:"#8B5A3A" },
  ].map(g => `
  <div style="${CARD}padding:16px;margin-bottom:10px;display:flex;gap:14px;align-items:center;">
    <div style="width:48px;height:48px;background:${g.color}18;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${g.icon}</div>
    <div style="flex:1;">
      <p style="font-size:14px;font-weight:800;color:#1a1a1a;margin:0 0 3px;">${g.title}</p>
      <p style="font-size:12px;color:#888;margin:0;line-height:1.4;">${g.desc}</p>
    </div>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
  </div>`).join("")}
</div>

<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("home")}
</div>
</body></html>` },

/* ─── 08 마이페이지 ─────────────────────────────── */
{ name:"08_mypage", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="background:F5F3EE;padding:0 20px 20px;">
  <h2 style="font-size:22px;font-weight:900;color:#1a1a1a;margin:4px 0 0;">마이페이지</h2>
</div>

<div style="overflow-y:auto;height:calc(${H}px - 130px);background:#F5F3EE;">
  <!-- 프로필 카드 -->
  <div style="margin:0 20px 16px;">
    <div style="background:linear-gradient(135deg,#C47E5A,#8B5A3A);border-radius:24px;padding:24px;color:white;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
        <div style="width:60px;height:60px;background:rgba(255,255,255,0.25);border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:30px;">😊</div>
        <div>
          <p style="font-size:18px;font-weight:900;margin:0 0 3px;">희망가득</p>
          <div style="background:rgba(255,255,255,0.25);display:inline-block;padding:3px 12px;border-radius:8px;font-size:11px;font-weight:700;">🌱 새싹 케어테이커</div>
        </div>
      </div>
      <div style="display:flex;gap:0;">
        <div style="flex:1;text-align:center;border-right:1px solid rgba(255,255,255,0.2);">
          <p style="font-size:22px;font-weight:900;margin:0;">15</p>
          <p style="font-size:10px;opacity:0.8;margin:0;">연속 스트릭 🔥</p>
        </div>
        <div style="flex:1;text-align:center;border-right:1px solid rgba(255,255,255,0.2);">
          <p style="font-size:22px;font-weight:900;margin:0;">82</p>
          <p style="font-size:10px;opacity:0.8;margin:0;">총 케어 횟수</p>
        </div>
        <div style="flex:1;text-align:center;">
          <p style="font-size:22px;font-weight:900;margin:0;">Lv.4</p>
          <p style="font-size:10px;opacity:0.8;margin:0;">현재 레벨</p>
        </div>
      </div>
    </div>
  </div>

  <!-- 업적 뱃지 -->
  <div style="margin:0 20px 16px;">
    <div style="${CARD}padding:18px;">
      <p style="font-size:14px;font-weight:900;color:#1a1a1a;margin:0 0 14px;">획득한 업적 🏆</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${[
          {icon:"🐾",name:"첫 케어"},
          {icon:"🔥",name:"7일 연속"},
          {icon:"🏥",name:"TNR 도움"},
          {icon:"⭐",name:"커뮤니티"},
          {icon:"🌱",name:"새싹"},
          {icon:"❓",name:"잠김"},
        ].map(b => `<div style="text-align:center;width:52px;">
          <div style="width:52px;height:52px;background:${b.icon==="❓"?"#f5f5f5":"linear-gradient(135deg,#FDF0E8,#EDD9C8)"};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:4px;border:${b.icon==="❓"?"2px dashed #ddd":"none"};">${b.icon}</div>
          <p style="font-size:10px;color:#888;margin:0;font-weight:600;">${b.name}</p>
        </div>`).join("")}
      </div>
    </div>
  </div>

  <!-- 메뉴 -->
  <div style="margin:0 20px;">
    <div style="${CARD}overflow:hidden;">
      ${[
        {icon:"🐱", label:"내 고양이 목록"},
        {icon:"📋", label:"내 활동 기록"},
        {icon:"🔔", label:"알림 설정"},
        {icon:"⚙️", label:"계정 정보"},
      ].map((m,i) => `
      <div style="display:flex;align-items:center;padding:16px 18px;${i>0?"border-top:1px solid #f8f5f2":""};">
        <span style="font-size:20px;margin-right:12px;">${m.icon}</span>
        <span style="font-size:14px;font-weight:600;color:#1a1a1a;flex:1;">${m.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`).join("")}
    </div>
  </div>
</div>

<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("my")}
</div>
</body></html>` },

/* ─── 09 스트릭/활동 ─────────────────────────────── */
{ name:"09_streak", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="padding:0 20px 14px;background:#F5F3EE;">
  <h2 style="font-size:22px;font-weight:900;color:#1a1a1a;margin:4px 0 2px;">활동 스트릭 🔥</h2>
  <p style="font-size:13px;color:#999;margin:0;">매일 케어할수록 레벨이 올라요</p>
</div>

<div style="overflow-y:auto;height:calc(${H}px - 155px);padding:0 20px 16px;background:#F5F3EE;">
  <!-- 스트릭 카드 -->
  <div style="background:linear-gradient(135deg,#FF6B35,#E8A838);border-radius:22px;padding:24px;margin-bottom:16px;color:white;text-align:center;">
    <p style="font-size:14px;font-weight:700;opacity:0.85;margin:0 0 4px;">현재 연속 기록</p>
    <p style="font-size:64px;font-weight:900;margin:0;line-height:1;">15</p>
    <p style="font-size:18px;font-weight:800;margin:0 0 16px;">일 연속 🔥🔥</p>
    <div style="background:rgba(255,255,255,0.2);border-radius:12px;padding:10px 20px;display:inline-block;">
      <p style="font-size:12px;font-weight:700;margin:0;">다음 목표: 30일 연속 달성!</p>
    </div>
  </div>

  <!-- 주간 달력 -->
  <div style="${CARD}padding:18px;margin-bottom:14px;">
    <p style="font-size:13px;font-weight:800;color:#1a1a1a;margin:0 0 14px;">이번 달 활동</p>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center;margin-bottom:8px;">
      ${["월","화","수","목","금","토","일"].map(d=>`<p style="font-size:11px;color:#bbb;font-weight:600;margin:0;">${d}</p>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
      ${Array.from({length:30},(_,i)=>{
        const day=i+1;
        const done=day<=15&&day%3!==0;
        const today=day===15;
        return `<div style="aspect-ratio:1;border-radius:8px;background:${today?"#C47E5A":done?"#FDF0E8":"#f8f8f8"};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:${today?"900":"600"};color:${today?"white":done?"#C47E5A":"#ccc"};">
          ${done||today?"🔥":day}
        </div>`;
      }).join("")}
    </div>
  </div>

  <!-- 레벨 진행 -->
  <div style="${CARD}padding:18px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <p style="font-size:13px;font-weight:800;color:#1a1a1a;margin:0;">Lv.4 → Lv.5</p>
      <p style="font-size:12px;color:#C47E5A;font-weight:700;margin:0;">82 / 100 XP</p>
    </div>
    <div style="background:#f0ede8;border-radius:8px;height:10px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#C47E5A,#E86B8C);height:100%;width:82%;border-radius:8px;"></div>
    </div>
    <p style="font-size:11px;color:#bbb;margin:8px 0 0;">다음 레벨까지 18 XP 남았어요!</p>
  </div>
</div>

<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("my")}
</div>
</body></html>` },

/* ─── 10 쇼핑/알림 ─────────────────────────────── */
{ name:"10_notification", html:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{${BASE}width:${W}px;height:${H}px;overflow:hidden;}</style></head><body>
${STATUS}
<div style="padding:0 20px 14px;background:#F5F3EE;display:flex;justify-content:space-between;align-items:center;">
  <h2 style="font-size:22px;font-weight:900;color:#1a1a1a;margin:4px 0 0;">알림 🔔</h2>
  <span style="font-size:12px;color:#C47E5A;font-weight:700;">모두 읽음</span>
</div>

<div style="overflow-y:auto;height:calc(${H}px - 155px);padding:0 20px 16px;background:#F5F3EE;">
  <!-- 긴급 알림 -->
  <div style="background:linear-gradient(135deg,#FF4757,#C0392B);border-radius:18px;padding:16px;margin-bottom:14px;color:white;display:flex;gap:12px;align-items:flex-start;">
    <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🚨</div>
    <div style="flex:1;">
      <p style="font-size:13px;font-weight:800;margin:0 0 4px;">긴급 · 검단1동</p>
      <p style="font-size:12px;opacity:0.9;line-height:1.5;margin:0;">고양이 "도이"가 부상 신고됐어요. 근처 케어테이커의 도움이 필요해요!</p>
      <p style="font-size:11px;opacity:0.7;margin:6px 0 0;">방금 전</p>
    </div>
  </div>

  ${[
    {icon:"🔥",title:"스트릭 15일 달성!",desc:"대단해요! 15일 연속 케어 기록을 세웠어요. Lv.5까지 18XP 남았어요.",time:"1시간 전",color:"#FF6B35",unread:true},
    {icon:"💬",title:"커뮤니티 댓글",desc:"펑이엄마님이 회원님의 글에 댓글을 달았어요: '고생 많으셨어요!'",time:"2시간 전",color:"#5A8BC4",unread:true},
    {icon:"🐱",title:"도이 급식 알림",desc:"등록하신 도이의 급식 시간이에요. 오늘 아직 기록이 없어요.",time:"오전 8:00",color:"#C47E5A",unread:false},
    {icon:"🏆",title:"새 업적 달성",desc:"'커뮤니티 스타' 업적을 획득했어요! 뱃지를 확인해보세요.",time:"어제",color:"#E8A838",unread:false},
    {icon:"📢",title:"도시공존 업데이트",desc:"v2.1 업데이트: AI 집사 기능이 개선됐어요. 지금 바로 써보세요!",time:"2일 전",color:"#7BAE5A",unread:false},
  ].map(n => `
  <div style="${CARD}padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;${n.unread?"border-left:3px solid #C47E5A;":""}">
    <div style="width:42px;height:42px;background:${n.color}18;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${n.icon}</div>
    <div style="flex:1;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <p style="font-size:13px;font-weight:800;color:#1a1a1a;margin:0 0 4px;">${n.title}</p>
        <span style="font-size:10px;color:#bbb;white-space:nowrap;margin-left:8px;">${n.time}</span>
      </div>
      <p style="font-size:12px;color:#666;margin:0;line-height:1.5;">${n.desc}</p>
    </div>
  </div>`).join("")}
</div>

<div style="position:absolute;bottom:0;left:0;right:0;">
  ${BOTTOM_NAV("home")}
</div>
</body></html>` },
];

(async () => {
  console.log("🚀 브라우저 실행 중...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=ko-KR,ko"],
  });

  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    console.log(`📸 [${i+1}/${screens.length}] ${s.name}`);
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
    await page.setContent(s.html, { waitUntil: "networkidle0" });
    // 한글 폰트 렌더링 대기
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({
      path: path.join(OUT, `${s.name}.png`),
      clip: { x: 0, y: 0, width: W, height: H },
    });
    await page.close();
  }

  await browser.close();
  console.log(`\n✅ 완료! 저장 위치: ${OUT}`);
})();
