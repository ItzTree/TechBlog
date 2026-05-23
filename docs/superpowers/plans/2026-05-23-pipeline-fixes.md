# Notion → Hugo 파이프라인 Critical/High 결함 수정 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (또는 superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파이프라인 분석에서 도출된 Critical(#1–#4) + High(#5–#7) 7개 결함을 GitHub 이슈로 등록하고, 각 이슈를 별도 브랜치/PR로 해결한다. 모든 수정은 Jest 단위 테스트로 회귀 방지를 보장한다.

**Architecture:** 단일 `scripts/sync.js` 파일을 모듈로 리팩토링하지 않고, 핵심 함수들(`needsSync`, `processImages`, `syncPage`, `getPageProperties`, `buildFrontMatter`)을 export하여 Jest로 테스트한다. Notion API와 fs/http는 jest.mock으로 격리한다. 각 PR은 1~2개 이슈를 닫는다.

**Tech Stack:** Node.js 20, CommonJS, Jest(devDep), GitHub CLI(gh).

---

## File Structure

| 파일 | 역할 | 작업 |
|------|------|------|
| `scripts/sync.js` | 메인 sync 로직 | 함수 export 추가, 버그 수정 |
| `scripts/__tests__/sync.test.js` | Jest 테스트 | 신규 생성 |
| `package.json` | jest devDep, test 스크립트 | 수정 |
| `.gitignore` | (필요 시) coverage/ 추가 | 수정 |
| `docs/superpowers/plans/2026-05-23-pipeline-fixes.md` | 이 plan | 생성 |

`sync.js`는 현재 main()까지 한 파일이라 모듈 export만 추가하면 테스트 가능. 큰 리팩토링 없음.

---

## 이슈 ↔ PR 매핑

| GitHub Issue | 내용 | PR | 비고 |
|--------------|------|-----|------|
| #1 | 슬러그 변경 → 옛 파일 고아화 | PR-A | notion_id 추적 추가 |
| #2 | 이미지 인덱스 변경 → 옛 이미지 고아화 | PR-B | 사용 중 이미지 외 prune |
| #3 | downloadImage await 누락 | PR-C | #4와 묶여서 한 PR |
| #4 | 다운로드 실패가 sync 성공으로 보고됨 | PR-C | #3 fix의 부산물 |
| #5 | mtime 비교 → checkout이 mtime 리셋 | PR-D | #6과 묶여서 한 PR |
| #6 | "발행완료" 글이 cron에서 재동기화 안 됨 | PR-D | #5 fix의 결과 |
| #7 | sync push가 워크플로 재트리거 가능성 | PR-E | 우선 조사 후 결정 |

총 5개 PR. 순서: PR-C(이미지 await) → PR-A(slug) → PR-B(이미지 prune) → PR-D(mtime) → PR-E(push 조사).
**PR-C를 먼저 하는 이유:** PR-B(이미지 prune)가 동작하려면 다운로드가 동기여야 함.

---

## Task 0: Jest 환경 설정

**Files:**
- Modify: `package.json`
- Create: `scripts/__tests__/sync.test.js` (placeholder)
- Modify: `scripts/sync.js` (export 추가)
- Modify: `.gitignore` (coverage/)

- [ ] **Step 1: Jest devDep 설치**

```bash
cd C:/Users/princ/Desktop/Coding/TechBlog && npm install --save-dev jest@^29
```

- [ ] **Step 2: package.json 수정**

`"scripts"` 섹션에서 `test` 변경:

```json
"scripts": {
  "sync": "node scripts/sync.js",
  "test": "jest"
}
```

`"jest"` 섹션 추가 (최상위):

```json
"jest": {
  "testEnvironment": "node",
  "testMatch": ["**/__tests__/**/*.test.js"]
}
```

- [ ] **Step 3: sync.js에 module.exports 추가**

`main()` 호출 위에 가드 추가:

```javascript
module.exports = {
  needsSync,
  getPageProperties,
  buildFrontMatter,
  processImages,
  syncPage,
  hasMathContent,
  convertLineBreaks,
};

if (require.main === module) {
  main().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
```

기존 `main().catch(...)` 줄은 위 블록으로 대체.

- [ ] **Step 4: smoke test 작성**

`scripts/__tests__/sync.test.js`:

```javascript
const sync = require("../sync");

describe("sync module exports", () => {
  test("exports expected functions", () => {
    expect(typeof sync.needsSync).toBe("function");
    expect(typeof sync.getPageProperties).toBe("function");
    expect(typeof sync.buildFrontMatter).toBe("function");
  });
});
```

- [ ] **Step 5: 테스트 실행**

```bash
cd C:/Users/princ/Desktop/Coding/TechBlog && npm test
```

Expected: 1 passed (smoke test).

- [ ] **Step 6: .gitignore에 coverage/ 추가**

```
coverage/
```

- [ ] **Step 7: 커밋 (별도 브랜치)**

```bash
git checkout -b chore/jest-setup
git add package.json package-lock.json scripts/__tests__/sync.test.js scripts/sync.js .gitignore
git commit -m "chore: add Jest test infrastructure"
git push -u origin chore/jest-setup
gh pr create --title "chore: Jest 테스트 인프라 추가" --body "이후 sync.js 결함 수정의 회귀 테스트를 위한 사전 작업."
```

PR 머지 후 다음 task로 진행.

---

## Task 1: GitHub 이슈 7개 등록

- [ ] **Step 1: 라벨 생성**

```bash
gh label create bug --color d73a4a --description "버그" --force
gh label create critical --color b60205 --description "Critical: 데이터 손실/깨진 동작" --force
gh label create high --color e99695 --description "High: 논리적 결함" --force
```

- [ ] **Step 2: 이슈 7개 등록 (gh issue create)**

본문은 각각 다음 형식:
- 증상 (어떤 상황에서 어떤 문제가 보이나)
- 원인 (코드 라인 인용)
- 제안 해결책

각 이슈 등록 후 발급된 번호를 메모. 이후 PR에서 `Closes #N` 으로 참조.

- [ ] **Step 3: 이슈 번호 표 작성**

이슈 등록 후 plan 하단 "이슈 ↔ PR 매핑" 표에 실제 GitHub 이슈 번호 채워넣기.

---

## Task 2: Issue #3 + #4 해결 — 이미지 다운로드 await

**Files:**
- Modify: `scripts/sync.js` (processImages, syncPage)
- Modify: `scripts/__tests__/sync.test.js`

**Branch:** `fix/image-download-await`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/__tests__/sync.test.js`에 추가:

```javascript
const fs = require("fs");
const path = require("path");

describe("processImages", () => {
  const { processImages } = require("../sync");

  test("returns object with markdown and downloads array", () => {
    const md = "![alt](https://example.com/img.png)";
    const result = processImages(md, "test-slug");
    expect(result).toHaveProperty("markdown");
    expect(result).toHaveProperty("downloads");
    expect(Array.isArray(result.downloads)).toBe(true);
    expect(result.downloads.length).toBe(1);
    expect(result.downloads[0]).toBeInstanceOf(Promise);
  });

  test("markdown contains rewritten local path", () => {
    const md = "![alt](https://example.com/img.png)";
    const result = processImages(md, "test-slug");
    expect(result.markdown).toMatch(/!\[alt\]\(\/[^)]+test-slug-0\.png\)/);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test
```

Expected: FAIL (processImages가 string을 반환).

- [ ] **Step 3: processImages 리팩토링**

```javascript
function processImages(markdown, slug) {
  let imageIndex = 0;
  const downloads = [];
  const newMarkdown = markdown.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (match, alt, url) => {
      const ext = path.extname(new URL(url).pathname) || ".png";
      const filename = `${slug}-${imageIndex++}${ext}`;
      downloads.push(
        downloadImage(url, filename).catch((err) => {
          console.error(`Failed to download image: ${url}`, err.message);
          throw err;
        })
      );
      const basePath = process.env.BASE_PATH || "/TechBlog";
      return `![${alt}](${basePath}/images/${filename})`;
    }
  );
  return { markdown: newMarkdown, downloads };
}
```

- [ ] **Step 4: syncPage 수정 — await all downloads**

기존 라인:

```javascript
markdown = processImages(markdown, props.slug);
```

→

```javascript
const imageResult = processImages(markdown, props.slug);
markdown = imageResult.markdown;
await Promise.all(imageResult.downloads);
```

`syncPage`가 이미 async이므로 await 사용 가능.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
npm test
```

Expected: 모든 테스트 PASS.

- [ ] **Step 6: 다운로드 실패 시 sync 실패로 보고되는지 테스트 추가**

```javascript
test("processImages download rejection propagates", async () => {
  // 잘못된 URL로 실제 다운로드를 트리거 → reject
  const result = processImages("![](https://0.0.0.0:1/x.png)", "x");
  await expect(Promise.all(result.downloads)).rejects.toBeDefined();
});
```

- [ ] **Step 7: 커밋 & PR**

```bash
git checkout -b fix/image-download-await
git add scripts/sync.js scripts/__tests__/sync.test.js
git commit -m "fix: await image downloads before writing markdown

Closes #<N3>, #<N4>"
git push -u origin fix/image-download-await
gh pr create --title "fix: 이미지 다운로드 완료 보장" --body "...closes #N3 #N4..."
```

---

## Task 3: Issue #1 해결 — 슬러그 변경 시 옛 파일 정리

**Files:**
- Modify: `scripts/sync.js` (buildFrontMatter, syncPage)
- Modify: `scripts/__tests__/sync.test.js`

**Branch:** `fix/slug-orphan-cleanup`

- [ ] **Step 1: 실패하는 테스트 작성**

```javascript
const os = require("os");

describe("syncPage slug change cleanup", () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("buildFrontMatter includes notion_id", () => {
    const { buildFrontMatter } = require("../sync");
    const fm = buildFrontMatter(
      { title: "x", date: "2026-01-01", tags: [], category: "", slug: "new-slug" },
      false,
      "abc-123",
      "2026-01-01T00:00:00.000Z"
    );
    expect(fm).toMatch(/notion_id: "abc-123"/);
  });

  test("deleteOldSlugFiles removes file with same notion_id, different slug", () => {
    const { deleteOldSlugFiles } = require("../sync");
    const oldFile = path.join(tmpDir, "old-slug.md");
    fs.writeFileSync(oldFile, '---\nnotion_id: "abc-123"\nslug: "old-slug"\n---\n');
    const newFile = path.join(tmpDir, "new-slug.md");
    fs.writeFileSync(newFile, '---\nnotion_id: "abc-123"\nslug: "new-slug"\n---\n');

    deleteOldSlugFiles(tmpDir, "abc-123", "new-slug");

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Expected: FAIL (buildFrontMatter signature 불일치, deleteOldSlugFiles 미정의).

- [ ] **Step 3: buildFrontMatter에 notion_id, notion_last_edited 추가**

```javascript
function buildFrontMatter(props, hasMath, notionId, lastEdited) {
  const lines = ["---"];
  lines.push(`title: "${props.title.replace(/"/g, '\\"')}"`);
  lines.push(`date: ${props.date}`);
  if (props.tags.length > 0) {
    lines.push(`tags: [${props.tags.map((t) => `"${t}"`).join(", ")}]`);
  }
  if (props.category) {
    lines.push(`categories: ["${props.category}"]`);
  }
  lines.push(`slug: "${props.slug}"`);
  if (hasMath) lines.push("math: true");
  lines.push(`notion_id: "${notionId}"`);
  lines.push(`notion_last_edited: "${lastEdited}"`);
  lines.push("draft: false");
  lines.push("---");
  return lines.join("\n");
}
```

- [ ] **Step 4: deleteOldSlugFiles 추가**

```javascript
function deleteOldSlugFiles(contentDir, notionId, currentSlug) {
  if (!fs.existsSync(contentDir)) return;
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    if (file === `${currentSlug}.md`) continue;
    const content = fs.readFileSync(path.join(contentDir, file), "utf-8");
    const match = content.match(/notion_id:\s*"([^"]+)"/);
    if (match && match[1] === notionId) {
      fs.unlinkSync(path.join(contentDir, file));
      console.log(`Deleted old-slug file: ${file}`);
    }
  }
}
```

- [ ] **Step 5: syncPage 수정 — 호출 추가 및 인자 전달**

```javascript
const frontMatter = buildFrontMatter(props, math, page.id, page.last_edited_time);
// ... writeFileSync
deleteOldSlugFiles(CONTENT_DIR, page.id, props.slug);
```

deleteOldSlugFiles는 export에도 추가.

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: 커밋 & PR**

```bash
git checkout -b fix/slug-orphan-cleanup
git add scripts/sync.js scripts/__tests__/sync.test.js
git commit -m "fix: 슬러그 변경 시 옛 파일 자동 정리

Closes #<N1>"
git push -u origin fix/slug-orphan-cleanup
gh pr create ...
```

---

## Task 4: Issue #2 해결 — 옛 이미지 파일 정리

**Files:**
- Modify: `scripts/sync.js`
- Modify: `scripts/__tests__/sync.test.js`

**Branch:** `fix/image-orphan-cleanup`

- [ ] **Step 1: 실패하는 테스트 작성**

```javascript
describe("pruneOldImages", () => {
  let imgDir;
  beforeEach(() => {
    imgDir = fs.mkdtempSync(path.join(os.tmpdir(), "img-test-"));
  });
  afterEach(() => {
    fs.rmSync(imgDir, { recursive: true, force: true });
  });

  test("removes images with slug prefix not in keep set", () => {
    const { pruneOldImages } = require("../sync");
    fs.writeFileSync(path.join(imgDir, "foo-0.png"), "a");
    fs.writeFileSync(path.join(imgDir, "foo-1.png"), "b");
    fs.writeFileSync(path.join(imgDir, "foo-2.png"), "c");
    fs.writeFileSync(path.join(imgDir, "bar-0.png"), "d");

    pruneOldImages(imgDir, "foo", new Set(["foo-0.png", "foo-1.png"]));

    expect(fs.existsSync(path.join(imgDir, "foo-0.png"))).toBe(true);
    expect(fs.existsSync(path.join(imgDir, "foo-1.png"))).toBe(true);
    expect(fs.existsSync(path.join(imgDir, "foo-2.png"))).toBe(false);
    expect(fs.existsSync(path.join(imgDir, "bar-0.png"))).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

- [ ] **Step 3: pruneOldImages 구현**

```javascript
function pruneOldImages(imageDir, slug, keepFilenames) {
  if (!fs.existsSync(imageDir)) return;
  const prefix = `${slug}-`;
  for (const file of fs.readdirSync(imageDir)) {
    if (!file.startsWith(prefix)) continue;
    if (keepFilenames.has(file)) continue;
    fs.unlinkSync(path.join(imageDir, file));
    console.log(`Pruned old image: ${file}`);
  }
}
```

- [ ] **Step 4: processImages가 사용한 파일명 집합 반환하도록 확장**

```javascript
function processImages(markdown, slug) {
  let imageIndex = 0;
  const downloads = [];
  const filenames = new Set();
  const newMarkdown = markdown.replace(/* 동일 */);
  // 안에서 filenames.add(filename);
  return { markdown: newMarkdown, downloads, filenames };
}
```

- [ ] **Step 5: syncPage에서 prune 호출**

```javascript
const imageResult = processImages(markdown, props.slug);
markdown = imageResult.markdown;
await Promise.all(imageResult.downloads);
pruneOldImages(IMAGE_DIR, props.slug, imageResult.filenames);
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

- [ ] **Step 7: 커밋 & PR**

---

## Task 5: Issue #5 + #6 해결 — mtime → notion_last_edited

**Files:**
- Modify: `scripts/sync.js` (needsSync, buildFrontMatter는 Task 3에서 이미 수정됨)
- Modify: `scripts/__tests__/sync.test.js`

**Branch:** `fix/sync-judgement-via-front-matter`

- [ ] **Step 1: 실패하는 테스트 작성**

```javascript
describe("needsSync via notion_last_edited", () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-test-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("returns true when file missing", () => {
    const { needsSync } = require("../sync");
    const page = {
      properties: { 제목: { title: [{ plain_text: "x" }] }, 슬러그: { rich_text: [{ plain_text: "x" }] } },
      last_edited_time: "2026-05-01T00:00:00.000Z",
      created_time: "2026-05-01T00:00:00.000Z",
    };
    expect(needsSync(page, dir)).toBe(true);
  });

  test("returns true when notion last_edited > stored", () => {
    const { needsSync } = require("../sync");
    fs.writeFileSync(path.join(dir, "x.md"),
      '---\nnotion_last_edited: "2026-05-01T00:00:00.000Z"\nslug: "x"\n---\n');
    const page = {
      properties: { 제목: { title: [{ plain_text: "x" }] }, 슬러그: { rich_text: [{ plain_text: "x" }] } },
      last_edited_time: "2026-05-02T00:00:00.000Z",
      created_time: "2026-05-01T00:00:00.000Z",
    };
    expect(needsSync(page, dir)).toBe(true);
  });

  test("returns false when timestamps equal", () => {
    const { needsSync } = require("../sync");
    fs.writeFileSync(path.join(dir, "x.md"),
      '---\nnotion_last_edited: "2026-05-02T00:00:00.000Z"\nslug: "x"\n---\n');
    const page = {
      properties: { 제목: { title: [{ plain_text: "x" }] }, 슬러그: { rich_text: [{ plain_text: "x" }] } },
      last_edited_time: "2026-05-02T00:00:00.000Z",
      created_time: "2026-05-01T00:00:00.000Z",
    };
    expect(needsSync(page, dir)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

- [ ] **Step 3: needsSync 변경 (contentDir 인자 추가, front matter 파싱)**

```javascript
function needsSync(page, contentDir = CONTENT_DIR) {
  const props = getPageProperties(page);
  const filePath = path.join(contentDir, `${props.slug}.md`);
  if (!fs.existsSync(filePath)) return true;
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/notion_last_edited:\s*"([^"]+)"/);
  if (!match) return true;
  const stored = new Date(match[1]);
  const pageEdited = new Date(page.last_edited_time);
  return pageEdited > stored;
}
```

- [ ] **Step 4: main()의 호출부 변경 없음 확인**

`needsSync(page)` 그대로 동작 (CONTENT_DIR 디폴트).

- [ ] **Step 5: 테스트 실행 — 통과 확인**

- [ ] **Step 6: 커밋 & PR**

---

## Task 6: Issue #7 조사 & 해결 — push 트리거 루프

- [ ] **Step 1: 사실 확인**

```bash
gh run list --limit 20 --json conclusion,event,createdAt,headBranch,name
```

연속된 두 run이 같은 sync 커밋으로 트리거됐는지 확인. GitHub 공식 문서상 GITHUB_TOKEN으로 push된 커밋은 워크플로 재트리거하지 않음 — 실제 그러한지 검증.

- [ ] **Step 2: 시나리오별 처리**

- 시나리오 A: 재트리거 발생 안 함 → 이슈를 "won't fix / verified non-issue" 코멘트와 함께 닫음.
- 시나리오 B: 재트리거 발생 → commit message에 `[skip ci]` 추가:

```yaml
git diff --staged --quiet || (git commit -m "Sync from Notion [skip ci]" && git push)
```

- [ ] **Step 3: 시나리오 B일 경우만**

브랜치 `fix/skip-ci-on-sync-commit` 생성, deploy.yml 수정, PR.

---

## Self-Review

- ✅ Spec coverage: 7개 이슈 모두 Task로 매핑됨 (#3+#4→Task 2, #1→Task 3, #2→Task 4, #5+#6→Task 5, #7→Task 6).
- ✅ Placeholder scan: 없음. 모든 step은 구체적 코드/명령 포함.
- ✅ Type consistency: `processImages` 반환 타입이 Task 2(`{markdown, downloads}`)에서 Task 4(`{markdown, downloads, filenames}`)로 확장됨 — Task 4 step에서 명시.
- ✅ `buildFrontMatter` 시그니처가 Task 3에서 변경(`notionId`, `lastEdited` 추가). Task 5는 같은 함수를 그대로 사용.

Self-review 통과.

---

## 실행 옵션

이 plan은 inline execution(이 세션 안에서 차례로 실행)으로 진행. 각 Task 완료 후 사용자에게 PR 링크와 머지 여부를 묻고 다음으로 진행.
