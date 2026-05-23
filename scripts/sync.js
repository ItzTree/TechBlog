const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

require("dotenv").config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

const CONTENT_DIR = path.join(__dirname, "..", "blog", "content", "posts");
const IMAGE_DIR = path.join(__dirname, "..", "blog", "static", "images");

async function getDataSourceId() {
  const db = await notion.databases.retrieve({
    database_id: process.env.NOTION_DATABASE_ID,
  });
  return db.data_sources[0].id;
}

async function queryAllPages(query, queryFn) {
  const exec = queryFn || ((q) => notion.dataSources.query(q));
  const results = [];
  let cursor;
  do {
    const params = cursor ? { ...query, start_cursor: cursor } : query;
    const res = await exec(params);
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return results;
}

async function getPublishedPages() {
  const dataSourceId = await getDataSourceId();
  return queryAllPages({
    data_source_id: dataSourceId,
    filter: {
      or: [
        { property: "상태", select: { equals: "발행" } },
        { property: "상태", select: { equals: "발행완료" } },
      ],
    },
    sorts: [{ property: "발행일", direction: "descending" }],
  });
}

function needsSync(page, contentDir = CONTENT_DIR) {
  const props = getPageProperties(page);
  const filePath = path.join(contentDir, `${props.slug}.md`);
  if (!fs.existsSync(filePath)) return true;
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/notion_last_edited:\s*"([^"]+)"/);
  if (!match) return true; // 레거시 파일(필드 없음) → 강제 재동기화
  const stored = new Date(match[1]);
  const pageEdited = new Date(page.last_edited_time);
  return pageEdited > stored;
}

function getPageProperties(page) {
  const props = page.properties;

  const title =
    props["제목"]?.title?.map((t) => t.plain_text).join("") || "Untitled";

  const date = props["발행일"]?.date?.start || page.created_time.split("T")[0];

  const tags =
    props["태그"]?.multi_select?.map((t) => t.name) || [];

  const category = props["카테고리"]?.select?.name || "";

  const slug =
    props["슬러그"]?.rich_text?.map((t) => t.plain_text).join("") ||
    title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-|-$/g, "");

  return { title, date, tags, category, slug };
}

function buildFrontMatter(props, hasMath, notionId, notionLastEdited) {
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
  if (hasMath) {
    lines.push("math: true");
  }
  if (notionId) {
    lines.push(`notion_id: "${notionId}"`);
  }
  if (notionLastEdited) {
    lines.push(`notion_last_edited: "${notionLastEdited}"`);
  }
  lines.push("draft: false");
  lines.push("---");
  return lines.join("\n");
}

function deleteOldSlugFiles(contentDir, notionId, currentSlug) {
  if (!fs.existsSync(contentDir)) return;
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    if (file === `${currentSlug}.md`) continue;
    const filePath = path.join(contentDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/notion_id:\s*"([^"]+)"/);
    if (match && match[1] === notionId) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old-slug file: ${file}`);
    }
  }
}

async function downloadImage(url, filename) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const filePath = path.join(IMAGE_DIR, filename);

  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, filename).then(resolve).catch(reject);
        return;
      }
      const stream = fs.createWriteStream(filePath);
      res.pipe(stream);
      stream.on("finish", () => {
        stream.close();
        resolve();
      });
    }).on("error", reject);
  });
}

function processImages(markdown, slug) {
  let imageIndex = 0;
  const downloads = [];
  const filenames = new Set();
  const newMarkdown = markdown.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (match, alt, url) => {
      const ext = path.extname(new URL(url).pathname) || ".png";
      const filename = `${slug}-${imageIndex++}${ext}`;
      filenames.add(filename);
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
  return { markdown: newMarkdown, downloads, filenames };
}

function pruneOldImages(imageDir, slug, keepFilenames) {
  if (!fs.existsSync(imageDir)) return;
  // 정확히 {slug}-{index}.{ext} 형태만 매칭 ({slug}-bar-0.png 같은 다른 글 파일 보호)
  const slugEscaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${slugEscaped}-\\d+\\.[A-Za-z0-9]+$`);
  for (const file of fs.readdirSync(imageDir)) {
    if (!pattern.test(file)) continue;
    if (keepFilenames.has(file)) continue;
    fs.unlinkSync(path.join(imageDir, file));
    console.log(`Pruned old image: ${file}`);
  }
}

function convertLineBreaks(markdown) {
  const lines = markdown.split("\n");
  const result = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) inCodeBlock = !inCodeBlock;

    if (inCodeBlock || !lines[i + 1]) {
      result.push(line);
      continue;
    }

    const nextLine = lines[i + 1];
    const isCurrentEmpty = line.trim() === "";
    const isNextEmpty = nextLine.trim() === "";
    const isNextSpecial = /^(#|[-*] |\d+\. |>|```|\$\$|\|)/.test(nextLine);

    if (!isCurrentEmpty && !isNextEmpty && !isNextSpecial) {
      result.push(line + "  ");
    } else {
      result.push(line);
    }
  }
  return result.join("\n");
}

function hasMathContent(markdown) {
  return /\$\$.+?\$\$/s.test(markdown) || /\$[^$\n]+?\$/g.test(markdown) ||
    /\\\[.+?\\\]/s.test(markdown) || /\\\(.+?\\\)/g.test(markdown);
}

async function syncPage(page) {
  const props = getPageProperties(page);
  const mdBlocks = await n2m.pageToMarkdown(page.id);
  const mdResult = n2m.toMarkdownString(mdBlocks);
  let markdown = typeof mdResult === "string" ? mdResult : mdResult.parent || "";

  const imageResult = processImages(markdown, props.slug);
  markdown = imageResult.markdown;
  await Promise.all(imageResult.downloads);
  pruneOldImages(IMAGE_DIR, props.slug, imageResult.filenames);
  markdown = convertLineBreaks(markdown);

  const math = hasMathContent(markdown);
  const frontMatter = buildFrontMatter(props, math, page.id, page.last_edited_time);
  const content = `${frontMatter}\n\n${markdown}`;

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const filePath = path.join(CONTENT_DIR, `${props.slug}.md`);
  fs.writeFileSync(filePath, content, "utf-8");
  deleteOldSlugFiles(CONTENT_DIR, page.id, props.slug);

  console.log(`Synced: ${props.title} -> ${props.slug}.md`);
  return page.id;
}

async function markAsCompleted(pageId) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "상태": { select: { name: "발행완료" } },
    },
  });
}

async function getDeletedPages() {
  try {
    const dataSourceId = await getDataSourceId();
    return await queryAllPages({
      data_source_id: dataSourceId,
      filter: {
        property: "상태",
        select: { equals: "삭제" },
      },
    });
  } catch (err) {
    console.warn(`Skipping deletion sync: ${err.message}`);
    return [];
  }
}

async function deletePage(page) {
  const props = getPageProperties(page);
  const filePath = path.join(CONTENT_DIR, `${props.slug}.md`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Deleted: ${props.slug}.md`);
  }

  const imageFiles = fs.existsSync(IMAGE_DIR)
    ? fs.readdirSync(IMAGE_DIR).filter((f) => f.startsWith(`${props.slug}-`))
    : [];
  for (const file of imageFiles) {
    fs.unlinkSync(path.join(IMAGE_DIR, file));
    console.log(`Deleted image: ${file}`);
  }
}

async function markAsDeleted(pageId) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "상태": { select: { name: "삭제완료" } },
    },
  });
}

async function processPagesIsolated(pages, processOne) {
  const failures = [];
  let processed = 0;
  for (const page of pages) {
    const id = page?.id || "unknown";
    const title =
      page?.properties?.["제목"]?.title?.map((t) => t.plain_text).join("") || "";
    try {
      const result = await processOne(page);
      if (result) processed++;
    } catch (err) {
      failures.push({ id, title, error: err.message });
      console.error(`Failed page ${id} (${title}): ${err.message}`);
    }
  }
  return { processed, failures };
}

async function main() {
  console.log("Fetching published pages from Notion...");
  const pages = await getPublishedPages();
  console.log(`Found ${pages.length} published/completed page(s).`);

  const { processed: synced, failures: syncFailures } = await processPagesIsolated(
    pages,
    async (page) => {
      const isNew = page.properties["상태"]?.select?.name === "발행";
      const isModified = !isNew && needsSync(page);
      if (!isNew && !isModified) return false;

      await syncPage(page);
      if (isNew) {
        await markAsCompleted(page.id);
        console.log(`  -> Status changed to "발행완료"`);
      } else {
        console.log(`  -> Re-synced (content modified)`);
      }
      return true;
    }
  );

  const deletedPages = await getDeletedPages();
  const { processed: deleted, failures: deleteFailures } = await processPagesIsolated(
    deletedPages,
    async (page) => {
      await deletePage(page);
      await markAsDeleted(page.id);
      console.log(`  -> Status changed to "삭제완료"`);
      return true;
    }
  );

  const allFailures = [...syncFailures, ...deleteFailures];
  console.log(`Sync complete. ${synced} synced, ${deleted} deleted.`);
  if (allFailures.length > 0) {
    console.error(`\n=== ${allFailures.length} failure(s) ===`);
    for (const f of allFailures) {
      console.error(`  - ${f.id} (${f.title}): ${f.error}`);
    }
    process.exitCode = 1;
  }
}

module.exports = {
  needsSync,
  getPageProperties,
  buildFrontMatter,
  processImages,
  syncPage,
  hasMathContent,
  convertLineBreaks,
  deleteOldSlugFiles,
  pruneOldImages,
  queryAllPages,
  processPagesIsolated,
};

if (require.main === module) {
  main().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
