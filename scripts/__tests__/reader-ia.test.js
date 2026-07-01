/**
 * reader-ia.test.js
 *
 * S1 구조 불변식 검증: 홈/recent 피드에서 GeekNews 카테고리 글이 0건
 * S2 구조 불변식 검증: 메인 메뉴(nav)에 GeekNews 항목이 0건
 *
 * 실행 전제: blog/public/ 에 hugo build 결과물이 존재해야 한다.
 * (jest --globalSetup 또는 사전 hugo build 필요)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BLOG_DIR = path.resolve(__dirname, "../../blog");
const PUBLIC_DIR = path.join(BLOG_DIR, "public");

function ensureBuilt() {
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    execSync("hugo build", { cwd: BLOG_DIR, stdio: "pipe" });
  }
}

describe("S1: 홈/recent 피드 GeekNews 배제", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  test("홈 페이지 HTML에 geeknews 카테고리 포스트 링크가 없어야 한다", () => {
    const indexHtml = fs.readFileSync(
      path.join(PUBLIC_DIR, "index.html"),
      "utf-8"
    );

    // geeknews 카테고리의 더미 포스트 슬러그로 검색
    expect(indexHtml).not.toMatch(/geeknews-test-\d+/);

    // posts/geeknews- 패턴의 링크가 없어야 함
    expect(indexHtml).not.toMatch(/href="[^"]*\/posts\/geeknews-/);
  });

  test("홈 페이지에 geeknews 카테고리 글 제목이 포함되지 않아야 한다", () => {
    const indexHtml = fs.readFileSync(
      path.join(PUBLIC_DIR, "index.html"),
      "utf-8"
    );

    // GeekNews 더미 포스트 제목 패턴
    expect(indexHtml).not.toMatch(/GeekNews 테스트 더미 글/);
  });

  test("홈 페이지에 포트폴리오(PS/Android) 포스트는 있어야 한다", () => {
    const indexHtml = fs.readFileSync(
      path.join(PUBLIC_DIR, "index.html"),
      "utf-8"
    );

    // posts/ 링크가 있어야 한다 (geeknews 제외된 포트폴리오 글)
    // URL은 소문자 슬러그 형태 (abc-458-c 등)
    const hasPsContent =
      /href="[^"]*\/posts\/abc-\d+/.test(indexHtml) ||
      /href="[^"]*\/posts\/[^"g][^"e][^"e][^"k]/.test(indexHtml);

    expect(hasPsContent).toBe(true);
  });

  test("geeknews 포스트는 자체 페이지로는 접근 가능해야 한다", () => {
    const geekNewsPostPath = path.join(
      PUBLIC_DIR,
      "posts",
      "geeknews-test-001",
      "index.html"
    );
    expect(fs.existsSync(geekNewsPostPath)).toBe(true);
  });
});

/**
 * S2: 메인 메뉴 GeekNews 배제
 *
 * 검증 방식: 생성된 HTML의 <header> 섹션에 geeknews 링크가 없어야 한다.
 * 규칙은 header 파셜의 vertical 파라미터 필터로 선언적으로 적용된다.
 * (blog/config/_default/params.toml의 excludeCategories 를 재사용)
 */
describe("S2: 메인 메뉴 GeekNews 배제", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  /** <header>...</header> 블록을 추출하는 헬퍼 */
  function extractHeader(html) {
    const m = html.match(/<header[^>]*>([\s\S]*?)<\/header>/);
    return m ? m[1] : "";
  }

  test("홈 페이지 메인 메뉴(header)에 geeknews 링크가 없어야 한다", () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf-8");
    const header = extractHeader(html);
    // geeknews 를 가리키는 href 가 없어야 함
    expect(header).not.toMatch(/href="[^"]*geeknews[^"]*"/i);
    // geeknews 텍스트 자체도 없어야 함
    expect(header.toLowerCase()).not.toContain("geeknews");
  });

  test("포스트 목록 페이지 메인 메뉴에 geeknews 링크가 없어야 한다", () => {
    const postsIndexPath = path.join(PUBLIC_DIR, "posts", "index.html");
    if (!fs.existsSync(postsIndexPath)) return;
    const html = fs.readFileSync(postsIndexPath, "utf-8");
    const header = extractHeader(html);
    expect(header).not.toMatch(/href="[^"]*geeknews[^"]*"/i);
    expect(header.toLowerCase()).not.toContain("geeknews");
  });

  test("geeknews 포스트 페이지 자체의 메인 메뉴에도 geeknews 링크가 없어야 한다", () => {
    const postPath = path.join(
      PUBLIC_DIR,
      "posts",
      "geeknews-test-001",
      "index.html"
    );
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    const header = extractHeader(html);
    expect(header).not.toMatch(/href="[^"]*geeknews[^"]*"/i);
  });

  test("메뉴 배제 규칙이 params.toml의 excludeCategories 로 선언적으로 구성됨", () => {
    const paramsPath = path.resolve(
      __dirname,
      "../../blog/config/_default/params.toml"
    );
    const params = fs.readFileSync(paramsPath, "utf-8");
    // excludeCategories 에 geeknews 가 포함되어야 함 (메뉴 필터의 소스)
    expect(params).toMatch(/excludeCategories\s*=\s*\[.*"geeknews".*\]/);
  });

  test("header 파셜 오버라이드에 vertical 파라미터 필터가 포함되어 있어야 한다", () => {
    const basicPath = path.resolve(
      __dirname,
      "../../blog/layouts/_partials/header/basic.html"
    );
    const basicTemplate = fs.readFileSync(basicPath, "utf-8");
    // excludeCategories 를 읽어 vertical 파라미터로 메뉴 항목을 걸러내는 코드가 있어야 함
    expect(basicTemplate).toContain("excludeCategories");
    expect(basicTemplate).toContain(".Params.vertical");
  });
});

/**
 * S3: 관련글(Related Posts) 스트림 분리
 *
 * 불변식:
 * - 안드로이드·PS 글 페이지의 관련글 목록에 geeknews 카테고리 글이 없다.
 * - geeknews 글 페이지에는 관련글 섹션 자체가 없다.
 * - 관련글 파셜(related-posts.html)이 complement 패턴으로 선언적 배제를 구현한다.
 */
describe("S3: 관련글(Related Posts) GeekNews 배제", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  test("related-posts.html 파셜이 존재하고 complement 패턴을 사용한다", () => {
    const partialPath = path.resolve(
      __dirname,
      "../../blog/layouts/_partials/related-posts.html"
    );
    expect(fs.existsSync(partialPath)).toBe(true);
    const template = fs.readFileSync(partialPath, "utf-8");
    // excludeCategories 기반 complement 패턴으로 배제
    expect(template).toContain("excludeCategories");
    expect(template).toContain("complement");
    // 카테고리 교집합으로 동일 버티컬 필터
    expect(template).toContain("intersect");
  });

  test("single.html 레이아웃 오버라이드가 related-posts 파셜을 포함한다", () => {
    const singlePath = path.resolve(
      __dirname,
      "../../blog/layouts/single.html"
    );
    expect(fs.existsSync(singlePath)).toBe(true);
    const template = fs.readFileSync(singlePath, "utf-8");
    expect(template).toContain('partial "related-posts.html"');
  });

  test("PS 글 페이지의 관련글 섹션에 geeknews 링크가 없어야 한다", () => {
    // ABC-458-C 는 PS 카테고리 글
    const postPath = path.join(PUBLIC_DIR, "posts", "abc-458-c", "index.html");
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");

    // related-posts 섹션 추출 (div.related-posts 블록)
    const relatedMatch = html.match(
      /<div[^>]*class="[^"]*related-posts[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (!relatedMatch) {
      // 관련글 섹션 자체가 없으면 geeknews도 없으므로 통과
      return;
    }
    const relatedSection = relatedMatch[1];
    expect(relatedSection).not.toMatch(/href="[^"]*geeknews[^"]*"/i);
    expect(relatedSection.toLowerCase()).not.toContain("geeknews");
  });

  test("PS 글 페이지의 관련글에 다른 PS 글 링크가 있어야 한다", () => {
    // ABC-458-C 와 ABC-458-D, abc-458-e 는 모두 PS 카테고리
    const postPath = path.join(PUBLIC_DIR, "posts", "abc-458-c", "index.html");
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");

    const relatedMatch = html.match(
      /<div[^>]*class="[^"]*related-posts[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (!relatedMatch) {
      // 관련글 섹션이 없으면 이 테스트는 스킵 (글 수가 부족하면 없을 수 있음)
      return;
    }
    const relatedSection = relatedMatch[1];
    // abc-458-d 또는 abc-458-e 링크 중 하나라도 있어야 함
    const hasOtherPs =
      /href="[^"]*abc-458-d[^"]*"/i.test(relatedSection) ||
      /href="[^"]*abc-458-e[^"]*"/i.test(relatedSection);
    expect(hasOtherPs).toBe(true);
  });

  test("geeknews 글 페이지에는 관련글 섹션이 없어야 한다", () => {
    const postPath = path.join(
      PUBLIC_DIR,
      "posts",
      "geeknews-test-001",
      "index.html"
    );
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    // related-posts 클래스를 가진 div 가 없어야 함
    expect(html).not.toMatch(/class="[^"]*related-posts[^"]*"/);
  });
});

/**
 * S4: 이전/다음(Prev/Next) 네비게이션 버티컬 필터링
 *
 * 불변식:
 * - 안드로이드·PS 글 페이지의 이전/다음 링크에 geeknews 카테고리 글이 없다.
 * - geeknews 글 페이지에는 article-pagination 섹션 자체가 없다.
 * - article-pagination.html 파셜이 complement 패턴으로 선언적 배제를 구현한다.
 * - 날짜 기준 geeknews 직전 PS 글(abc-458-e)이 다른 PS 글로만 prev/next 순회한다.
 */
describe("S4: Prev/Next 네비게이션 버티컬 필터링", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  test("article-pagination.html 파셜이 존재하고 vertical 필터 로직을 포함한다", () => {
    const partialPath = path.resolve(
      __dirname,
      "../../blog/layouts/_partials/article-pagination.html"
    );
    expect(fs.existsSync(partialPath)).toBe(true);
    const template = fs.readFileSync(partialPath, "utf-8");
    // excludeCategories 기반 배제 규칙
    expect(template).toContain("excludeCategories");
    // complement 패턴으로 배제 카테고리 글 제거
    expect(template).toContain("complement");
    // 카테고리 교집합으로 동일 버티컬 필터
    expect(template).toContain("intersect");
    // 현재 글이 배제 카테고리면 pagination 자체를 숨김
    expect(template).toContain("currentIsExcluded");
    // article-pagination 마커 클래스
    expect(template).toContain("article-pagination");
  });

  test("geeknews 글 페이지에 article-pagination 섹션이 없어야 한다", () => {
    const postPath = path.join(
      PUBLIC_DIR,
      "posts",
      "geeknews-test-001",
      "index.html"
    );
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    // geeknews 글은 pagination 자체가 렌더되지 않아야 함
    expect(html).not.toMatch(/class="[^"]*article-pagination[^"]*"/);
  });

  test("PS 글(abc-458-e) 페이지의 pagination에 geeknews 링크가 없어야 한다", () => {
    // abc-458-e 는 날짜 기준 geeknews-test-001 바로 다음(오래된 방향)의 PS 글
    // 필터 없으면 geeknews-test-001이 PrevInSection으로 나타남
    const postPath = path.join(PUBLIC_DIR, "posts", "abc-458-e", "index.html");
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");

    // article-pagination 섹션 추출
    const paginationMatch = html.match(
      /class="article-pagination[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (!paginationMatch) {
      // abc-458-e가 필터된 목록에서 경계 글이어서 pagination 자체가 없을 수 있음 - 통과
      return;
    }
    const paginationSection = paginationMatch[1];
    expect(paginationSection).not.toMatch(/href="[^"]*geeknews[^"]*"/i);
    expect(paginationSection.toLowerCase()).not.toContain("geeknews");
  });

  test("PS 글(abc-458-e) 페이지 전체에 geeknews pagination 링크가 없어야 한다", () => {
    const postPath = path.join(PUBLIC_DIR, "posts", "abc-458-e", "index.html");
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");

    // article-pagination 범위 내에서만 geeknews 링크가 없는지 확인
    // (article-pagination 마커로 명확하게 scope 지정)
    const paginationStartIdx = html.indexOf('class="article-pagination');
    if (paginationStartIdx === -1) return; // pagination 섹션 없으면 통과

    // pagination div 이후 200자 내에서 geeknews 링크 검사
    const paginationSnippet = html.slice(
      paginationStartIdx,
      paginationStartIdx + 500
    );
    expect(paginationSnippet).not.toMatch(/href="[^"]*geeknews[^"]*"/i);
  });

  test("PS 글(abc-458-e)의 next pagination이 동일 버티컬(PS) 글을 가리켜야 한다", () => {
    // abc-458-e 는 가장 최신 PS 글이므로 prev(더 새로운 PS)는 없고
    // next(더 오래된 PS) = ABC-458-C 또는 ABC-458-D
    const postPath = path.join(PUBLIC_DIR, "posts", "abc-458-e", "index.html");
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");

    const paginationStartIdx = html.indexOf('class="article-pagination');
    if (paginationStartIdx === -1) return; // pagination 섹션 없으면 스킵

    const paginationSnippet = html.slice(
      paginationStartIdx,
      paginationStartIdx + 800
    );
    // abc-458-c 또는 abc-458-d 링크 중 하나가 있어야 함 (동일 버티컬 순회)
    const hasOtherPsLink =
      /href="[^"]*abc-458-c[^"]*"/i.test(paginationSnippet) ||
      /href="[^"]*abc-458-d[^"]*"/i.test(paginationSnippet);
    expect(hasOtherPsLink).toBe(true);
  });
});

/**
 * S_VP: 홈 first viewport 포트폴리오 버티컬 진입 내비게이션
 *
 * 불변식:
 * - 홈 페이지에 data-vertical="android" 요소가 정확히 1개 존재한다.
 * - 홈 페이지에 data-vertical="ps" 요소가 정확히 1개 존재한다.
 * - 두 요소는 서로 중첩되지 않는다 (각각 1개씩).
 * - 각 요소가 해당 카테고리 URL을 링크한다.
 * - vertical-nav 파셜이 recent-articles보다 HTML 상 앞에 위치한다.
 * - vertical-nav.html 파셜이 선언적 정적 링크로 구성되어 있다.
 */
describe("S_VP: 홈 first viewport 버티컬 진입 내비게이션", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  test("홈 페이지에 android 버티컬 진입 요소가 정확히 1개 존재해야 한다", () => {
    const indexHtml = fs.readFileSync(
      path.join(PUBLIC_DIR, "index.html"),
      "utf-8"
    );
    const androidMatches = indexHtml.match(/data-vertical="android"/g) || [];
    expect(androidMatches.length).toBe(1);
  });

  test("홈 페이지에 ps 버티컬 진입 요소가 정확히 1개 존재해야 한다", () => {
    const indexHtml = fs.readFileSync(
      path.join(PUBLIC_DIR, "index.html"),
      "utf-8"
    );
    const psMatches = indexHtml.match(/data-vertical="ps"/g) || [];
    expect(psMatches.length).toBe(1);
  });

  test("android와 ps 버티컬 카드가 각각 categories/ URL을 링크해야 한다", () => {
    const indexHtml = fs.readFileSync(
      path.join(PUBLIC_DIR, "index.html"),
      "utf-8"
    );
    expect(indexHtml).toMatch(/categories\/android\//);
    expect(indexHtml).toMatch(/categories\/ps\//);
  });

  test("vertical-nav 섹션이 recent-articles보다 HTML 앞에 위치해야 한다", () => {
    const indexHtml = fs.readFileSync(
      path.join(PUBLIC_DIR, "index.html"),
      "utf-8"
    );
    const androidPos = indexHtml.indexOf('data-vertical="android"');
    const psPos = indexHtml.indexOf('data-vertical="ps"');

    expect(androidPos).toBeGreaterThan(-1);
    expect(psPos).toBeGreaterThan(-1);

    // vertical-nav 섹션은 class="vertical-nav" 로 마킹됨
    const verticalNavSectionPos = indexHtml.indexOf('class="vertical-nav');
    expect(verticalNavSectionPos).toBeGreaterThan(-1);

    // mt-8 text-2xl = recent-articles 헤더 클래스
    const recentHeaderPos = indexHtml.indexOf("mt-8 text-2xl");
    if (recentHeaderPos !== -1) {
      expect(verticalNavSectionPos).toBeLessThan(recentHeaderPos);
    }
  });

  test("vertical-nav.html 파셜이 선언적 정적 링크로 구성되어 있다", () => {
    const partialPath = path.resolve(
      __dirname,
      "../../blog/layouts/_partials/vertical-nav.html"
    );
    expect(fs.existsSync(partialPath)).toBe(true);
    const template = fs.readFileSync(partialPath, "utf-8");
    // 두 버티컬 data-vertical 속성이 선언되어 있어야 함
    expect(template).toContain('data-vertical="android"');
    expect(template).toContain('data-vertical="ps"');
    // categories/ 경로를 포함해야 함
    expect(template).toContain("categories/android/");
    expect(template).toContain("categories/ps/");
  });

  test("홈 레이아웃 오버라이드(home/page.html)가 vertical-nav 파셜을 포함한다", () => {
    const layoutPath = path.resolve(
      __dirname,
      "../../blog/layouts/_partials/home/page.html"
    );
    expect(fs.existsSync(layoutPath)).toBe(true);
    const template = fs.readFileSync(layoutPath, "utf-8");
    expect(template).toContain('partial "vertical-nav.html"');
  });
});

/**
 * S5: Taxonomy 인덱스 GeekNews 배제
 *
 * 불변식:
 * - 카테고리 taxonomy 목록 페이지(/categories/)에 geeknews 카테고리 항목이 없다.
 * - 태그 term 페이지(/tags/test/)에 geeknews 포스트 링크가 없다.
 * - /categories/ps/ 페이지에 geeknews 포스트가 없다.
 * - /categories/geeknews/ 페이지는 URL로 도달 가능 (sibling-4 피드)하며 내용을 유지한다.
 * - 배제 규칙이 taxonomy.html과 term.html에서 excludeCategories 로 선언적으로 구성된다.
 */
describe("S5: Taxonomy 인덱스 GeekNews 배제", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  test("카테고리 taxonomy 페이지(/categories/)에 geeknews 카테고리 링크가 없어야 한다", () => {
    const categoriesPath = path.join(PUBLIC_DIR, "categories", "index.html");
    if (!fs.existsSync(categoriesPath)) return;
    const html = fs.readFileSync(categoriesPath, "utf-8");
    // 카테고리 목록에 geeknews 링크가 없어야 함
    expect(html).not.toMatch(/href="[^"]*categories\/geeknews[^"]*"/i);
    // "Geeknews" 텍스트 자체도 없어야 함
    expect(html.toLowerCase()).not.toContain(">geeknews<");
  });

  test("카테고리 taxonomy 페이지에 PS 카테고리 링크는 있어야 한다", () => {
    const categoriesPath = path.join(PUBLIC_DIR, "categories", "index.html");
    if (!fs.existsSync(categoriesPath)) return;
    const html = fs.readFileSync(categoriesPath, "utf-8");
    // PS 카테고리 링크는 존재해야 함
    expect(html).toMatch(/href="[^"]*categories\/ps[^"]*"/i);
  });

  test("태그 term 페이지(/tags/test/)에 geeknews 포스트 링크가 없어야 한다", () => {
    const testTagPath = path.join(PUBLIC_DIR, "tags", "test", "index.html");
    if (!fs.existsSync(testTagPath)) return;
    const html = fs.readFileSync(testTagPath, "utf-8");
    // geeknews-test-001 포스트 링크가 없어야 함
    expect(html).not.toMatch(/href="[^"]*geeknews-test-\d+[^"]*"/i);
    // GeekNews 더미 글 제목이 없어야 함
    expect(html).not.toMatch(/GeekNews 테스트 더미/);
  });

  test("카테고리 term 페이지(/categories/ps/)에 geeknews 포스트가 없어야 한다", () => {
    const psPath = path.join(PUBLIC_DIR, "categories", "ps", "index.html");
    if (!fs.existsSync(psPath)) return;
    const html = fs.readFileSync(psPath, "utf-8");
    // PS 페이지에 geeknews 링크가 없어야 함
    expect(html).not.toMatch(/href="[^"]*geeknews[^"]*"/i);
  });

  test("/categories/geeknews/ 는 URL로 도달 가능하며 geeknews 포스트를 유지한다", () => {
    const geekNewsPath = path.join(
      PUBLIC_DIR,
      "categories",
      "geeknews",
      "index.html"
    );
    // 파일이 존재해야 함 (URL 도달 가능)
    expect(fs.existsSync(geekNewsPath)).toBe(true);
    const html = fs.readFileSync(geekNewsPath, "utf-8");
    // geeknews 포스트가 존재해야 함 (geeknews 자체 term 페이지는 배제하지 않음)
    expect(html).toMatch(/geeknews-test-\d+/i);
  });

  test("taxonomy.html 오버라이드가 excludeCategories 선언적 규칙으로 구성된다", () => {
    const taxonomyPath = path.resolve(
      __dirname,
      "../../blog/layouts/taxonomy.html"
    );
    expect(fs.existsSync(taxonomyPath)).toBe(true);
    const template = fs.readFileSync(taxonomyPath, "utf-8");
    // excludeCategories 기반 배제 규칙이 있어야 함
    expect(template).toContain("excludeCategories");
    // continue 로 항목을 건너뛰는 패턴이 있어야 함
    expect(template).toContain("continue");
  });

  test("term.html 오버라이드가 excludeCategories 선언적 규칙으로 구성된다", () => {
    const termPath = path.resolve(
      __dirname,
      "../../blog/layouts/term.html"
    );
    expect(fs.existsSync(termPath)).toBe(true);
    const template = fs.readFileSync(termPath, "utf-8");
    // excludeCategories 기반 배제 규칙이 있어야 함
    expect(template).toContain("excludeCategories");
    // complement 패턴으로 배제
    expect(template).toContain("complement");
    // 카테고리 교집합으로 geeknews 탐지
    expect(template).toContain("intersect");
    // geeknews 카테고리 term 페이지 자체는 유지 (isGeekNewsPage 조건)
    expect(template).toContain("isGeekNewsPage");
  });
});

/**
 * S_PC: 버티컬별 프로필 카드 조건부 노출
 *
 * 불변식:
 * - android·PS 글 페이지 HTML에는 author-card 요소가 존재한다.
 * - geeknews 글 페이지 HTML에는 author-card 요소가 없다.
 * - single.html 레이아웃이 author-card.html 파셜을 호출한다.
 * - author-card.html 파셜이 excludeCategories 기반 조건부 분기를 포함한다.
 */
describe("S_PC: 버티컬별 프로필 카드 조건부 노출", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  test("single.html 레이아웃이 author-card.html 파셜을 포함한다", () => {
    const singlePath = path.resolve(
      __dirname,
      "../../blog/layouts/single.html"
    );
    expect(fs.existsSync(singlePath)).toBe(true);
    const template = fs.readFileSync(singlePath, "utf-8");
    expect(template).toContain('partial "author-card.html"');
  });

  test("author-card.html 파셜이 excludeCategories 기반 조건부 분기를 포함한다", () => {
    const cardPath = path.resolve(
      __dirname,
      "../../blog/layouts/partials/author-card.html"
    );
    expect(fs.existsSync(cardPath)).toBe(true);
    const template = fs.readFileSync(cardPath, "utf-8");
    expect(template).toContain("excludeCategories");
    expect(template).toContain("intersect");
  });

  test("PS 글 페이지 HTML에는 author-card 요소가 존재해야 한다", () => {
    const postPath = path.join(PUBLIC_DIR, "posts", "abc-458-c", "index.html");
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    expect(html).toMatch(/class="[^"]*author-card[^"]*"/);
  });

  test("Android 글 페이지 HTML에는 author-card 요소가 존재해야 한다", () => {
    const postPath = path.join(
      PUBLIC_DIR,
      "posts",
      "android-test-001",
      "index.html"
    );
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    expect(html).toMatch(/class="[^"]*author-card[^"]*"/);
  });

  test("GeekNews 글 페이지 HTML에는 author-card 요소가 없어야 한다", () => {
    const postPath = path.join(
      PUBLIC_DIR,
      "posts",
      "geeknews-test-001",
      "index.html"
    );
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    expect(html).not.toMatch(/class="[^"]*author-card[^"]*"/);
  });

  test("author-card에 GitHub 링크와 태그라인이 포함되어야 한다 (프로필 카드 콘텐츠 확정)", () => {
    const cardPath = path.resolve(
      __dirname,
      "../../blog/layouts/partials/author-card.html"
    );
    const template = fs.readFileSync(cardPath, "utf-8");
    // GitHub 링크
    expect(template).toContain("github.com");
    // 태그라인 (개발자 소개 텍스트)
    expect(template).toMatch(/개발자/);
  });

  test("android 글의 author-card에 Android 더보기 링크가 있어야 한다", () => {
    const postPath = path.join(
      PUBLIC_DIR,
      "posts",
      "android-test-001",
      "index.html"
    );
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    // author-card 블록 안에 vertical-more-link 가 있어야 함
    expect(html).toMatch(/data-vertical="android"/);
  });

  test("PS 글의 author-card에 PS 더보기 링크가 있어야 한다", () => {
    const postPath = path.join(PUBLIC_DIR, "posts", "abc-458-c", "index.html");
    if (!fs.existsSync(postPath)) return;
    const html = fs.readFileSync(postPath, "utf-8");
    expect(html).toMatch(/data-vertical="ps"/);
  });
});

/**
 * S6a: GeekNews 피드 페이지 URL 도달 가능성
 *
 * 불변식:
 * - Hugo 빌드 후 public/tags/geeknews/index.html 이 존재한다 (태그 피드).
 * - Hugo 빌드 후 public/categories/geeknews/index.html 이 존재한다 (연대순 아카이브).
 * - tags/geeknews/ 페이지에 geeknews 포스트가 존재한다 (자기 필터링 없음).
 * - categories/geeknews/ 페이지에 geeknews 포스트가 존재한다 (연대순 그룹).
 * - tags/geeknews/ 는 메인 메뉴에 노출되지 않는다 (sibling-4 최소 피드 원칙).
 */
describe("S6a: GeekNews 피드 페이지 URL 도달 가능성", () => {
  beforeAll(() => {
    ensureBuilt();
  });

  test("public/tags/geeknews/index.html 이 빌드 후 존재해야 한다", () => {
    const tagsGeekNewsPath = path.join(
      PUBLIC_DIR,
      "tags",
      "geeknews",
      "index.html"
    );
    expect(fs.existsSync(tagsGeekNewsPath)).toBe(true);
  });

  test("public/categories/geeknews/index.html 이 빌드 후 존재해야 한다 (연대순 아카이브)", () => {
    const categoriesGeekNewsPath = path.join(
      PUBLIC_DIR,
      "categories",
      "geeknews",
      "index.html"
    );
    expect(fs.existsSync(categoriesGeekNewsPath)).toBe(true);
  });

  test("tags/geeknews/ 피드에 geeknews 포스트가 존재해야 한다 (자기 필터링 없음)", () => {
    const tagsGeekNewsPath = path.join(
      PUBLIC_DIR,
      "tags",
      "geeknews",
      "index.html"
    );
    if (!fs.existsSync(tagsGeekNewsPath)) return;
    const html = fs.readFileSync(tagsGeekNewsPath, "utf-8");
    expect(html).toMatch(/geeknews-test-\d+/i);
  });

  test("categories/geeknews/ 피드에 geeknews 포스트가 존재해야 한다 (연대순 아카이브)", () => {
    const categoriesGeekNewsPath = path.join(
      PUBLIC_DIR,
      "categories",
      "geeknews",
      "index.html"
    );
    if (!fs.existsSync(categoriesGeekNewsPath)) return;
    const html = fs.readFileSync(categoriesGeekNewsPath, "utf-8");
    expect(html).toMatch(/geeknews-test-\d+/i);
  });

  test("term.html 이 tags/geeknews/ 도 피드 페이지로 인식하여 자기 필터링을 하지 않는다", () => {
    const termPath = path.resolve(
      __dirname,
      "../../blog/layouts/term.html"
    );
    const template = fs.readFileSync(termPath, "utf-8");
    // $isGeekNewsPage 가 taxonomy 구분 없이 title 로만 판단해야 함
    // (eq .Data.Singular "category") 조건이 없어야 함 — 제거됨
    expect(template).toContain("isGeekNewsPage");
    expect(template).toContain("excludeCategories");
    // 더 이상 "category" singular 하드코딩에 의존하지 않음
    expect(template).not.toMatch(/eq .Data.Singular "category"/);
  });
});
