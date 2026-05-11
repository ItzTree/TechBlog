# Notion → GitHub Pages 자동 블로그 시스템

## 개요

노션에서 글을 작성하면 자동으로 GitHub Pages 블로그에 발행되는 시스템.

- 정적 사이트 생성기: **Hugo**
- 테마: **PaperMod**
- 호스팅: **GitHub Pages**
- 자동화: **GitHub Actions**
- 변환: **notion-to-md** (Node.js)

---

## 요구사항

| 항목 | 상세 |
|------|------|
| 코드블록 | ``` 서식 보존, 언어별 하이라이팅 |
| 수식 | KaTeX를 통한 LaTeX 렌더링 (인라인/블록) |
| 이미지 | 노션 이미지 다운로드 후 repo에 저장 |
| 발행 트리거 | 노션 DB에서 상태를 "발행"으로 변경 |
| 광고 | Google AdSense 스크립트 삽입 |

---

## 아키텍처

```
[노션 데이터베이스]
    │
    │  상태: "발행"
    │
    ▼
[GitHub Actions] ── 5분 간격 폴링 (cron)
    │
    ├─ 1. Notion API로 "발행" 상태 페이지 조회
    ├─ 2. notion-to-md로 마크다운 변환
    │     ├─ 코드블록 → ``` 보존
    │     ├─ 수식 → $$ 보존
    │     └─ 이미지 → 다운로드 후 static/images/에 저장
    ├─ 3. Hugo front matter 생성 (title, date, tags)
    ├─ 4. content/posts/에 .md 파일 저장
    ├─ 5. Hugo 빌드
    └─ 6. GitHub Pages 배포
```

---

## 노션 데이터베이스 구조

블로그 전용 노션 데이터베이스를 하나 만들고, 아래 속성을 추가한다.

| 속성명 | 타입 | 용도 |
|--------|------|------|
| 제목 | Title | 블로그 포스트 제목 |
| 상태 | Select | 작성중 / 발행 / 비공개 |
| 태그 | Multi-select | Hugo 태그 |
| 카테고리 | Select | Hugo 카테고리 (알고리즘, 개발, etc.) |
| 슬러그 | Text | URL 경로 (선택, 없으면 제목 기반 자동생성) |
| 발행일 | Date | front matter date |

---

## 디렉토리 구조

```
TechBlog/
├── .github/
│   └── workflows/
│       └── notion-sync.yml      # GitHub Actions 워크플로우
├── scripts/
│   ├── sync.js                  # 메인 동기화 스크립트
│   ├── notion-to-hugo.js        # 노션 → Hugo 마크다운 변환
│   └── download-images.js       # 이미지 다운로드
├── blog/                        # Hugo 사이트 루트
│   ├── config.toml              # Hugo 설정
│   ├── content/
│   │   └── posts/               # 변환된 마크다운 파일
│   ├── static/
│   │   └── images/              # 다운로드된 이미지
│   ├── layouts/
│   │   └── partials/
│   │       ├── adsense.html     # AdSense 코드
│   │       └── katex.html       # KaTeX 로드
│   └── themes/
│       └── PaperMod/
├── package.json
└── PROJECT.md                   # 이 문서
```

---

## 주요 컴포넌트 상세

### 1. 동기화 스크립트 (scripts/sync.js)

```
역할: 노션 DB 폴링 → 변환 → 파일 생성 → git commit & push

입력: NOTION_API_KEY, NOTION_DATABASE_ID (환경변수)
출력: content/posts/*.md, static/images/*

처리 흐름:
1. Notion API로 상태="발행"인 페이지 목록 조회
2. 각 페이지의 last_edited_time과 기존 파일 비교
3. 변경된 페이지만 변환
4. 마크다운 파일 생성 (front matter 포함)
5. 이미지 다운로드
6. git add → commit → push
```

### 2. 마크다운 변환 (scripts/notion-to-hugo.js)

```
핵심 변환 규칙:

- heading_1/2/3     → # / ## / ###
- paragraph         → 일반 텍스트
- bulleted_list     → - 항목
- numbered_list     → 1. 항목
- code              → ``` + 언어 지정
- equation          → $$ 수식 $$ (블록) / $ 수식 $ (인라인)
- image             → ![alt](로컬경로)
- table             → 마크다운 표
- callout           → > blockquote
- divider           → ---
- toggle            → <details><summary> (HTML)
```

### 3. Hugo Front Matter 생성

```yaml
---
title: "포스트 제목"
date: 2026-05-09
tags: ["알고리즘", "Python"]
categories: ["알고리즘"]
slug: "boj-1234"
math: true           # 수식이 있는 경우에만
draft: false
---
```

### 4. GitHub Actions (notion-sync.yml)

```
트리거: cron 5분 간격 + 수동 dispatch
환경: Node.js 20
시크릿: NOTION_API_KEY, NOTION_DATABASE_ID

단계:
1. 레포 checkout
2. Node.js 설정 + npm install
3. sync.js 실행
4. 변경사항 있으면 commit & push
5. Hugo 빌드
6. GitHub Pages 배포
```

---

## 셋업 순서

### Phase 1: Hugo + GitHub Pages 기본 세팅
1. GitHub 레포 생성
2. Hugo 사이트 초기화 + PaperMod 테마 설치
3. KaTeX 설정 (수식 렌더링)
4. 샘플 포스트로 배포 확인

### Phase 2: 노션 연동
1. Notion Integration 생성 (https://www.notion.so/my-integrations)
2. 블로그 전용 데이터베이스 생성 + Integration 연결
3. 동기화 스크립트 작성
4. 로컬에서 테스트

### Phase 3: 자동화
1. GitHub Actions 워크플로우 작성
2. 시크릿 등록 (NOTION_API_KEY, NOTION_DATABASE_ID)
3. 자동 발행 테스트

### Phase 4: 광고 + 마무리
1. Google AdSense 가입 + 코드 삽입
2. 커스텀 도메인 연결 (선택)
3. SEO 기본 설정 (sitemap, robots.txt)

---

## 필요한 API 키

| 키 | 발급 위치 | 용도 |
|----|-----------|------|
| NOTION_API_KEY | https://www.notion.so/my-integrations | 노션 페이지 읽기 |
| NOTION_DATABASE_ID | 노션 DB URL에서 추출 | 대상 DB 지정 |

GitHub Pages 배포는 별도 키 없이 GitHub Actions 기본 토큰으로 동작.

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

## 구축 순서

### Phase 1: 환경 세팅

1. **Hugo 설치** — `winget install Hugo.Hugo.Extended`
2. **Git 초기화** — `git init` + `.gitignore` 생성
3. **GitHub 레포 생성** — `gh repo create`

> 확인: `hugo version` 출력, `git remote -v` 확인

### Phase 2: Hugo 사이트 + 테마

4. **Hugo 사이트 초기화** — `hugo new site blog`
5. **PaperMod 테마 설치** — git submodule로 `blog/themes/PaperMod` 추가
6. **config.toml 설정** — 사이트 제목, 언어, 테마, 메뉴 등
7. **KaTeX 설정** — `blog/layouts/partials/`에 KaTeX CDN 로드 partial 추가
8. **샘플 포스트 작성** — 코드블록 + 수식 포함 테스트 글

> 확인: `hugo server`로 로컬 렌더링 확인 (코드블록, 수식)

### Phase 3: 노션 연동 스크립트

9. **Node.js 프로젝트 초기화** — `package.json`, 의존성 설치 (`@notionhq/client`, `notion-to-md`, `dotenv`)
10. **scripts/sync.js** — 메인 동기화 (Notion DB 폴링 → 변환 → 파일 생성)
11. **scripts/notion-to-hugo.js** — 노션 블록 → Hugo 마크다운 변환 (코드, 수식, 이미지, 표, callout, toggle + front matter 자동 생성)
12. **scripts/download-images.js** — 노션 이미지 다운로드 → `blog/static/images/` 저장

> 확인: `.env`에 키 넣고 `node scripts/sync.js`로 로컬 테스트

### Phase 4: GitHub Actions 자동화

13. **`.github/workflows/notion-sync.yml`** — 5분 cron + 수동 dispatch, checkout → Node.js → sync → Hugo 빌드 → Pages 배포
14. **GitHub Secrets 등록** — `NOTION_API_KEY`, `NOTION_DATABASE_ID`
15. **GitHub Pages 설정** — Pages 소스를 GitHub Actions로 변경

> 확인: 노션에서 "발행" 상태 변경 → Actions 실행 → 블로그 게시 확인

### Phase 5: AdSense + 마무리

16. **AdSense 코드 삽입** — `blog/layouts/partials/adsense.html` 생성, head에 삽입
17. **SEO 기본 설정** — sitemap, robots.txt

> 확인: 배포 사이트에서 AdSense 스크립트 로드 확인

### 순서 요약

```
Phase 1 (환경)  →  Phase 2 (Hugo)  →  Phase 3 (스크립트)  →  Phase 4 (자동화)  →  Phase 5 (광고)
  [1~3]              [4~8]              [9~12]                [13~15]              [16~17]
```

각 Phase 끝마다 확인 단계를 거쳐 다음으로 넘어감.
