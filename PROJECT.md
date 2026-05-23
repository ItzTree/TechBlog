# Notion → GitHub Pages 자동 블로그 시스템

## 개요

노션에서 글을 작성하면 자동으로 GitHub Pages 블로그에 발행되는 시스템.

- 정적 사이트 생성기: **Hugo (extended)**
- 테마: **Congo**
- 호스팅: **GitHub Pages** (`https://itztree.github.io/TechBlog/`)
- 자동화: **GitHub Actions** (매일 1회 cron + 수동 dispatch + push 이벤트)
- 변환: **notion-to-md** (Node.js)

---

## 요구사항

| 항목 | 상세 |
|------|------|
| 코드블록 | ``` 서식 보존, 언어별 하이라이팅 |
| 수식 | KaTeX를 통한 LaTeX 렌더링 (인라인/블록) |
| 이미지 | 노션 이미지 다운로드 후 `blog/static/images/`에 저장 |
| 발행 트리거 | 노션 DB에서 상태를 "발행"으로 변경 |
| 삭제 트리거 | 노션 DB에서 상태를 "삭제"로 변경 |
| 광고 | (예정) Google AdSense |

---

## 아키텍처

```
[노션 데이터베이스]
    │
    │  상태: "발행" / "발행완료" / "삭제"
    │
    ▼
[GitHub Actions] ── 매일 21:00 UTC cron + main push + 수동 dispatch
    │
    ├─ 1. checkout (submodules: 테마 포함)
    ├─ 2. Node 20 + npm ci
    ├─ 3. npm run sync (scripts/sync.js)
    │     ├─ "발행"/"발행완료" 페이지 조회
    │     ├─ 변경된 페이지만 notion-to-md로 마크다운 변환
    │     ├─ 이미지 다운로드 → blog/static/images/ (await로 완료 보장)
    │     ├─ 옛 슬러그/이미지 파일 자동 정리
    │     ├─ Hugo front matter 생성 → content/posts/<slug>.md
    │     ├─ "발행" → "발행완료" 상태 전환 (신규 글만)
    │     └─ "삭제" → 파일/이미지 삭제 → "삭제완료" 전환
    ├─ 4. 변경사항 있으면 commit & push (GITHUB_TOKEN, 워크플로 재트리거 안 함)
    ├─ 5. Hugo 빌드 (--minify --buildFuture)
    └─ 6. GitHub Pages 배포
```

---

## 노션 데이터베이스 구조

블로그 전용 노션 데이터베이스를 하나 만들고, 아래 속성을 추가한다.

| 속성명 | 타입 | 용도 |
|--------|------|------|
| 제목 | Title | 블로그 포스트 제목 |
| 상태 | Select | 작성중 / 발행 / 발행완료 / 삭제 / 삭제완료 |
| 태그 | Multi-select | Hugo 태그 |
| 카테고리 | Select | Hugo 카테고리 (알고리즘, 개발 등) |
| 슬러그 | Text | URL 경로 (선택, 없으면 제목 기반 자동생성) |
| 발행일 | Date | front matter `date` |

### 상태(Select) 라이프사이클

```
작성중  ──"발행" 으로 변경──▶  발행  ──sync 완료──▶  발행완료
                                                      │
                                            노션에서 본문 수정
                                                      │
                                          다음 cron에서 자동 재동기화
                                                      ▼
                                                    발행완료 (notion_last_edited 갱신)

발행완료 ──"삭제" 로 변경──▶ 삭제 ──sync 완료──▶ 삭제완료 (파일/이미지 제거됨)
```

---

## 디렉토리 구조

```
TechBlog/
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions 워크플로우
├── scripts/
│   ├── sync.js                    # 모든 동기화 로직 (단일 파일)
│   └── __tests__/
│       └── sync.test.js           # Jest 단위테스트
├── blog/                          # Hugo 사이트 루트
│   ├── config/
│   │   └── _default/
│   │       ├── hugo.toml          # 기본 설정 (baseURL, theme 등)
│   │       ├── params.toml        # Congo 테마 파라미터
│   │       ├── languages.ko.toml  # 한국어 설정
│   │       ├── menus.ko.toml      # 메뉴
│   │       └── markup.toml        # 마크업 옵션
│   ├── content/
│   │   └── posts/                 # 변환된 마크다운 파일
│   ├── static/
│   │   └── images/                # 다운로드된 이미지
│   ├── layouts/                   # 테마 오버라이드 (favicons, comments 등)
│   └── themes/
│       └── congo/                 # git submodule
├── package.json
├── PROJECT.md                     # 이 문서
└── .env                           # NOTION_API_KEY, NOTION_DATABASE_ID (gitignore)
```

---

## 주요 컴포넌트 상세

### `scripts/sync.js` — 단일 동기화 스크립트

모든 로직이 한 파일에 있다(약 300줄). 핵심 함수는 Jest 테스트를 위해 `module.exports`로 노출되어 있다.

| 함수 | 역할 |
|------|------|
| `getDataSourceId()` | 노션 DB의 data_source_id 조회 |
| `getPublishedPages()` | 상태가 "발행" 또는 "발행완료"인 페이지 목록 |
| `getDeletedPages()` | 상태가 "삭제"인 페이지 목록 |
| `getPageProperties(page)` | 노션 속성 → `{title, date, tags, category, slug}` 추출 |
| `needsSync(page, contentDir?)` | 재동기화 필요 판정 (front matter `notion_last_edited` 비교) |
| `processImages(markdown, slug)` | 노션 이미지 URL → 로컬 경로 재작성, 다운로드 Promise/파일명 Set 반환 |
| `downloadImage(url, filename)` | https/http 리다이렉트 처리하여 이미지 저장 |
| `pruneOldImages(dir, slug, keep)` | `{slug}-{N}.{ext}` 패턴의 사용되지 않는 옛 이미지 삭제 |
| `deleteOldSlugFiles(dir, notionId, currentSlug)` | 같은 `notion_id`를 가진 옛 슬러그 .md 삭제 |
| `convertLineBreaks(md)` | 노션의 단일 줄바꿈을 Hugo가 인식하는 trailing 2-space 줄바꿈으로 |
| `hasMathContent(md)` | KaTeX 활성화 필요 여부 (정규식 기반, 다소 느슨함) |
| `buildFrontMatter(props, hasMath, notionId, lastEdited)` | Hugo front matter 문자열 생성 |
| `syncPage(page)` | 한 페이지의 전체 변환·저장·정리 파이프라인 |
| `markAsCompleted(pageId)` | 노션 상태를 "발행완료"로 |
| `deletePage(page)`, `markAsDeleted(pageId)` | 로컬 정리 + 노션 상태를 "삭제완료"로 |
| `main()` | 발행/삭제 페이지 처리 루프 |

### 마크다운 변환 규칙

```
heading_1/2/3     → # / ## / ###
paragraph         → 일반 텍스트 + (필요 시) trailing 2-space 줄바꿈
bulleted_list     → - 항목
numbered_list     → 1. 항목
code              → ``` + 언어 지정
equation          → $$ 수식 $$ (블록) / $ 수식 $ (인라인)
image             → ![alt](/<BASE_PATH>/images/<slug>-N.<ext>)
table             → 마크다운 표
callout           → > blockquote
divider           → ---
toggle            → <details><summary> (HTML)
```

### Hugo Front Matter 예시

```yaml
---
title: "포스트 제목"
date: 2026-05-23
tags: ["알고리즘", "Python"]
categories: ["알고리즘"]
slug: "boj-1234"
math: true                                    # 수식이 있는 경우에만
notion_id: "abc12345-de67-89ab-cdef-0123..."  # 페이지 식별자(슬러그 변경 추적용)
notion_last_edited: "2026-05-23T12:34:56.000Z" # 동기화 판정용
draft: false
---
```

### 동기화 판정 로직 (중요)

- `needsSync()`는 **파일 mtime을 사용하지 않는다**. CI의 `actions/checkout`이 mtime을 매번 리셋하기 때문.
- 대신 front matter에 저장된 `notion_last_edited`와 노션 API의 `page.last_edited_time`을 ISO 문자열로 비교.
- 파일이 없거나 레거시(이 필드가 없는) 파일이면 강제 재동기화.

### 슬러그 변경 / 이미지 변경 시 정리

- 노션에서 슬러그를 바꾸면 `deleteOldSlugFiles`가 같은 `notion_id`를 가진 옛 `.md`를 삭제.
- 본문 이미지가 줄어들거나 순서가 바뀌면 `pruneOldImages`가 `{slug}-{N}.{ext}` 패턴 정확 매칭으로 사용되지 않는 옛 이미지를 삭제. 다른 글의 파일(예: `foo` 글이 `foo-bar-0.png`를 건드리지 않음)을 보호하기 위해 정규식 매칭 사용.

### GitHub Actions (`.github/workflows/deploy.yml`)

```
트리거: push(main) + cron "0 21 * * *" + workflow_dispatch
환경: Node.js 20, Hugo extended (latest)
시크릿: NOTION_API_KEY, NOTION_DATABASE_ID
환경변수: BASE_PATH=/TechBlog (이미지 경로 prefix)

단계:
1. checkout (submodules: true, fetch-depth: 0)
2. Setup Node.js 20 + npm ci
3. npm run sync → blog/content/, blog/static/ 변경
4. 변경 있으면 github-actions[bot] 명의로 commit & push (GITHUB_TOKEN)
5. Hugo build (--minify --buildFuture)
6. Pages 배포
```

> `Commit synced content` 단계의 push는 GitHub 정책상 워크플로를 재트리거하지 않으므로 무한 루프 위험 없음.

### 테스트 (`scripts/__tests__/sync.test.js`)

Jest 29 기반. 현재 26개 단위테스트.

| 영역 | 테스트 수 |
|------|-----------|
| 모듈 exports smoke | 1 |
| `processImages` | 4 + 2 (filenames Set) |
| `buildFrontMatter` (notion_id, notion_last_edited, escape) | 3 |
| `deleteOldSlugFiles` | 5 |
| `pruneOldImages` | 5 |
| `needsSync` (notion_last_edited 기반, mtime 무시) | 6 |

`os.tmpdir()`로 파일시스템 격리. 다운로드는 unreachable URL로 거부 케이스 검증.

실행:
```bash
npm test
```

---

## 셋업 순서

### Phase 1: Hugo + GitHub Pages 기본 세팅 ✅

1. GitHub 레포 생성
2. Hugo 사이트 초기화 + Congo 테마 설치 (git submodule)
3. KaTeX 설정 (수식 렌더링) — Congo가 내장 지원
4. 샘플 포스트로 배포 확인

### Phase 2: 노션 연동 ✅

1. Notion Integration 생성 (https://www.notion.so/my-integrations)
2. 블로그 전용 데이터베이스 생성 + Integration 연결
3. `scripts/sync.js` 작성
4. `.env`로 로컬 테스트

### Phase 3: 자동화 ✅

1. `.github/workflows/deploy.yml` 작성
2. 시크릿 등록 (`NOTION_API_KEY`, `NOTION_DATABASE_ID`)
3. 자동 발행/삭제 테스트

### Phase 4: 안정화 ✅

1. 이미지 다운로드 await 보장
2. 슬러그/이미지 옛 파일 자동 정리 (`notion_id` 추적, `pruneOldImages`)
3. mtime 대신 `notion_last_edited` 기반 동기화 판정
4. Jest 단위테스트 (26개)

### Phase 5: 광고 + 마무리 (TODO)

1. Google AdSense 가입 + partial 삽입
2. SEO 점검 (sitemap, robots.txt — Hugo가 기본 생성)
3. 커스텀 도메인 (선택)

---

## 필요한 API 키

| 키 | 발급 위치 | 용도 |
|----|-----------|------|
| `NOTION_API_KEY` | https://www.notion.so/my-integrations | 노션 페이지 읽기/상태 업데이트 |
| `NOTION_DATABASE_ID` | 노션 DB URL에서 추출 | 대상 DB 지정 |

GitHub Pages 배포는 별도 키 없이 GitHub Actions 기본 `GITHUB_TOKEN`으로 동작.

---

## 비용

| 항목 | 비용 |
|------|------|
| GitHub Pages | 무료 |
| GitHub Actions | 무료 (월 2,000분) |
| Notion API | 무료 |
| 도메인 (선택) | 연 1~2만원 |

**총 비용: 무료** (커스텀 도메인 제외)

---

## 알려진 한계 (Medium/Low, 미해결)

- `hasMathContent` 정규식이 다소 느슨해서 코드블록 안의 `$variable`도 KaTeX 활성화로 잡힐 수 있음.
- `getDataSourceId`가 sync마다 두 번(발행/삭제) 호출됨 — 캐싱 안 됨.
- `BASE_PATH`가 `deploy.yml`과 `sync.js` 두 곳에 하드코딩(`/TechBlog`).
- 발행일 기본값이 UTC `created_time` → KST 기준으로 하루 차이 가능.
- sync 실패 시 슬랙/이메일 알림 부재 (Actions 탭 직접 확인 필요).
