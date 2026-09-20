// 꿀팁(tips) 자동 발행 — Vercel Cron 매주 월 12:00 KST (03:00 UTC)
// 배경(2026-09-20): 검색 유입이 유일한 "자동" 유입 채널인데 tips 는 5/15 이후 8편에서 멈춤.
// 롱테일 검색어(TOPICS)를 하나씩 소진하며 Gemini 가 HTML 글 1편을 쓰고 published=true 로 넣는다.
// sitemap(1h 재생성)·feed.xml 이 알아서 집어 간다. 위치·개인·의료 단정 금지는 프롬프트로 강제.
// Gemini 실패/미설정이면 아무것도 쓰지 않는다(폴백 글 없음 — 저품질 글은 색인에 해롭다).
// 수동 호출: POST /api/cron/tips-generate (CRON_SECRET). ?dry=1 이면 생성만 하고 저장 안 함.

import { createServiceClient } from "@/lib/supabase/service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeTipBody } from "@/lib/html-sanitize";

export const maxDuration = 60;

const MODEL_CANDIDATES = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
// /tips 화면과 같은 명의. 자동 글 식별 키이기도 하다(중복 가드가 이 값으로 필터).
const SOURCE_LABEL = "도시공존 AI 집사";

// 검색 의도형 주제 은행 — slug 는 tips.slug 유니크 키라 한 번 쓴 주제는 다시 안 쓴다.
// 순서 = 발행 순서. 새 주제는 뒤에 추가.
const TOPICS: { slug: string; query: string; tags: string[] }[] = [
  { slug: "winter-water-freeze", query: "겨울 길고양이 급식 물 안 얼게 하는 법", tags: ["겨울", "급식"] },
  { slug: "kitten-found-what-to-do", query: "길에서 아기고양이 발견했을 때 해야 할 일과 하면 안 되는 일", tags: ["아깽이", "구조"] },
  { slug: "tnr-how-to-apply", query: "길고양이 TNR 중성화 지자체 신청 방법과 절차", tags: ["TNR", "중성화"] },
  { slug: "stomatitis-signs", query: "길고양이 구내염 의심 증상과 밥 챙기는 요령", tags: ["건강", "구내염"] },
  { slug: "neighbor-complaint", query: "길고양이 밥 주지 말라는 이웃 민원 대응법", tags: ["민원", "이웃"] },
  { slug: "feeding-spot-choose", query: "길고양이 밥자리 위치 고르는 기준", tags: ["급식", "밥자리"] },
  { slug: "summer-food-spoil", query: "여름 길고양이 사료 변질 막는 급식 요령", tags: ["여름", "급식"] },
  { slug: "winter-shelter-diy", query: "스티로폼 박스로 길고양이 겨울집 만드는 법", tags: ["겨울", "쉼터"] },
  { slug: "ear-tip-meaning", query: "길고양이 귀 끝이 잘려 있는 이유(TNR 귀 커팅)", tags: ["TNR"] },
  { slug: "injured-cat-hospital", query: "다친 길고양이 발견 시 병원 데려가는 방법과 비용", tags: ["구조", "병원"] },
  { slug: "abuse-report", query: "길고양이 학대 목격 시 신고 방법과 증거 남기기", tags: ["학대", "신고"] },
  { slug: "herpes-eye-discharge", query: "길고양이 눈곱·콧물 허피스 의심 시 돌봄 요령", tags: ["건강", "허피스"] },
  { slug: "wet-vs-dry-food", query: "길고양이 급식 캔(습식) vs 건사료 무엇을 줄까", tags: ["급식", "사료"] },
  { slug: "feeding-time", query: "길고양이 밥 주는 시간대와 횟수 정하기", tags: ["급식"] },
  { slug: "feeding-station-clean", query: "길고양이 급식소 청소 주기와 방법", tags: ["급식", "위생"] },
  { slug: "pregnant-signs", query: "길고양이 임신 징후와 출산 전후 돌봄", tags: ["아깽이", "건강"] },
  { slug: "dewormer-how", query: "길고양이 구충제 먹이는 방법과 주기", tags: ["건강", "구충"] },
  { slug: "diarrhea-causes", query: "길고양이 설사 원인과 급식 조정", tags: ["건강"] },
  { slug: "flea-tick", query: "길고양이 벼룩·진드기 대처법", tags: ["건강", "위생"] },
  { slug: "gain-trust", query: "길고양이 경계 푸는 법 — 손 타게 하기 전 알아둘 것", tags: ["돌봄", "친화"] },
  { slug: "mating-season-noise", query: "길고양이 발정기 소음과 TNR 의 관계", tags: ["TNR", "민원"] },
  { slug: "territory-fight", query: "길고양이 영역 싸움이 잦을 때 급식자가 할 수 있는 것", tags: ["돌봄"] },
  { slug: "moving-away", query: "이사 갈 때 돌보던 길고양이 인계하는 법", tags: ["돌봄", "인계"] },
  { slug: "cat-died", query: "돌보던 길고양이가 죽었을 때 사체 처리와 신고", tags: ["돌봄", "장례"] },
  { slug: "adoption-process", query: "길고양이 입양 보내는 절차와 입양 전 확인 사항", tags: ["입양"] },
  { slug: "foster-care", query: "길고양이 임시보호(임보)란 무엇이고 어떻게 시작하나", tags: ["입양", "임보"] },
  { slug: "vaccination-needed", query: "길고양이도 예방접종이 필요한가", tags: ["건강", "접종"] },
  { slug: "monsoon-feeding", query: "장마철 길고양이 급식 요령", tags: ["여름", "급식"] },
  { slug: "heatwave-care", query: "폭염 때 길고양이 돌봄 — 물·그늘·급식 시간", tags: ["여름"] },
  { slug: "roadkill-prevent", query: "길고양이 로드킬 줄이는 급식 위치와 습관", tags: ["안전"] },
  { slug: "auto-feeder", query: "길고양이 자동급식기 써도 될까 — 장단점", tags: ["급식", "장비"] },
  { slug: "trap-rental", query: "길고양이 포획틀(통덫) 대여와 사용법", tags: ["TNR", "구조"] },
  { slug: "beginner-kit", query: "초보 길집사 준비물 체크리스트", tags: ["돌봄", "입문"] },
  { slug: "naming-cats", query: "길고양이 이름 짓고 개체 구분하는 요령", tags: ["돌봄", "기록"] },
  { slug: "photo-tips", query: "길고양이 사진 잘 찍는 법(개체 식별용)", tags: ["기록", "사진"] },
  { slug: "skin-hair-loss", query: "길고양이 털 빠짐·피부병 의심 시 대처", tags: ["건강", "피부"] },
  { slug: "water-intake", query: "길고양이 물 급여 — 얼마나, 어떻게", tags: ["급식", "물"] },
  { slug: "care-log-why", query: "길고양이 돌봄 기록을 남겨야 하는 이유", tags: ["기록"] },
  { slug: "winter-feeding-amount", query: "겨울철 길고양이 급식량 늘려야 하는 이유", tags: ["겨울", "급식"] },
  { slug: "care-cost", query: "길고양이 돌봄 월 비용 현실적으로 얼마나 드나", tags: ["돌봄", "비용"] },
];

type Draft = { title: string; description: string; body: string; source: string };

async function generateTip(topic: (typeof TOPICS)[number]): Promise<Draft | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const prompt = [
    "당신은 길고양이 돌봄 앱 '도시공존'의 돌봄 가이드 편집자입니다. 한국 도시 길고양이 돌봄 실무 기준으로 씁니다.",
    `주제(검색어): ${topic.query}`,
    "이 검색어로 검색한 사람이 바로 답을 얻는 실용 가이드 글 1편을 한국어로 작성하세요.",
    "형식: HTML 조각만(전체 문서 아님). <h2> 소제목 3~5개, 각 소제목 아래 <p> 또는 <ul><li>. 첫 단락은 두 문장 요약.",
    "분량: 본문 텍스트 1,200~2,000자. 마지막 <h2>는 '자주 묻는 질문'으로 Q&A 2~3개.",
    "금지: 특정 지역·급식소 위치·개인 언급, 진단·처방 단정(병원 상담 권유는 가능), 근거 없는 수치, 과장·이모지, 앱 광고 문구.",
    "말투: 존댓말, 담백하게. 사람 호칭은 '길집사'.",
    '출력은 JSON 하나만: {"title":"검색어와 맞는 32자 이내 제목","description":"검색 결과용 90~140자 요약","body":"<h2>...</h2><p>...</p>"}',
  ].join("\n");
  const genAI = new GoogleGenerativeAI(apiKey);
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const res = await model.generateContent(prompt);
      const text = res.response.text().replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text) as { title?: string; description?: string; body?: string };
      const title = (parsed.title ?? "").trim();
      const description = (parsed.description ?? "").trim().slice(0, 160);
      const body = sanitizeTipBody((parsed.body ?? "").trim());
      const textLen = body.replace(/<[^>]+>/g, "").length;
      const h2 = (body.match(/<h2/g) ?? []).length;
      if (title.length >= 8 && title.length <= 40 && description.length >= 40 && textLen >= 900 && h2 >= 3) {
        return { title, description, body, source: modelName };
      }
    } catch {
      // 다음 모델
    }
  }
  return null;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const supabase = createServiceClient();

  // 중복 가드 — 최근 6일 내 자동 발행 글이 있으면 스킵(크론 재실행·수동 호출 겹침 방지)
  const since = new Date(Date.now() - 6 * 86400 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("tips")
    .select("id")
    .eq("source_label", SOURCE_LABEL)
    .gte("published_at", since)
    .limit(1);
  if (!dry && recent && recent.length > 0) {
    return Response.json({ ok: true, skipped: "최근 6일 내 자동 발행 글 존재" });
  }

  // 아직 안 쓴 주제 중 첫 번째
  const { data: used } = await supabase.from("tips").select("slug");
  const usedSlugs = new Set(((used ?? []) as { slug: string }[]).map((t) => t.slug));
  const topic = TOPICS.find((t) => !usedSlugs.has(t.slug));
  if (!topic) {
    return Response.json({ ok: true, skipped: "주제 은행 소진 — TOPICS 에 추가 필요" });
  }

  const draft = await generateTip(topic);
  if (!draft) {
    return Response.json({ ok: false, error: "생성 실패(Gemini 미설정·품질 미달)", topic: topic.slug }, { status: 502 });
  }
  if (dry) {
    return Response.json({ ok: true, dry: true, topic: topic.slug, ...draft });
  }

  const { data: tip, error } = await supabase
    .from("tips")
    .insert({
      slug: topic.slug,
      title: draft.title,
      description: draft.description,
      body: draft.body,
      thumbnail_url: null,
      tags: topic.tags,
      source_url: null,
      source_label: SOURCE_LABEL,
      featured: false,
      pinned: false,
      published: true,
      published_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, tip, title: draft.title, model: draft.source });
}

export const GET = POST;

