// "당신의 여정" — 사용자 활동에서 자동으로 추출되는 마일스톤 타임라인.
// 서버에서 1회 집계, 시간순 정렬해서 반환.

import { createClient } from "@/lib/supabase/server";

export type MilestoneCategory =
  | "join"
  | "cat"
  | "care"
  | "comment"
  | "post"
  | "received"
  | "social"
  | "region"
  | "streak";

export interface Milestone {
  id: string;
  date: string;
  category: MilestoneCategory;
  emoji: string;
  title: string;
  desc: string;
  catId?: string; // 관련 고양이 (있으면 클릭 시 이동)
}

const ORDINAL = (n: number) =>
  n === 1 ? "첫 번째" : `${n}번째`;

export async function getMyJourneyServer(userId: string): Promise<Milestone[]> {
  const supabase = await createClient();

  const [
    profileRes,
    catsRes,
    careRes,
    commentRes,
    postRes,
    likeOnMyCatsRes,
    dmRes,
    regionRes,
    inviteRes,
  ] = await Promise.all([
    supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
    supabase
      .from("cats")
      .select("id, name, created_at")
      .eq("caretaker_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("care_logs")
      .select("id, cat_id, logged_at")
      .eq("author_id", userId)
      .order("logged_at", { ascending: true })
      .limit(1000),
    supabase
      .from("cat_comments")
      .select("id, cat_id, created_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: true })
      .limit(1000),
    supabase
      .from("posts")
      .select("id, title, created_at")
      .eq("author_id", userId)
      .eq("hidden", false)
      .order("created_at", { ascending: true })
      .limit(50),
    // 내 고양이가 좋아요 받은 첫 시각
    supabase
      .from("cats")
      .select("id, name, like_count")
      .eq("caretaker_id", userId)
      .gt("like_count", 0)
      .order("like_count", { ascending: false })
      .limit(5),
    supabase
      .from("direct_messages")
      .select("id, sender_id, sender_name, created_at")
      .eq("receiver_id", userId)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("user_activity_regions")
      .select("name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("invite_events")
      .select("id, created_at")
      .eq("inviter_id", userId)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  const items: Milestone[] = [];

  // 1) 가입
  const joinDate = (profileRes.data as { created_at: string } | null)?.created_at;
  if (joinDate) {
    items.push({
      id: "join",
      date: joinDate,
      category: "join",
      emoji: "🌱",
      title: "도시공존에 오셨어요",
      desc: "고양이와 사람이 함께하는 도시. 그 첫 발걸음이 시작된 날.",
    });
  }

  // 2) 활동 지역 첫 등록
  const firstRegion = ((regionRes.data ?? []) as { name: string; created_at: string }[])[0];
  if (firstRegion) {
    items.push({
      id: "region_first",
      date: firstRegion.created_at,
      category: "region",
      emoji: "📍",
      title: "내 동네를 정했어요",
      desc: `${firstRegion.name}에서 활동을 시작했어요. 같은 동네 이웃을 만날 준비.`,
    });
  }

  // 3) 고양이 등록 마일스톤 (1, 3, 5, 10, 20, 50번째)
  const cats = (catsRes.data ?? []) as { id: string; name: string; created_at: string }[];
  const catThresholds = [1, 3, 5, 10, 20, 50];
  for (const n of catThresholds) {
    const c = cats[n - 1];
    if (!c) break;
    items.push({
      id: `cat_${n}`,
      date: c.created_at,
      category: "cat",
      emoji: n === 1 ? "🐾" : "🐈",
      title: n === 1 ? "첫 고양이를 만났어요" : `${n}번째 고양이를 등록했어요`,
      desc: n === 1
        ? `${c.name}이(가) 도시공존의 첫 친구가 됐어요.`
        : `${c.name}이(가) 합류. 누적 ${n}마리의 친구를 챙기고 있어요.`,
      catId: c.id,
    });
  }

  // 4) 돌봄 기록 마일스톤 (1, 10, 50, 100, 500번째)
  const cares = (careRes.data ?? []) as { id: string; cat_id: string; logged_at: string }[];
  const careThresholds = [1, 10, 50, 100, 500];
  for (const n of careThresholds) {
    const c = cares[n - 1];
    if (!c) break;
    items.push({
      id: `care_${n}`,
      date: c.logged_at,
      category: "care",
      emoji: n === 1 ? "🍚" : n >= 100 ? "💛" : "🤍",
      title: n === 1 ? "첫 돌봄 기록을 남겼어요" : `${ORDINAL(n)} 돌봄을 기록했어요`,
      desc: n === 1
        ? "한 번의 기록은 다음 사람에게 큰 단서가 돼요."
        : `꾸준한 손길이 쌓여 누적 ${n}회. 정말 대단해요.`,
      catId: c.cat_id,
    });
  }

  // 5) 댓글 마일스톤 (1, 10, 50번째)
  const comments = (commentRes.data ?? []) as { id: string; cat_id: string; created_at: string }[];
  const commentThresholds = [1, 10, 50];
  for (const n of commentThresholds) {
    const c = comments[n - 1];
    if (!c) break;
    items.push({
      id: `comment_${n}`,
      date: c.created_at,
      category: "comment",
      emoji: "💬",
      title: n === 1 ? "첫 댓글을 남겼어요" : `${ORDINAL(n)} 댓글로 응원했어요`,
      desc: n === 1
        ? "이웃의 기록에 답한 첫 따뜻한 한마디."
        : `누적 ${n}개의 응원이 동네에 흩어졌어요.`,
      catId: c.cat_id,
    });
  }

  // 6) 글 작성 마일스톤
  const posts = (postRes.data ?? []) as { id: string; title: string; created_at: string }[];
  if (posts[0]) {
    items.push({
      id: "post_first",
      date: posts[0].created_at,
      category: "post",
      emoji: "📝",
      title: "첫 커뮤니티 글을 썼어요",
      desc: `"${posts[0].title.slice(0, 20)}${posts[0].title.length > 20 ? "…" : ""}" — 동네 이야기가 시작됐어요.`,
    });
  }
  if (posts[9]) {
    items.push({
      id: "post_10",
      date: posts[9].created_at,
      category: "post",
      emoji: "📔",
      title: "10번째 글을 썼어요",
      desc: "꾸준한 기록자가 됐어요. 동네의 목소리가 됐어요.",
    });
  }

  // 7) 친구 초대 성공
  const invites = (inviteRes.data ?? []) as { id: string; created_at: string }[];
  if (invites[0]) {
    items.push({
      id: "invite_first",
      date: invites[0].created_at,
      category: "social",
      emoji: "🤝",
      title: "첫 이웃을 도시공존으로 초대했어요",
      desc: "당신의 따뜻함이 한 명을 더 데려왔어요.",
    });
  }
  if (invites[4]) {
    items.push({
      id: "invite_5",
      date: invites[4].created_at,
      category: "social",
      emoji: "🌟",
      title: "5명을 초대해 동네를 키웠어요",
      desc: "당신의 영향력이 점점 넓어지고 있어요.",
    });
  }

  // 8) 첫 쪽지 받음
  const firstDM = ((dmRes.data ?? []) as { id: string; sender_name: string | null; created_at: string }[])[0];
  if (firstDM) {
    items.push({
      id: "dm_first_received",
      date: firstDM.created_at,
      category: "received",
      emoji: "✉️",
      title: "첫 쪽지를 받았어요",
      desc: `${firstDM.sender_name ?? "이웃"}님이 당신을 찾아왔어요.`,
    });
  }

  // 9) 내 고양이가 좋아요 받음 (총 like_count 기준 마일스톤)
  const myCatsWithLikes = (likeOnMyCatsRes.data ?? []) as { id: string; name: string; like_count: number }[];
  const totalLikesOnMyCats = myCatsWithLikes.reduce((s, c) => s + (c.like_count ?? 0), 0);
  if (myCatsWithLikes[0] && joinDate) {
    // 좋아요는 시점 추적이 어려워 가입일 +1일로 placeholder
    items.push({
      id: "like_received",
      date: new Date(new Date(joinDate).getTime() + 86400000).toISOString(),
      category: "received",
      emoji: "💛",
      title: `내 친구들이 누적 ${totalLikesOnMyCats}개의 좋아요를 받았어요`,
      desc: `가장 사랑받는 친구는 ${myCatsWithLikes[0].name}이에요. 동네가 알아주는 스타.`,
      catId: myCatsWithLikes[0].id,
    });
  }

  // 10) 누적 streak 마일스톤 — care_logs 날짜로 계산
  if (cares.length > 0) {
    const dates = new Set<string>();
    for (const c of cares) {
      dates.add(new Date(c.logged_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
    }
    const sorted = Array.from(dates).sort();
    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    let longestEndDate = sorted[0];
    let curEndDate = sorted[0];
    for (const d of sorted) {
      if (prev === null) {
        run = 1;
      } else {
        const diff = Math.round(
          (new Date(d + "T00:00:00").getTime() - new Date(prev + "T00:00:00").getTime()) / 86400000,
        );
        run = diff === 1 ? run + 1 : 1;
      }
      curEndDate = d;
      if (run > longest) {
        longest = run;
        longestEndDate = curEndDate;
      }
      prev = d;
    }
    const streakThresholds = [7, 14, 30, 100];
    for (const n of streakThresholds) {
      if (longest >= n) {
        items.push({
          id: `streak_${n}`,
          date: new Date(longestEndDate + "T00:00:00").toISOString(),
          category: "streak",
          emoji: n >= 100 ? "🔥" : "✨",
          title: `${n}일 연속 돌봄 기록`,
          desc: n === 100
            ? "100일이라니 — 당신의 꾸준함이 동네의 안전망이 됐어요."
            : `${n}일 동안 매일 발걸음을 멈추지 않았어요.`,
        });
      }
    }
  }

  // 시간순 정렬 (옛날 → 최근)
  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return items;
}
