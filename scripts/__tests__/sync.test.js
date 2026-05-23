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
