const fs = require("fs");
const os = require("os");
const path = require("path");
const sync = require("../sync");

describe("sync module exports", () => {
  test("exports expected functions", () => {
    expect(typeof sync.needsSync).toBe("function");
    expect(typeof sync.getPageProperties).toBe("function");
    expect(typeof sync.buildFrontMatter).toBe("function");
    expect(typeof sync.processImages).toBe("function");
    expect(typeof sync.syncPage).toBe("function");
    expect(typeof sync.hasMathContent).toBe("function");
    expect(typeof sync.convertLineBreaks).toBe("function");
  });
});

describe("processImages", () => {
  const { processImages } = sync;

  test("returns object with markdown and downloads array", () => {
    const md = "![alt](https://example.invalid/img.png)";
    const result = processImages(md, "test-slug");

    expect(result).toHaveProperty("markdown");
    expect(result).toHaveProperty("downloads");
    expect(Array.isArray(result.downloads)).toBe(true);
    expect(result.downloads.length).toBe(1);
    expect(result.downloads[0]).toBeInstanceOf(Promise);
    // 다운로드 reject로 인한 unhandled rejection 방지
    result.downloads[0].catch(() => {});
  });

  test("markdown contains rewritten local path with BASE_PATH", () => {
    const original = process.env.BASE_PATH;
    process.env.BASE_PATH = "/TechBlog";
    const md = "![alt](https://example.invalid/img.png)";
    const result = processImages(md, "test-slug");
    expect(result.markdown).toBe("![alt](/TechBlog/images/test-slug-0.png)");
    result.downloads[0].catch(() => {});
    process.env.BASE_PATH = original;
  });

  test("returns no downloads when markdown has no images", () => {
    const result = processImages("# heading\n\nplain text", "test-slug");
    expect(result.downloads.length).toBe(0);
    expect(result.markdown).toBe("# heading\n\nplain text");
  });

  test("download promise rejects on unreachable URL (errors propagate)", async () => {
    const md = "![](http://127.0.0.1:1/x.png)";
    const result = processImages(md, "err-slug");
    await expect(result.downloads[0]).rejects.toBeDefined();
  });
});

describe("buildFrontMatter includes notion metadata", () => {
  const { buildFrontMatter } = sync;

  test("includes notion_id when provided", () => {
    const fm = buildFrontMatter(
      { title: "x", date: "2026-01-01", tags: [], category: "", slug: "new" },
      false,
      "page-abc-123",
      "2026-01-02T03:04:05.000Z"
    );
    expect(fm).toMatch(/notion_id: "page-abc-123"/);
  });

  test("includes notion_last_edited when provided", () => {
    const fm = buildFrontMatter(
      { title: "x", date: "2026-01-01", tags: [], category: "", slug: "s" },
      false,
      "id",
      "2026-01-02T03:04:05.000Z"
    );
    expect(fm).toMatch(/notion_last_edited: "2026-01-02T03:04:05.000Z"/);
  });

  test("escapes quotes in title", () => {
    const fm = buildFrontMatter(
      { title: 'a "quoted" b', date: "2026-01-01", tags: [], category: "", slug: "s" },
      false,
      "id",
      "t"
    );
    expect(fm).toMatch(/title: "a \\"quoted\\" b"/);
  });
});

describe("deleteOldSlugFiles", () => {
  const { deleteOldSlugFiles } = sync;
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "slug-test-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("removes file with same notion_id but different slug", () => {
    const oldFile = path.join(dir, "old-slug.md");
    const newFile = path.join(dir, "new-slug.md");
    fs.writeFileSync(oldFile, '---\nnotion_id: "abc-123"\nslug: "old-slug"\n---\n');
    fs.writeFileSync(newFile, '---\nnotion_id: "abc-123"\nslug: "new-slug"\n---\n');

    deleteOldSlugFiles(dir, "abc-123", "new-slug");

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });

  test("does not touch files with different notion_id", () => {
    const otherFile = path.join(dir, "other.md");
    fs.writeFileSync(otherFile, '---\nnotion_id: "different-id"\nslug: "other"\n---\n');

    deleteOldSlugFiles(dir, "abc-123", "new-slug");

    expect(fs.existsSync(otherFile)).toBe(true);
  });

  test("noop when directory does not exist", () => {
    const fakeDir = path.join(dir, "does-not-exist");
    expect(() => deleteOldSlugFiles(fakeDir, "abc", "new")).not.toThrow();
  });

  test("does not delete the current slug file itself", () => {
    const currentFile = path.join(dir, "new-slug.md");
    fs.writeFileSync(currentFile, '---\nnotion_id: "abc-123"\nslug: "new-slug"\n---\n');

    deleteOldSlugFiles(dir, "abc-123", "new-slug");

    expect(fs.existsSync(currentFile)).toBe(true);
  });

  test("ignores files without notion_id front matter (legacy)", () => {
    const legacyFile = path.join(dir, "legacy.md");
    fs.writeFileSync(legacyFile, '---\nslug: "legacy"\n---\n');

    deleteOldSlugFiles(dir, "abc-123", "new-slug");

    expect(fs.existsSync(legacyFile)).toBe(true);
  });
});
