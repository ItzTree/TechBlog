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

async function getPublishedPages() {
  const dataSourceId = await getDataSourceId();
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      or: [
        { property: "상태", select: { equals: "발행" } },
        { property: "상태", select: { equals: "발행완료" } },
      ],
    },
    sorts: [{ property: "발행일", direction: "descending" }],
  });
  return response.results;
}

function needsSync(page) {
  const props = getPageProperties(page);
  const filePath = path.join(CONTENT_DIR, `${props.slug}.md`);
  if (!fs.existsSync(filePath)) return true;
  const fileMtime = fs.statSync(filePath).mtime;
  const pageEdited = new Date(page.last_edited_time);
  return pageEdited > fileMtime;
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

function buildFrontMatter(props, hasMath) {
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
  lines.push("draft: false");
  lines.push("---");
  return lines.join("\n");
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
  return markdown.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (match, alt, url) => {
      const ext = path.extname(new URL(url).pathname) || ".png";
      const filename = `${slug}-${imageIndex++}${ext}`;
      downloadImage(url, filename).catch((err) =>
        console.error(`Failed to download image: ${url}`, err.message)
      );
      const basePath = process.env.BASE_PATH || "/TechBlog";
      return `![${alt}](${basePath}/images/${filename})`;
    }
  );
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

  markdown = processImages(markdown, props.slug);
  markdown = convertLineBreaks(markdown);

  const math = hasMathContent(markdown);
  const frontMatter = buildFrontMatter(props, math);
  const content = `${frontMatter}\n\n${markdown}`;

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const filePath = path.join(CONTENT_DIR, `${props.slug}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

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
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: "상태",
        select: { equals: "삭제" },
      },
    });
    return response.results;
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

async function main() {
  console.log("Fetching published pages from Notion...");
  const pages = await getPublishedPages();
  console.log(`Found ${pages.length} published/completed page(s).`);

  let synced = 0;
  for (const page of pages) {
    const isNew = page.properties["상태"]?.select?.name === "발행";
    const isModified = !isNew && needsSync(page);

    if (!isNew && !isModified) continue;

    await syncPage(page);
    if (isNew) {
      await markAsCompleted(page.id);
      console.log(`  -> Status changed to "발행완료"`);
    } else {
      console.log(`  -> Re-synced (content modified)`);
    }
    synced++;
  }

  const deletedPages = await getDeletedPages();
  let deleted = 0;
  for (const page of deletedPages) {
    await deletePage(page);
    await markAsDeleted(page.id);
    console.log(`  -> Status changed to "삭제완료"`);
    deleted++;
  }

  console.log(`Sync complete. ${synced} synced, ${deleted} deleted.`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
