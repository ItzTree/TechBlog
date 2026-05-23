const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
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
    expect(typeof sync.queryAllPages).toBe("function");
    expect(typeof sync.processPagesIsolated).toBe("function");
    expect(typeof sync.downloadImage).toBe("function");
  });
});

describe("downloadImage safety", () => {
  const { downloadImage } = sync;
  let imgDir;
  let servers;

  function startServer(handler) {
    return new Promise((resolve) => {
      const server = http.createServer(handler);
      server.listen(0, "127.0.0.1", () => {
        servers.push(server);
        resolve(server.address().port);
      });
    });
  }

  beforeEach(() => {
    imgDir = fs.mkdtempSync(path.join(os.tmpdir(), "dl-test-"));
    servers = [];
  });

  afterEach(async () => {
    await Promise.all(
      servers.map((s) => new Promise((r) => s.close(r)))
    );
    fs.rmSync(imgDir, { recursive: true, force: true });
  });

  test("rejects on connection refused (unreachable URL) — fast path", async () => {
    await expect(
      downloadImage("http://127.0.0.1:1/x.png", "x.png", { imageDir: imgDir, timeoutMs: 500 })
    ).rejects.toBeDefined();
  });

  test("rejects on timeout when server never responds", async () => {
    const port = await startServer(() => {
      // never write response
    });
    await expect(
      downloadImage(`http://127.0.0.1:${port}/x.png`, "x.png", {
        imageDir: imgDir,
        timeoutMs: 100,
      })
    ).rejects.toThrow(/Timeout/);
  });

  test("rejects when redirect chain exceeds redirectsLeft", async () => {
    const port = await startServer((req, res) => {
      res.writeHead(302, { location: `http://127.0.0.1:${port}/loop` });
      res.end();
    });
    await expect(
      downloadImage(`http://127.0.0.1:${port}/start`, "x.png", {
        imageDir: imgDir,
        redirectsLeft: 2,
        timeoutMs: 2000,
      })
    ).rejects.toThrow(/Too many redirects/);
  });

  test("follows redirects within limit and saves the final image", async () => {
    let port;
    port = await startServer((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { location: `http://127.0.0.1:${port}/final` });
        res.end();
        return;
      }
      const body = Buffer.from("PNGDATA");
      res.writeHead(200, { "content-length": body.length });
      res.end(body);
    });

    await downloadImage(`http://127.0.0.1:${port}/start`, "ok.png", {
      imageDir: imgDir,
      redirectsLeft: 3,
      timeoutMs: 2000,
    });
    const saved = fs.readFileSync(path.join(imgDir, "ok.png"));
    expect(saved.toString()).toBe("PNGDATA");
  });

  test("rejects when content-length exceeds maxBytes", async () => {
    const port = await startServer((req, res) => {
      res.writeHead(200, { "content-length": "999999" });
      res.end();
    });
    await expect(
      downloadImage(`http://127.0.0.1:${port}/big.png`, "big.png", {
        imageDir: imgDir,
        maxBytes: 100,
        timeoutMs: 2000,
      })
    ).rejects.toThrow(/too large/);
  });

  test("rejects mid-stream when received bytes exceed maxBytes (no content-length)", async () => {
    const port = await startServer((req, res) => {
      res.writeHead(200); // omit content-length
      res.write(Buffer.alloc(80));
      res.write(Buffer.alloc(80));
      res.end();
    });
    await expect(
      downloadImage(`http://127.0.0.1:${port}/stream.png`, "stream.png", {
        imageDir: imgDir,
        maxBytes: 100,
        timeoutMs: 2000,
      })
    ).rejects.toThrow(/exceeded/);
  });

  test("rejects on non-200/non-redirect HTTP status", async () => {
    const port = await startServer((req, res) => {
      res.writeHead(404);
      res.end();
    });
    await expect(
      downloadImage(`http://127.0.0.1:${port}/missing.png`, "missing.png", {
        imageDir: imgDir,
        timeoutMs: 2000,
      })
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe("processPagesIsolated error isolation", () => {
  const { processPagesIsolated } = sync;

  function makePage(id, titleText = "") {
    return {
      id,
      properties: { "제목": { title: [{ plain_text: titleText }] } },
    };
  }

  let consoleErrorSpy;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("a failure in one page does not stop later pages", async () => {
    const pages = [makePage("p1"), makePage("p2"), makePage("p3")];
    const calls = [];
    const processOne = jest.fn(async (page) => {
      calls.push(page.id);
      if (page.id === "p2") throw new Error("boom");
      return true;
    });

    const { processed, failures } = await processPagesIsolated(pages, processOne);

    expect(calls).toEqual(["p1", "p2", "p3"]);
    expect(processed).toBe(2);
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("p2");
    expect(failures[0].error).toBe("boom");
  });

  test("falsy return is treated as skipped (not counted, not failed)", async () => {
    const pages = [makePage("p1"), makePage("p2")];
    const processOne = jest.fn(async (page) => {
      if (page.id === "p1") return false;
      return true;
    });

    const { processed, failures } = await processPagesIsolated(pages, processOne);

    expect(processed).toBe(1);
    expect(failures).toHaveLength(0);
  });

  test("collects title from page properties for failure log", async () => {
    const pages = [makePage("p1", "Hello World")];
    const processOne = async () => { throw new Error("nope"); };

    const { failures } = await processPagesIsolated(pages, processOne);

    expect(failures[0].title).toBe("Hello World");
    expect(failures[0].id).toBe("p1");
  });

  test("returns empty failures when all pages succeed", async () => {
    const pages = [makePage("p1"), makePage("p2")];
    const processOne = async () => true;
    const { processed, failures } = await processPagesIsolated(pages, processOne);
    expect(processed).toBe(2);
    expect(failures).toEqual([]);
  });

  test("handles empty pages array", async () => {
    const { processed, failures } = await processPagesIsolated([], async () => true);
    expect(processed).toBe(0);
    expect(failures).toEqual([]);
  });
});

describe("queryAllPages pagination", () => {
  const { queryAllPages } = sync;

  test("returns first page when has_more is false", async () => {
    const queryFn = jest.fn().mockResolvedValue({
      has_more: false,
      results: [{ id: "p1" }, { id: "p2" }],
    });
    const result = await queryAllPages({ data_source_id: "ds" }, queryFn);
    expect(result).toEqual([{ id: "p1" }, { id: "p2" }]);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  test("follows next_cursor across multiple pages and concatenates", async () => {
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce({
        has_more: true,
        next_cursor: "c1",
        results: [{ id: "p1" }, { id: "p2" }],
      })
      .mockResolvedValueOnce({
        has_more: true,
        next_cursor: "c2",
        results: [{ id: "p3" }],
      })
      .mockResolvedValueOnce({
        has_more: false,
        results: [{ id: "p4" }],
      });
    const result = await queryAllPages({ data_source_id: "ds", filter: {} }, queryFn);
    expect(result.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  test("first call has no start_cursor; subsequent calls pass it", async () => {
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce({ has_more: true, next_cursor: "c1", results: [] })
      .mockResolvedValueOnce({ has_more: false, results: [] });
    await queryAllPages({ data_source_id: "ds", filter: { foo: "bar" } }, queryFn);
    expect(queryFn.mock.calls[0][0]).not.toHaveProperty("start_cursor");
    expect(queryFn.mock.calls[0][0].filter).toEqual({ foo: "bar" });
    expect(queryFn.mock.calls[1][0].start_cursor).toBe("c1");
    expect(queryFn.mock.calls[1][0].filter).toEqual({ foo: "bar" });
  });

  test("returns empty array when first page has no results and not more", async () => {
    const queryFn = jest.fn().mockResolvedValue({ has_more: false, results: [] });
    const result = await queryAllPages({ data_source_id: "ds" }, queryFn);
    expect(result).toEqual([]);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  test("propagates errors from queryFn", async () => {
    const queryFn = jest.fn().mockRejectedValue(new Error("notion down"));
    await expect(queryAllPages({}, queryFn)).rejects.toThrow("notion down");
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

describe("processImages returns filenames set", () => {
  const { processImages } = sync;

  test("filenames Set contains all generated filenames", () => {
    const md = "![](https://example.invalid/a.png)\n\n![](https://example.invalid/b.jpg)";
    const result = processImages(md, "post");
    result.downloads.forEach((p) => p.catch(() => {}));
    expect(result.filenames).toBeInstanceOf(Set);
    expect(result.filenames.has("post-0.png")).toBe(true);
    expect(result.filenames.has("post-1.jpg")).toBe(true);
    expect(result.filenames.size).toBe(2);
  });

  test("empty Set when no images", () => {
    const result = processImages("no images here", "post");
    expect(result.filenames.size).toBe(0);
  });
});

describe("pruneOldImages", () => {
  const { pruneOldImages } = sync;
  let imgDir;
  beforeEach(() => {
    imgDir = fs.mkdtempSync(path.join(os.tmpdir(), "img-test-"));
  });
  afterEach(() => {
    fs.rmSync(imgDir, { recursive: true, force: true });
  });

  test("removes images with slug prefix not in keep set", () => {
    fs.writeFileSync(path.join(imgDir, "foo-0.png"), "a");
    fs.writeFileSync(path.join(imgDir, "foo-1.png"), "b");
    fs.writeFileSync(path.join(imgDir, "foo-2.png"), "c");

    pruneOldImages(imgDir, "foo", new Set(["foo-0.png", "foo-1.png"]));

    expect(fs.existsSync(path.join(imgDir, "foo-0.png"))).toBe(true);
    expect(fs.existsSync(path.join(imgDir, "foo-1.png"))).toBe(true);
    expect(fs.existsSync(path.join(imgDir, "foo-2.png"))).toBe(false);
  });

  test("does not touch images of other slugs", () => {
    fs.writeFileSync(path.join(imgDir, "foo-0.png"), "a");
    fs.writeFileSync(path.join(imgDir, "bar-0.png"), "b");

    pruneOldImages(imgDir, "foo", new Set());

    expect(fs.existsSync(path.join(imgDir, "bar-0.png"))).toBe(true);
    expect(fs.existsSync(path.join(imgDir, "foo-0.png"))).toBe(false);
  });

  test("does not match similarly-named slug prefix (foo vs foo-bar)", () => {
    fs.writeFileSync(path.join(imgDir, "foo-bar-0.png"), "a");
    fs.writeFileSync(path.join(imgDir, "foo-0.png"), "b");

    pruneOldImages(imgDir, "foo-bar", new Set());

    // foo-bar-0.png는 삭제, foo-0.png는 (다른 슬러그) 그대로
    expect(fs.existsSync(path.join(imgDir, "foo-bar-0.png"))).toBe(false);
    expect(fs.existsSync(path.join(imgDir, "foo-0.png"))).toBe(true);
  });

  test("does not delete another post's image when slug is a prefix (foo deleting foo-bar-0)", () => {
    // 슬러그 "foo" 동기화 시, 다른 글 "foo-bar"의 이미지 "foo-bar-0.png"는 건드리면 안 됨
    fs.writeFileSync(path.join(imgDir, "foo-0.png"), "a");
    fs.writeFileSync(path.join(imgDir, "foo-bar-0.png"), "b");

    pruneOldImages(imgDir, "foo", new Set(["foo-0.png"]));

    expect(fs.existsSync(path.join(imgDir, "foo-0.png"))).toBe(true);
    expect(fs.existsSync(path.join(imgDir, "foo-bar-0.png"))).toBe(true);
  });

  test("noop when image directory does not exist", () => {
    const fake = path.join(imgDir, "missing");
    expect(() => pruneOldImages(fake, "foo", new Set())).not.toThrow();
  });
});

describe("needsSync via notion_last_edited", () => {
  const { needsSync } = sync;
  let dir;

  function makePage(slug, lastEdited) {
    return {
      properties: {
        "제목": { title: [{ plain_text: slug }] },
        "슬러그": { rich_text: [{ plain_text: slug }] },
      },
      last_edited_time: lastEdited,
      created_time: "2026-05-01T00:00:00.000Z",
    };
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-test-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("returns true when file does not exist", () => {
    expect(needsSync(makePage("x", "2026-05-01T00:00:00.000Z"), dir)).toBe(true);
  });

  test("returns true when notion last_edited > stored notion_last_edited", () => {
    fs.writeFileSync(
      path.join(dir, "x.md"),
      '---\nnotion_last_edited: "2026-05-01T00:00:00.000Z"\nslug: "x"\n---\nbody'
    );
    expect(needsSync(makePage("x", "2026-05-02T00:00:00.000Z"), dir)).toBe(true);
  });

  test("returns false when timestamps equal", () => {
    fs.writeFileSync(
      path.join(dir, "x.md"),
      '---\nnotion_last_edited: "2026-05-02T00:00:00.000Z"\nslug: "x"\n---\nbody'
    );
    expect(needsSync(makePage("x", "2026-05-02T00:00:00.000Z"), dir)).toBe(false);
  });

  test("returns false when notion last_edited < stored", () => {
    fs.writeFileSync(
      path.join(dir, "x.md"),
      '---\nnotion_last_edited: "2026-05-10T00:00:00.000Z"\nslug: "x"\n---\nbody'
    );
    expect(needsSync(makePage("x", "2026-05-02T00:00:00.000Z"), dir)).toBe(false);
  });

  test("returns true when legacy file has no notion_last_edited (force re-sync)", () => {
    fs.writeFileSync(
      path.join(dir, "x.md"),
      '---\ntitle: "x"\nslug: "x"\n---\nbody'
    );
    expect(needsSync(makePage("x", "2026-05-02T00:00:00.000Z"), dir)).toBe(true);
  });

  test("is independent of file mtime (CI checkout simulation)", () => {
    fs.writeFileSync(
      path.join(dir, "x.md"),
      '---\nnotion_last_edited: "2026-05-02T00:00:00.000Z"\nslug: "x"\n---\nbody'
    );
    // mtime을 미래로 강제 → 옛 mtime-비교는 false였겠지만 notion_last_edited 비교는 영향 없음
    const future = new Date("2099-01-01T00:00:00.000Z");
    fs.utimesSync(path.join(dir, "x.md"), future, future);
    // 노션 last_edited가 stored와 같으면 sync 불필요
    expect(needsSync(makePage("x", "2026-05-02T00:00:00.000Z"), dir)).toBe(false);
    // 노션 last_edited가 더 새로우면 sync 필요 (mtime이 미래여도)
    expect(needsSync(makePage("x", "2026-05-03T00:00:00.000Z"), dir)).toBe(true);
  });
});
