# [TRD] 도시공존: 기술 요구사항 정의서

**작성일:** 2026. 02. 08
**상태:** 최종 확정 (Ready for Coding)
**문서 버전:** v1.2
**연동 문서:** PRD v1.6, 학습로드맵_8주파운데이션.md
**개발 체제:** 1인 풀스택 + AI 어시스턴트
**변경 이력:** v1.0 아키텍처 + v1.1 보안 개선(정적 흐림 좌표, 보안 단일 창구, AI 가드레일)을 통합. CCTV는 PRD 기준 P2 유지. 스키마·API·일정 전면 재정비.
**부분 갱신(2026-04-10):** MVP 스택 표에 `shadcn/ui` UI Kit 항목을 공식 편입. 동일 날짜 세이지/클레이 팔레트 전면 리뉴얼 작업과 연계하여, 향후 컴포넌트 재작성 시 shadcn/ui 블록을 기반으로 한다. tRPC는 학습로드맵에만 포함하며 본 TRD에는 도입하지 않는다(기존 Drizzle + Route Handler 구조 유지).

---

## 1. 기술 스택 총괄

### 1.1 MVP 스택 (5월 런칭 대상)

| 계층 | 기술 | 선정 이유 |
|------|------|-----------|
| **Framework** | Next.js 15 (App Router) | SSR/SSG로 SEO 극대화. 서버 컴포넌트로 프론트·백엔드 통합. |
| **Language** | TypeScript 5.x | 도메인 엔티티 타입 안전성. 런타임 버그 사전 차단. |
| **Styling** | Tailwind CSS 3.x | 벤토 스타일 레이아웃 빠른 구현. |
| **UI Kit** | shadcn/ui | Radix UI + Tailwind 기반 설치형 컴포넌트. 복사-붙여넣기 방식이라 커스텀 팔레트(세이지/클레이) 적용이 자유로움. 신규 페이지 및 기존 페이지 재작성 시 블록 단위로 점진적 도입. |
| **BaaS/DB** | Supabase (PostgreSQL 15) | Auth·Realtime·Storage 통합. Free tier 초기 비용 0원. |
| **ORM** | Drizzle ORM | 타입 안전 쿼리. 경량. Supabase PostgreSQL 네이티브 호환. |
| **Validation** | Zod | API 입력 검증 + AI 응답 구조 검증 공통 사용. |
| **지도** | Kakao Maps SDK | 국내 주소 체계 최적화. 흐림 위치 원형 표시. |
| **배포** | Vercel | Next.js 네이티브. CI/CD 자동화. |
| **모니터링** | Sentry (Free) + GA4 | 에러 트래킹 + KPI 이벤트 분석. |

### 1.2 P1 이후 추가 스택

| 기술 | 시점 | 용도 |
|------|------|------|
| Gemini 1.5 Pro API | P1 (7월) | AI 수의사 상담. 긴 컨텍스트로 증상 분석. |
| Cloudflare Stream | P2 (11월~) | CCTV 중계. RTMPS 수신 → Signed URL 배포. |
| React Native | P2 (9월~) | 모바일 앱. Domain Layer 100% 재사용. |

> **원칙: MVP에 필요 없는 기술은 MVP TRD에서 설계만 언급하고 구현하지 않는다.**

### 1.3 개발 환경

| 항목 | 설정 |
|------|------|
| 패키지 매니저 | pnpm |
| 린터 | ESLint (strict) + Prettier |
| Git 전략 | main (프로덕션) / dev (개발) / feat/* (기능별) |
| CI/CD | Vercel 자동 배포 (main → 프로덕션, dev → 프리뷰) |
| 환경 변수 | `.env.local` (로컬), Vercel Environment Variables (프로덕션) |

---

## 2. 클린 아키텍처 설계

### 2.1 설계 원칙

PRD 13절 "실용적 클린 아키텍처 — 선택적 분리"를 따르되, v1.1에서 도입된 **보안 단일 창구 원칙**을 추가 적용한다.

**4대 원칙:**

1. **Domain Layer는 외부 기술에 의존하지 않는다.** Next.js, Supabase, React를 import하지 않는다.
2. **의존성 방향은 항상 안쪽(Domain)을 향한다.** Infrastructure → Application → Domain.
3. **보안의 단일 창구 (Security SSOT):** 모든 권한 검증은 Application Layer(유즈케이스)에서 통합 처리한다. DB의 RLS는 방어적 보조 수단(Defense in Depth)으로만 사용하고, 비즈니스 로직의 주 판단 근거로 삼지 않는다.
4. **단순 조회는 유즈케이스를 건너뛸 수 있다.** 서버 컴포넌트에서 Repository 직접 호출 허용 (1인 개발 속도 확보).

### 2.2 계층 구조

```
┌─────────────────────────────────────────────┐
│            Presentation Layer               │
│   Next.js App Router, React Components      │
│   페이지, 서버/클라이언트 컴포넌트, API Routes │
└──────────────────┬──────────────────────────┘
                   │ 호출
┌──────────────────▼──────────────────────────┐
│            Application Layer                │
│   Use Cases + Port 인터페이스 정의           │
│   ⭐ 보안의 단일 창구 (모든 권한 검증)        │
│   트랜잭션 조율, 입력 검증(Zod)              │
└──────────────────┬──────────────────────────┘
                   │ 의존성 역전 (DIP)
┌──────────────────▼──────────────────────────┐
│             Domain Layer (핵심)              │
│   Entities: User, Post, Cat, Region         │
│   Value Objects: Location, AuthLevel        │
│   Domain Services: LocationSecurity         │
│   ⛔ 외부 의존성 ZERO                        │
└─────────────────────────────────────────────┘
                   ▲ 구현 (implements Port)
┌──────────────────┴──────────────────────────┐
│          Infrastructure Layer               │
│   Supabase Client (Auth, DB, Storage)       │
│   Drizzle ORM (Repository 구현체)            │
│   Kakao Maps Adapter                        │
│   AI Guardrail Adapter (P1)                 │
│   Gemini AI Adapter (P1)                    │
│   Cloudflare Stream Adapter (P2)            │
└─────────────────────────────────────────────┘
```

### 2.3 보안 단일 창구 vs RLS 역할 분리

| 검증 항목 | Application Layer (주 판단) | Supabase RLS (보조 방어) |
|-----------|---------------------------|------------------------|
| 게시글 작성 권한 (Lv.2+) | `CreatePostUseCase`에서 authLevel 검증 | `auth.uid() IS NOT NULL` 기본 체크 |
| 정확한 좌표 열람 권한 | `ResolveLocationUseCase`에서 Lv 판정 후 분기 반환 | latitude/longitude 컬럼은 RLS로 직접 차단하지 않음 (API에서 제어) |
| 관리자 공지 고정 | `PinPostUseCase`에서 role='admin' 검증 | `role = 'admin'` 체크 |
| 블라인드 게시글 숨김 | API 응답에서 필터링 | `is_blinded = false` 기본 필터 |

> **이유:** RLS에 비즈니스 로직을 분산하면 (1) 디버깅이 어렵고, (2) 앱(React Native) 전환 시 동일 로직을 다시 구현해야 하며, (3) 1인 개발자가 SQL 정책과 TypeScript 로직 두 곳을 동시에 관리하는 부담이 생긴다. Application Layer에 집중하면 한 곳만 보면 된다.

### 2.4 유즈케이스 경유 기준

| 반드시 유즈케이스 경유 | 직접 Repository 호출 허용 |
|----------------------|-------------------------|
| 게시글 작성 (위치 보안 + 권한) | 게시판 목록 조회 |
| 긴급 제보 작성 (사진 필수 검증) | 도움센터 가이드 조회 (SSG) |
| 위치 상세 열람 (Lv 판정) | 유저 프로필 조회 |
| 신고 처리 (자동 블라인드) | 소모임 목록 조회 |
| 긴급 모드 발동 (관리자) | 댓글 목록 조회 |
| AI 수의사 상담 (가드레일 + 면책) | 카테고리 목록 |

---

## 3. 프로젝트 폴더 구조

```
src/
├── domain/                              # 🔒 외부 의존성 ZERO
│   ├── entities/
│   │   ├── user.entity.ts
│   │   ├── post.entity.ts
│   │   ├── cat.entity.ts               # (P1)
│   │   ├── region.entity.ts
│   │   ├── care-log.entity.ts          # (P1)
│   │   └── report.entity.ts
│   ├── value-objects/
│   │   ├── location.vo.ts              # 정적 흐림 좌표 로직 포함
│   │   ├── auth-level.vo.ts            # Lv.1 / Lv.2 / Lv.3
│   │   └── post-category.vo.ts         # 9개 카테고리 enum
│   ├── services/
│   │   └── location-security.service.ts # 좌표 흐림 + 열람 권한 판정
│   └── errors/
│       └── domain-errors.ts
│
├── application/                         # 유즈케이스 + 포트
│   ├── ports/
│   │   ├── post-repository.port.ts
│   │   ├── user-repository.port.ts
│   │   ├── region-repository.port.ts
│   │   ├── care-log-repository.port.ts  # (P1)
│   │   ├── storage.port.ts
│   │   ├── notification.port.ts
│   │   └── ai-assistant.port.ts         # (P1)
│   ├── use-cases/
│   │   ├── create-post.use-case.ts          # 일반 게시글 작성
│   │   ├── create-emergency-post.use-case.ts # 긴급 제보 (사진 필수 + 위치 흐림)
│   │   ├── resolve-location.use-case.ts      # 위치 열람 권한 판정
│   │   ├── report-post.use-case.ts           # 신고 + 자동 블라인드
│   │   ├── pin-post.use-case.ts              # 관리자 공지 고정
│   │   ├── lockdown-region.use-case.ts       # 긴급 모드
│   │   ├── create-care-log.use-case.ts       # (P1) 돌봄 일지
│   │   └── ai-vet-consult.use-case.ts        # (P1) AI 수의사
│   └── dto/
│       ├── create-post.dto.ts
│       └── ai-consult.dto.ts
│
├── infrastructure/                      # 외부 기술 구현
│   ├── database/
│   │   ├── drizzle.config.ts
│   │   ├── schema/                      # Drizzle 스키마 (5절 참조)
│   │   │   ├── users.schema.ts
│   │   │   ├── posts.schema.ts
│   │   │   ├── regions.schema.ts
│   │   │   ├── care-logs.schema.ts      # (P1)
│   │   │   ├── cats.schema.ts           # (P1)
│   │   │   └── reports.schema.ts
│   │   └── migrations/
│   ├── repositories/
│   │   ├── supabase-post.repository.ts
│   │   ├── supabase-user.repository.ts
│   │   └── supabase-region.repository.ts
│   ├── adapters/
│   │   ├── supabase-storage.adapter.ts
│   │   ├── supabase-realtime.adapter.ts
│   │   ├── ai-guardrail.adapter.ts      # (P1) Zod + Regex 안전 필터
│   │   └── gemini-ai.adapter.ts         # (P1) Gemini API 호출
│   ├── supabase/
│   │   ├── client.ts                    # 브라우저용
│   │   ├── server.ts                    # 서버 컴포넌트용
│   │   └── middleware.ts                # Auth 미들웨어
│   └── di/
│       └── container.ts                 # 수동 DI 컨테이너
│
├── app/                                 # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                         # 홈 (벤토 대시보드)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── verify-phone/page.tsx        # Lv.2 인증
│   ├── guide/                           # FR-01 도움센터 (SSG)
│   │   ├── page.tsx
│   │   ├── [slug]/page.tsx
│   │   └── _content/                    # MDX 가이드
│   ├── community/                       # FR-02 커뮤니티
│   │   ├── page.tsx                     # 카테고리 선택
│   │   ├── [category]/
│   │   │   ├── page.tsx                 # 목록
│   │   │   └── [postId]/page.tsx        # 상세
│   │   ├── write/page.tsx               # 글쓰기 (Lv.2+)
│   │   └── region/                      # 지역 소모임
│   │       ├── page.tsx
│   │       └── [regionId]/page.tsx
│   ├── care-log/                        # FR-04 (P1, 6월)
│   │   ├── page.tsx
│   │   └── write/page.tsx
│   ├── vet-ai/                          # FR-05 (P1, 7월)
│   │   └── page.tsx
│   ├── admin/                           # 관리자
│   │   ├── posts/page.tsx
│   │   └── lockdown/page.tsx
│   └── api/                             # API Route Handlers
│       ├── posts/
│       │   ├── route.ts                 # GET(목록), POST(작성)
│       │   └── [postId]/
│       │       ├── route.ts             # GET, PATCH, DELETE
│       │       ├── report/route.ts      # POST(신고)
│       │       └── pin/route.ts         # PATCH(공지 고정)
│       ├── comments/
│       │   └── route.ts
│       ├── regions/
│       │   ├── route.ts                 # GET(목록)
│       │   └── [regionId]/
│       │       ├── feed/route.ts        # GET(소모임 피드)
│       │       └── join/route.ts        # POST(가입)
│       ├── auth/
│       │   └── verify-phone/route.ts    # POST(Lv.2 승격)
│       ├── care-logs/route.ts           # (P1)
│       ├── vet-ai/
│       │   ├── consult/route.ts         # (P1)
│       │   └── feedback/route.ts        # (P1)
│       └── admin/
│           └── lockdown/route.ts
│
├── shared/                              # 공유 유틸리티
│   ├── ui/                              # 공통 UI
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── BentoGrid.tsx
│   │   ├── MapView.tsx                  # 카카오맵 래퍼
│   │   └── BlurredLocationCircle.tsx    # 흐림 위치 원형 표시
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useRealtime.ts              # Supabase Realtime 구독
│   │   └── useLocation.ts
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── utils.ts
│   │   └── seed-random.ts              # 시드 기반 고정 난수 (정적 흐림 좌표용)
│   └── types/
│       └── index.ts
│
└── middleware.ts                         # Next.js 미들웨어
```

---

## 4. 도메인 엔티티 상세 설계

### 4.1 핵심 Value Objects

```typescript
// ── domain/value-objects/auth-level.vo.ts ──
export class AuthLevel {
  static readonly GUEST = new AuthLevel(1, 'guest');
  static readonly VERIFIED = new AuthLevel(2, 'verified');
  static readonly SHELTER_MANAGER = new AuthLevel(3, 'shelter_manager');

  private constructor(
    public readonly value: number,
    public readonly label: string,
  ) {}

  static fromValue(value: number): AuthLevel {
    const map: Record<number, AuthLevel> = {
      1: AuthLevel.GUEST,
      2: AuthLevel.VERIFIED,
      3: AuthLevel.SHELTER_MANAGER,
    };
    const level = map[value];
    if (!level) throw new InvalidAuthLevelError(value);
    return level;
  }

  isAtLeast(required: AuthLevel): boolean {
    return this.value >= required.value;
  }
}

// ── domain/value-objects/location.vo.ts ──
export class Location {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
  ) {
    if (latitude < -90 || latitude > 90) throw new InvalidLocationError('latitude');
    if (longitude < -180 || longitude > 180) throw new InvalidLocationError('longitude');
  }

  /**
   * 정적 흐림 좌표 생성 (Static Blurred Location)
   *
   * v1.1에서 도입된 삼각 측량 방지 설계:
   * - 매 요청마다 랜덤 좌표를 생성하면, 공격자가 여러 번 조회하여
   *   랜덤 원의 중심(실제 좌표)을 역산할 수 있음.
   * - 대신 게시글 작성 시점에 postId를 시드로 사용하여
   *   고정된 흐림 좌표를 단 한 번만 생성하고 DB에 저장.
   *
   * L_blurred = f(L_real, Seed_postId)
   */
  toStaticBlurred(seed: string, radiusMeters: number = 100): Location {
    const hash = this.seedToHash(seed);
    const angle = (hash % 360) * (Math.PI / 180);
    const distance = ((hash >> 8) % 100) / 100 * radiusMeters;

    const earthRadius = 6371000;
    const dLat = (distance * Math.cos(angle)) / earthRadius * (180 / Math.PI);
    const dLng = (distance * Math.sin(angle)) /
      (earthRadius * Math.cos(this.latitude * Math.PI / 180)) * (180 / Math.PI);

    return new Location(
      this.latitude + dLat,
      this.longitude + dLng,
    );
  }

  /** 시드 문자열 → 결정적 해시값 (외부 라이브러리 없이 구현) */
  private seedToHash(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수 변환
    }
    return Math.abs(hash);
  }
}

// ── domain/value-objects/post-category.vo.ts ──
export enum PostCategory {
  EMERGENCY = 'emergency',
  TNR = 'tnr',
  FEEDING_STATION = 'feeding',
  FOSTER_ADOPT = 'foster',
  VET_REVIEW = 'vet_review',
  LEGAL_QA = 'legal',
  FREE_BOARD = 'free',
  SUCCESS_STORY = 'success',
  REGIONAL_GROUP = 'regional',
}
```

### 4.2 핵심 엔티티

```typescript
// ── domain/entities/user.entity.ts ──
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly nickname: string,
    public readonly authLevel: AuthLevel,
    public readonly role: 'user' | 'admin',
    public readonly phoneVerified: boolean,
    public readonly primaryRegionId: string | null,
    public readonly isSuspended: boolean,
    public readonly createdAt: Date,
  ) {}

  canWritePost(): boolean {
    if (this.isSuspended) return false;
    return this.authLevel.isAtLeast(AuthLevel.VERIFIED);
  }

  canViewExactLocation(): boolean {
    return this.authLevel.isAtLeast(AuthLevel.VERIFIED);
  }

  canPinPost(): boolean {
    return this.role === 'admin';
  }

  canLockdownRegion(): boolean {
    return this.role === 'admin';
  }

  /** 미인증 유저를 나타내는 팩토리 */
  static anonymous(): User {
    return new User('anon', '', '', AuthLevel.GUEST, 'user', false, null, false, new Date());
  }
}

// ── domain/entities/post.entity.ts ──
export class Post {
  constructor(
    public readonly id: string,
    public readonly authorId: string,
    public readonly category: PostCategory,
    public readonly title: string,
    public readonly content: string,
    public readonly location: Location | null,
    public readonly blurredLocation: Location | null,  // 정적 흐림 좌표 (DB 저장)
    public readonly imageUrls: string[],
    public readonly regionId: string | null,
    public readonly isPinned: boolean,
    public readonly isBlinded: boolean,
    public readonly isHidden: boolean,
    public readonly reportCount: number,
    public readonly createdAt: Date,
  ) {}

  static validateEmergency(imageUrls: string[]): void {
    if (imageUrls.length === 0) {
      throw new EmergencyPostRequiresImageError();
    }
  }

  shouldAutoBlind(): boolean {
    return this.reportCount >= 3;
  }
}

// ── domain/entities/region.entity.ts ──
export class Region {
  constructor(
    public readonly id: string,
    public readonly name: string,          // "마포구 상암동"
    public readonly district: string,      // "마포구"
    public readonly neighborhood: string,  // "상암동"
    public readonly isLockedDown: boolean,
    public readonly memberCount: number,
  ) {}
}
```

### 4.3 도메인 서비스: 위치 보안

```typescript
// ── domain/services/location-security.service.ts ──
export class LocationSecurityService {

  /**
   * 게시글 작성 시: 정적 흐림 좌표를 생성하여 반환.
   * 이 값을 DB에 저장하고, 이후 조회 시에는 재계산하지 않음.
   */
  generateBlurredLocation(realLocation: Location, postId: string): Location {
    return realLocation.toStaticBlurred(postId, 100);
  }

  /**
   * 게시글 조회 시: 유저 레벨에 따라 좌표 분기.
   * - Lv.1: DB에 저장된 blurredLocation 반환
   * - Lv.2+: 실제 location 반환
   */
  resolveForViewer(
    realLocation: Location | null,
    blurredLocation: Location | null,
    viewer: User,
  ): { location: Location | null; isExact: boolean } {
    if (!realLocation || !blurredLocation) {
      return { location: null, isExact: false };
    }
    if (viewer.canViewExactLocation()) {
      return { location: realLocation, isExact: true };
    }
    return { location: blurredLocation, isExact: false };
  }
}
```

---

## 5. 데이터베이스 스키마

### 5.1 전체 ERD

```
users ──┬── posts ──┬── post_comments
        │           └── post_reports
        ├── user_regions (N:M)
        ├── care_logs ── cats (P1)
        └── ai_consult_logs (P1)

regions ──── posts (1:N)
         └── user_regions (N:M)
```

### 5.2 Drizzle 스키마

```typescript
// ═══ users.schema.ts ═══
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  nickname: text('nickname').notNull(),
  avatarUrl: text('avatar_url'),
  authLevel: integer('auth_level').notNull().default(1),
  phone: text('phone'),
  phoneVerified: boolean('phone_verified').notNull().default(false),
  role: text('role').notNull().default('user'),  // 'user' | 'admin'
  primaryRegionId: uuid('primary_region_id').references(() => regions.id),
  isSuspended: boolean('is_suspended').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ═══ regions.schema.ts ═══
export const regions = pgTable('regions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  district: text('district').notNull(),
  neighborhood: text('neighborhood').notNull(),
  isLockedDown: boolean('is_locked_down').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userRegions = pgTable('user_regions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  regionId: uuid('region_id').notNull().references(() => regions.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

// ═══ posts.schema.ts ═══
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  regionId: uuid('region_id').references(() => regions.id),
  title: text('title').notNull(),
  content: text('content').notNull(),

  // 실제 좌표 (Lv.2+ 전용, API 레벨에서 접근 제어)
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),

  // 정적 흐림 좌표 (Lv.1 공개, 작성 시 1회 생성 후 고정)
  // → 삼각 측량 공격 방지: 조회할 때마다 동일한 값 반환
  blurredLat: doublePrecision('blurred_lat'),
  blurredLng: doublePrecision('blurred_lng'),

  imageUrls: text('image_urls').array(),
  isPinned: boolean('is_pinned').notNull().default(false),
  isBlinded: boolean('is_blinded').notNull().default(false),
  isHidden: boolean('is_hidden').notNull().default(false),  // 긴급 모드
  reportCount: integer('report_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const postComments = pgTable('post_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isBlinded: boolean('is_blinded').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const postReports = pgTable('post_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  reporterId: uuid('reporter_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),  // 'abuse' | 'spam' | 'false_info' | 'hate' | 'other'
  detail: text('detail'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ═══ care-logs.schema.ts (P1) ═══
export const cats = pgTable('cats', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  description: text('description'),
  regionId: uuid('region_id').references(() => regions.id),
  registeredBy: uuid('registered_by').notNull().references(() => users.id),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const careLogs = pgTable('care_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  regionId: uuid('region_id').references(() => regions.id),
  catId: uuid('cat_id').references(() => cats.id),
  imageUrl: text('image_url'),
  memo: text('memo'),
  aiSuggestedKeywords: text('ai_suggested_keywords').array(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ═══ ai-consult-logs.schema.ts (P1) ═══
export const aiConsultLogs = pgTable('ai_consult_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  query: text('query').notNull(),
  response: text('response').notNull(),
  responseSource: text('response_source').notNull(), // 'template' | 'ai_generated'
  wasGuardrailTriggered: boolean('was_guardrail_triggered').notNull().default(false),
  userRating: integer('user_rating'),
  flaggedAsDangerous: boolean('flagged_as_dangerous').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 5.3 RLS 정책 (보조 방어용)

```sql
-- 기본 방어: 블라인드·비공개 게시글은 DB 레벨에서도 차단
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 게시글 조회" ON posts FOR SELECT
  USING (is_blinded = false AND is_hidden = false);

CREATE POLICY "본인 게시글 수정" ON posts FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "인증 유저 게시글 작성" ON posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "관리자 전체 접근" ON posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- 주의: 위치 좌표(latitude, longitude)는 RLS로 컬럼 단위 차단이 불가.
-- Application Layer에서 authLevel 기반으로 반환값을 분기 처리한다.
```

### 5.4 Supabase Storage 버킷

| 버킷 | 접근 | 용도 |
|------|------|------|
| `post-images` | Lv.2+ 업로드, 전체 읽기 | 게시글 이미지 |
| `care-log-images` | Lv.2+ 업로드, 전체 읽기 | 돌봄 일지 (P1) |
| `avatars` | 본인 업로드, 전체 읽기 | 프로필 사진 |

---

## 6. API 설계

### 6.1 엔드포인트 목록

| Method | Endpoint | 인증 | 유즈케이스 경유 | PRD |
|--------|----------|------|----------------|-----|
| **게시글** | | | | |
| GET | `/api/posts` | 선택 | ❌ 직접 조회 | FR-02 |
| GET | `/api/posts/[postId]` | 선택 | ✅ ResolveLocation | FR-02,03 |
| POST | `/api/posts` | Lv.2+ | ✅ CreatePost / CreateEmergencyPost | FR-02 |
| PATCH | `/api/posts/[postId]` | 작성자 | ✅ 권한 검증 | FR-02 |
| DELETE | `/api/posts/[postId]` | 작성자/관리자 | ✅ 권한 검증 | FR-02 |
| POST | `/api/posts/[postId]/report` | Lv.2+ | ✅ ReportPost | FR-02 |
| PATCH | `/api/posts/[postId]/pin` | 관리자 | ✅ PinPost | FR-02 |
| **댓글** | | | | |
| GET | `/api/posts/[postId]/comments` | 선택 | ❌ | FR-02 |
| POST | `/api/posts/[postId]/comments` | Lv.2+ | ✅ 권한 검증 | FR-02 |
| DELETE | `/api/comments/[id]` | 작성자/관리자 | ✅ | FR-02 |
| **소모임** | | | | |
| GET | `/api/regions` | 선택 | ❌ | FR-02 |
| GET | `/api/regions/[id]/feed` | 선택 | ❌ | FR-02 |
| POST | `/api/regions/[id]/join` | Lv.2+ | ✅ | FR-02 |
| **인증** | | | | |
| POST | `/api/auth/verify-phone` | Lv.1+ | ✅ | FR-03 |
| **돌봄 일지 (P1)** | | | | |
| GET | `/api/care-logs` | Lv.2+ | ❌ | FR-04 |
| POST | `/api/care-logs` | Lv.2+ | ✅ CreateCareLog | FR-04 |
| **AI 수의사 (P1)** | | | | |
| POST | `/api/vet-ai/consult` | Lv.1+ | ✅ AiVetConsult | FR-05 |
| POST | `/api/vet-ai/feedback` | Lv.1+ | ✅ | FR-05 |
| **관리자** | | | | |
| POST | `/api/admin/lockdown` | 관리자 | ✅ LockdownRegion | 긴급모드 |
| GET | `/api/admin/reports` | 관리자 | ❌ | 모더레이션 |

### 6.2 응답 규격

```typescript
// 성공
{ "success": true, "data": { ... }, "meta": { "page": 1, "pageSize": 20, "totalCount": 156 } }

// 에러
{ "success": false, "error": { "code": "UNAUTHORIZED_LOCATION_ACCESS", "message": "..." } }
```

### 6.3 게시글 상세 API — 위치 보안 핵심 로직

```typescript
// app/api/posts/[postId]/route.ts
export async function GET(req: Request, { params }: { params: { postId: string } }) {
  const { postRepo } = getContainer();
  const user = await getCurrentUser(req); // null이면 미인증

  const post = await postRepo.findById(params.postId);
  if (!post || post.isBlinded || post.isHidden) return notFound();

  // ⭐ 보안 단일 창구: Application Layer에서 위치 판정
  const locationService = new LocationSecurityService();
  const { location, isExact } = locationService.resolveForViewer(
    post.location,
    post.blurredLocation,
    user ?? User.anonymous(),
  );

  return Response.json({
    success: true,
    data: {
      ...PostPresenter.toResponse(post),
      location: location
        ? { latitude: location.latitude, longitude: location.longitude, isExact }
        : null,
    },
  });
}
```

### 6.4 긴급 제보 작성 API — 정적 흐림 좌표 생성

```typescript
// application/use-cases/create-emergency-post.use-case.ts
export class CreateEmergencyPostUseCase {
  constructor(
    private postRepo: PostRepositoryPort,
    private storage: StoragePort,
    private locationService: LocationSecurityService,
    private notification: NotificationPort,
  ) {}

  async execute(dto: CreatePostDto, actor: User): Promise<Post> {
    // 1. 권한 검증 (보안 단일 창구)
    if (!actor.canWritePost()) throw new InsufficientAuthLevelError();

    // 2. 긴급 제보 사진 필수
    Post.validateEmergency(dto.imageUrls);

    // 3. 게시글 ID 사전 생성 (흐림 좌표 시드로 사용)
    const postId = crypto.randomUUID();

    // 4. ⭐ 정적 흐림 좌표 생성 (1회만, DB에 저장)
    let blurredLocation: Location | null = null;
    if (dto.location) {
      blurredLocation = this.locationService.generateBlurredLocation(
        dto.location,
        postId,  // 시드 = postId → 동일 게시글은 항상 같은 흐림 좌표
      );
    }

    // 5. 저장
    const post = await this.postRepo.save({
      id: postId,
      authorId: actor.id,
      category: PostCategory.EMERGENCY,
      title: dto.title,
      content: dto.content,
      location: dto.location,
      blurredLocation,
      imageUrls: dto.imageUrls,
      regionId: dto.regionId,
    });

    // 6. 같은 지역 소모임 Realtime 알림
    if (dto.regionId) {
      await this.notification.sendToRegion(dto.regionId, {
        type: 'emergency',
        postId: post.id,
        title: post.title,
      });
    }

    return post;
  }
}
```

---

## 7. AI 수의사 기술 설계 (P1, 7월)

### 7.1 3단계 안전 가드레일

v1.1의 AI 가드레일 개념을 확장하여 3단계로 설계한다.

```
[유저 질문]
    │
    ▼
━━ 1단계: 사전 매칭 ━━━━━━━━━━━━━━━━━━
    키워드 기반으로 수의사 검수 템플릿에 매칭?
    ├─ YES → 검증된 템플릿 즉시 반환
    └─ NO ↓
    │
    ▼
━━ 2단계: Gemini API 호출 ━━━━━━━━━━━━━
    시스템 프롬프트로 응답 범위 제한
    │
    ▼
━━ 3단계: 출력 가드레일 (AIGuardrailAdapter) ━━
    Zod 스키마 검증 + Regex 차단 필터
    ├─ 통과 → AI 응답 반환
    └─ 차단 → 안전한 기본 가이드로 교체
    │
    ▼
[면책 고지 + 24시 병원 버튼 강제 삽입]
```

### 7.2 출력 가드레일 (AIGuardrailAdapter)

```typescript
// infrastructure/adapters/ai-guardrail.adapter.ts
import { z } from 'zod';

/** 차단 패턴: 약물·용량·확정 진단·안심 답변 */
const BLOCKED_PATTERNS = [
  /처방|투약/,
  /(\d+)\s*(mg|ml|cc|정|알)/i,
  /[가-힣]+(염|증|균)\s*(입니다|입니다\.|이에요|예요)/,  // "~염입니다" 류 확정 진단
  /괜찮|문제없|안심|걱정.{0,2}마/,                       // 안심 답변
];

/** AI 응답 구조 검증 */
const AiResponseSchema = z.object({
  summary: z.string().max(500),
  emergencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
  actionSteps: z.array(z.string()).min(1).max(5),
  shouldVisitVet: z.boolean(),
});

export class AIGuardrailAdapter {
  validate(rawResponse: string): { safe: boolean; parsed: z.infer<typeof AiResponseSchema> | null } {
    // 1. 차단 패턴 검사
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(rawResponse)) {
        return { safe: false, parsed: null };
      }
    }

    // 2. 구조 검증 (Zod)
    try {
      const parsed = AiResponseSchema.parse(JSON.parse(rawResponse));
      return { safe: true, parsed };
    } catch {
      return { safe: false, parsed: null };
    }
  }
}
```

### 7.3 Gemini 시스템 프롬프트

```typescript
const VET_AI_SYSTEM_PROMPT = `
당신은 길고양이 응급 행동 가이드 보조입니다.

[절대 금지]
- 특정 질병명을 확정 진단하지 마세요.
- 약물명, 투약량을 언급하지 마세요.
- "괜찮다", "문제없다"는 안심 답변을 하지 마세요.

[반드시 수행]
- 응급 처치 행동(지혈, 보온, 안전한 이동법)만 안내하세요.
- 항상 "가까운 동물병원 방문"을 권고하세요.
- 응답은 반드시 다음 JSON 형식으로만 출력하세요:
{
  "summary": "상황 요약 (500자 이내)",
  "emergencyLevel": "low | medium | high | critical",
  "actionSteps": ["조치 1", "조치 2", ...],
  "shouldVisitVet": true
}
`;
```

### 7.4 강제 면책 고지

모든 AI 응답의 앞/뒤에 프론트엔드에서 강제 삽입:

```typescript
const DISCLAIMER_TOP = '⚠️ 아래 정보는 의료적 진단이 아닙니다.';
const DISCLAIMER_BOTTOM = '⚠️ 이 정보는 법적 책임을 지지 않습니다. 반드시 가까운 동물병원을 방문하세요.';
// + [24시 동물병원 찾기] 버튼 항상 노출
```

---

## 8. 실시간 알림 설계

### 8.1 Supabase Realtime 채널

```typescript
// shared/hooks/useEmergencyAlerts.ts
export function useEmergencyAlerts(regionId: string | null) {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);

  useEffect(() => {
    if (!regionId) return;
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`emergency:${regionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        filter: `category=eq.emergency&region_id=eq.${regionId}`,
      }, (payload) => {
        setAlerts(prev => [payload.new as EmergencyAlert, ...prev]);
        // 브라우저 푸시 알림
        if (Notification.permission === 'granted') {
          new Notification('🚨 긴급 제보', { body: payload.new.title });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [regionId]);

  return alerts;
}
```

### 8.2 알림 이벤트 매핑

| 이벤트 | 대상 | 채널 | Fallback |
|--------|------|------|----------|
| 긴급 제보 작성 | 같은 지역 Lv.2+ | `emergency:{regionId}` | 30초 폴링 |
| 내 글에 댓글 | 작성자 | `comments:{userId}` | 30초 폴링 |
| 긴급 모드 발동 | 해당 지역 전체 | `lockdown:{regionId}` | 30초 폴링 |
| 내 글 블라인드 | 작성자 | `moderation:{userId}` | - |

> **Fallback:** Supabase Realtime 불안정 시 30초 폴링으로 자동 전환. 기능은 유지하되 실시간성만 포기.

---

## 9. 도움센터 SSG 설계 (FR-01)

### 9.1 MDX 콘텐츠 구조

```
src/app/guide/_content/
├── cat-rescue.mdx           # 냥줍 가이드
├── emergency-first-aid.mdx  # 응급처치
├── trap-guide.mdx           # 포획 가이드
├── legal-protection.mdx     # 법률/보호법
├── feeding-station.mdx      # 급식소 관리
└── tnr-process.mdx          # TNR 절차
```

### 9.2 SEO 메타데이터

```typescript
// app/guide/[slug]/page.tsx
export async function generateStaticParams() {
  return getAllGuides().map(g => ({ slug: g.slug }));
}

export async function generateMetadata({ params }): Promise<Metadata> {
  const guide = getGuideBySlug(params.slug);
  return {
    title: `${guide.title} | 도시공존`,
    description: guide.excerpt,
    openGraph: { title: guide.title, description: guide.excerpt, type: 'article' },
  };
}
```

**타겟 키워드:** '냥줍 방법', '길고양이 구조', '고양이 응급처치', '포획틀 사용법', '길고양이 급식소 법', 'TNR 방법'.

---

## 10. 인증 플로우

```
[소셜 로그인 (Kakao / Google)]
    │
    ▼
Supabase Auth → JWT → users 테이블 생성 (auth_level = 1)
    │
    ▼
[Lv.1 게스트] ── 가이드, 게시판 읽기, AI 상담(면책 동의 후)
    │
    │ POST /api/auth/verify-phone
    ▼
[Lv.2 인증 대원] ── 글쓰기, 상세 위치, 돌봄 일지, 소모임
    │
    │ (Phase 3: 쉘터 렌탈 + 활동 이력 검증)
    ▼
[Lv.3 쉘터 관리자] ── CCTV, 센서 (P2)
```

### Next.js 미들웨어

```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(/* ... */);
  const { data: { session } } = await supabase.auth.getSession();

  const protectedPaths = ['/community/write', '/care-log/write', '/admin'];
  const isProtected = protectedPaths.some(p => req.nextUrl.pathname.startsWith(p));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (req.nextUrl.pathname.startsWith('/admin')) {
    const { data: user } = await supabase
      .from('users').select('role').eq('id', session!.user.id).single();
    if (user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/community/write/:path*', '/care-log/:path*', '/admin/:path*'],
};
```

---

## 11. 에러 처리 체계

### 11.1 도메인 에러

```typescript
// domain/errors/domain-errors.ts
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
  ) { super(message); }
}

export class InsufficientAuthLevelError extends DomainError {
  constructor() { super('INSUFFICIENT_AUTH', '권한이 부족합니다. 휴대폰 인증을 완료해주세요.', 403); }
}
export class EmergencyPostRequiresImageError extends DomainError {
  constructor() { super('EMERGENCY_REQUIRES_IMAGE', '긴급 제보에는 사진이 최소 1장 필요합니다.', 400); }
}
export class PostAutoBlindedError extends DomainError {
  constructor() { super('POST_AUTO_BLINDED', '신고 누적으로 블라인드 처리되었습니다.', 403); }
}
export class RegionLockedDownError extends DomainError {
  constructor(name: string) { super('REGION_LOCKED', `${name} 지역이 긴급 모드입니다.`, 403); }
}
export class SuspendedUserError extends DomainError {
  constructor() { super('USER_SUSPENDED', '계정이 정지되었습니다.', 403); }
}
export class InvalidAuthLevelError extends DomainError {
  constructor(value: number) { super('INVALID_AUTH_LEVEL', `잘못된 인증 레벨: ${value}`, 400); }
}
export class InvalidLocationError extends DomainError {
  constructor(field: string) { super('INVALID_LOCATION', `잘못된 좌표: ${field}`, 400); }
}
```

### 11.2 API 에러 핸들러

```typescript
// shared/lib/api-error-handler.ts
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof DomainError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.httpStatus },
    );
  }
  Sentry.captureException(error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
    { status: 500 },
  );
}
```

---

## 12. DI 컨테이너 (수동 팩토리)

```typescript
// infrastructure/di/container.ts
let _container: Container | null = null;

export function getContainer(): Container {
  if (!_container) {
    const db = getServerDb();

    const postRepo = new SupabasePostRepository(db);
    const userRepo = new SupabaseUserRepository(db);
    const regionRepo = new SupabaseRegionRepository(db);
    const storage = new SupabaseStorageAdapter();
    const notification = new SupabaseRealtimeAdapter();
    const locationService = new LocationSecurityService();

    _container = {
      // Repositories (단순 조회 직접 접근 허용)
      postRepo, userRepo, regionRepo,

      // Domain Services
      locationService,

      // Use Cases (보안 단일 창구)
      createPost: new CreatePostUseCase(postRepo, storage, locationService),
      createEmergencyPost: new CreateEmergencyPostUseCase(postRepo, storage, locationService, notification),
      resolveLocation: new ResolveLocationUseCase(locationService),
      reportPost: new ReportPostUseCase(postRepo),
      pinPost: new PinPostUseCase(postRepo),
      lockdownRegion: new LockdownRegionUseCase(regionRepo, notification),
    };
  }
  return _container;
}
```

---

## 13. 렌더링 및 성능 전략

### 13.1 페이지별 렌더링

| 페이지 | 방식 | 이유 |
|--------|------|------|
| 도움센터 가이드 | **SSG** | 변경 빈도 낮음, SEO 최우선 |
| 홈 대시보드 | **ISR** (60초) | 최신 게시글 + 빠른 초기 로드 |
| 게시글 목록 | **SSR** (서버 컴포넌트) | 실시간 데이터, 페이지네이션 |
| 게시글 상세 | **SSR** + 클라이언트 보강 | 위치 보안 서버 처리 필수 |
| 글쓰기 / AI 상담 | **CSR** | 인터랙티브 폼, 실시간 채팅 |

### 13.2 이미지 최적화

- 업로드 시 클라이언트에서 5MB 이하로 리사이즈 후 Supabase Storage 전송.
- 표시 시 Next.js `<Image>` 컴포넌트 자동 최적화 + WebP 변환.

### 13.3 캐싱

| 대상 | 방식 | TTL |
|------|------|-----|
| 도움센터 | SSG 빌드 캐시 | 배포 시 갱신 |
| 게시글 목록 | ISR | 30초 |
| 소모임 목록 | ISR | 60초 |
| 유저 프로필 | React Cache | 요청 단위 |

---

## 14. 모니터링 및 KPI 트래킹

### 14.1 GA4 이벤트

| 이벤트 | 트리거 | 연동 KPI |
|--------|--------|----------|
| `page_view_guide` | 도움센터 조회 | 구조 전환율 (분모) |
| `create_emergency_post` | 긴급 제보 작성 | 구조 전환율 (분자) |
| `join_regional_group` | 소모임 가입 | 소모임 활성도 |
| `create_care_log` | 돌봄 일지 작성 (P1) | 일지 작성률 |
| `ai_consult_start` | AI 상담 시작 (P1) | AI 이용률 |
| `ai_flag_danger` | "위험 정보" 신고 (P1) | 오류율 |
| `shelter_preorder` | 사전예약 클릭 | 펀딩 사전 신청 |

### 14.2 Sentry

- 에러율 1% 미만 유지.
- P0 에러 (인증, 데이터 유실): 즉시 알림.
- P1 에러 (UI, 느린 응답): 주간 리뷰.

---

## 15. 개발 단계별 구현 계획

PRD 11절 로드맵과 1:1 연동.

### 15.1 1단계: 뼈대 (2월)

| 태스크 | 상세 |
|--------|------|
| 프로젝트 초기화 | Next.js 15 + TS + Tailwind + pnpm |
| 클린 아키텍처 폴더 구조 | 3절 구조 그대로 생성 |
| Supabase 프로젝트 + Drizzle 스키마 | 5절 전체 (P1 테이블은 빈 마이그레이션만) |
| Supabase Auth (Kakao/Google) | 소셜 로그인 + users 자동 생성 |
| Domain 엔티티 + VO | User, Post, Region, Location, AuthLevel |
| LocationSecurityService | 정적 흐림 좌표 생성 + 열람 판정 |
| DI 컨테이너 | 12절 수동 팩토리 |
| 공통 UI (Button, Card, BentoGrid) | 디자인 시스템 기초 |
| Vercel 배포 설정 | main → prod, dev → preview |

### 15.2 2단계: 도움센터 (3월) — FR-01

| 태스크 | 상세 |
|--------|------|
| MDX 가이드 6개 작성 | 냥줍, 응급, 포획, 법률, 급식소, TNR |
| SSG 페이지 + SEO 메타 | generateStaticParams + generateMetadata |
| 벤토 스타일 홈페이지 | 가이드 카드 + 최신 게시글 프리뷰 |

### 15.3 3단계: 커뮤니티 + 보안 위치 (4월) — FR-02, FR-03

| 태스크 | 상세 |
|--------|------|
| 게시글 CRUD API + 페이지 | 유즈케이스 경유 (작성), 직접 조회 (목록) |
| 9개 카테고리 필터링 | PostCategory enum 기반 |
| 지역 소모임 | 자동 매칭 + 지역 피드 |
| 관리자 공지 고정 | PinPostUseCase |
| 위치 보안 (정적 흐림) | CreateEmergencyPost에서 1회 생성 → DB 저장 |
| Kakao Maps 연동 | BlurredLocationCircle (100m 원형) |
| 신고 + 자동 블라인드 | ReportPostUseCase (3회 누적) |
| Realtime 긴급 알림 | Supabase channel 구독 |
| 댓글 | CRUD + Lv.2 제한 |
| 이미지 업로드 | Supabase Storage |

### 15.4 4단계: QA + 런칭 (5월) — MVP

| 태스크 | 상세 |
|--------|------|
| 크로스 브라우저 테스트 | Chrome, Safari, 모바일 |
| Lighthouse SEO 점검 | 90+ 목표 |
| GA4 이벤트 설정 | 14.1절 전체 |
| Sentry 설정 | 에러 트래킹 |
| **MVP 런칭** | FR-01 + FR-02 + FR-03 |

### 15.5 5단계: 돌봄 일지 (6월) — FR-04

| 태스크 | 상세 |
|--------|------|
| 일지 CRUD | 사진 + 메모. AI 보조는 Gemini 연동 후 추가. |
| 고양이 등록 + 시계열 | cats 테이블 + 타임라인 UI |
| 소모임 피드 연동 | 같은 지역 일지 노출 |

### 15.6 6단계: AI 수의사 (7월) — FR-05

| 태스크 | 상세 |
|--------|------|
| Gemini API 연동 | 시스템 프롬프트 (7.3절) |
| 사전 템플릿 DB | 수의사 자문 기반 검증 응답 |
| AIGuardrailAdapter | Zod + Regex 3단계 필터 (7.2절) |
| 채팅 UI + 면책 고지 | 강제 삽입 + 24시 병원 버튼 |
| 피드백 시스템 | 유용성 / 위험 신고 트래킹 |
| 돌봄 일지 AI 보조 | 사진 키워드 제안 (Gemini Vision) |

### 15.7 이후 단계 (8월~)

| 시점 | 내용 | 추가 기술 |
|------|------|-----------|
| 8월 | 쉘터 크라우드펀딩 + 사전예약(FR-07) + B2G 제안 | 랜딩 페이지 |
| 9~10월 | React Native 앱 착수 | RN + Domain Layer 재사용 |
| 11월~ | CCTV(FR-08) + 쉘터 모니터링(FR-09) + SOS 펀딩(FR-06) | Cloudflare Stream, WebSocket |

---

## 16. 컨틴전시 플랜 (기술 관점)

| 리스크 | 대응 |
|--------|------|
| **Supabase Free tier 한계** | DAU 150 기준 충분. MAU 50K 초과 시 Pro($25/월). |
| **Vercel 대역폭 초과** | SSG + CDN으로 정적 서빙 주력. 초과 시 Pro($20/월). |
| **Kakao Maps 호출 제한** | 일 300,000회 무료. DAU 150 기준 여유. |
| **Gemini API 비용 (P1)** | 템플릿 우선 매칭으로 호출 최소화. 월 예산 상한 설정. |
| **4월 개발 지연** | 카테고리 9→5개 축소. 댓글 MVP 이후로 이월. |
| **Realtime 불안정** | 30초 폴링 Fallback. 실시간성만 포기, 기능 유지. |
| **정적 흐림 좌표 시드 충돌** | UUID v4 postId 사용으로 충돌 확률 무시 가능 (2^122). |

---

## 17. P2 기술 설계 프리뷰 (CCTV/IoT)

MVP에는 구현하지 않으나, 아키텍처 설계 시 고려해야 할 사항을 미리 정의한다.

### 17.1 CCTV 스트리밍 (FR-08)

```
쉘터 H/W (RTMPS) → Cloudflare Stream → Signed URL → 유저 (Web/App)
```

- **보안:** Shelter 엔티티의 `authorizedUserIds`에 포함된 유저만 Signed URL 발급.
- **권한:** Lv.3 (쉘터 관리자) 또는 해당 구역 등록 활동가.
- **비용:** Cloudflare Stream 분 단위 과금. 초기 소량이므로 부담 낮음.

### 17.2 IoT 센서 모니터링 (FR-09)

- 쉘터 → MQTT/HTTP → Supabase Edge Functions → DB 저장 → Realtime 구독.
- 대시보드: 온도, 배터리, 출입 감지 시계열 차트.

### 17.3 Domain Layer 확장

```typescript
// 추후 추가될 엔티티 (P2)
// domain/entities/shelter.entity.ts
export class Shelter {
  constructor(
    public readonly id: string,
    public readonly regionId: string,
    public readonly ownerId: string,
    public readonly authorizedUserIds: string[],
    public readonly status: 'active' | 'maintenance' | 'offline',
    public readonly temperature: number | null,
    public readonly batteryLevel: number | null,
  ) {}

  canAccess(userId: string): boolean {
    return this.authorizedUserIds.includes(userId);
  }
}
```

> **설계 원칙:** P2 엔티티는 Domain Layer에 추가하되, Infrastructure(Cloudflare, MQTT)는 P2 시점에 어댑터로 구현. 기존 아키텍처를 변경하지 않고 확장만 한다.

---

## 변경 이력

| 버전 | 주요 변경 |
|------|-----------|
| v1.0 | PRD v1.6 기반 초판. 클린 아키텍처 4계층, 전체 스키마, API, DI, 알림, 일정. |
| v1.1 (Gemini) | 정적 흐림 좌표(삼각 측량 방지), 보안 단일 창구, AI 가드레일 계층, Cloudflare Stream 추가. 단, 스키마 축소·4주 일정·CCTV MVP 포함 등 퇴보. |
| **v1.2 (통합)** | **v1.0 아키텍처 + v1.1 보안 개선을 통합.** 정적 흐림 좌표를 Location VO에 내장. 보안 단일 창구 원칙 명문화(RLS는 보조). AI 가드레일 3단계(템플릿→Gemini→Zod+Regex). CCTV는 P2 유지, 17절에 프리뷰만 기술. 전체 스키마·API·일정 복원. |
