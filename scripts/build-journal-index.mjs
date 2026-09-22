#!/usr/bin/env node
/**
 * Journal build step. Does two things from the markdown files in
 * journal/_posts/:
 *
 *   1. Writes journal/posts-index.json — the listing page (journal/index.html)
 *      fetches this at runtime to render the featured/pinned/grid/search/filter UI.
 *
 *   2. Generates a static journal/<slug>/index.html for every post, from the
 *      journal/_template/post.html template, with title/description/canonical/
 *      OG tags/JSON-LD, cover image, repost card, gallery, video embed, series
 *      box, changelog, and related/prev-next posts all baked in at build time
 *      (so they're real HTML, not something a crawler has to run JS to see).
 *      Only the markdown *body* is rendered client-side (by journal-post.js +
 *      marked.js) — everything else on the page is static.
 *
 * This script has zero npm dependencies (see scripts/micro-yaml.mjs) so it
 * runs anywhere Node runs, including GitHub Actions with no extra install step.
 *
 * Usage: node scripts/build-journal-index.mjs
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontMatterYaml } from "./micro-yaml.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const POSTS_DIR = join(ROOT, "journal", "_posts");
const JOURNAL_DIR = join(ROOT, "journal");
const TEMPLATE_FILE = join(ROOT, "journal", "_template", "post.html");
const OUT_INDEX = join(ROOT, "journal", "posts-index.json");
const SITE_URL = "https://abolfazlnaeimi.github.io/folio";
const DEFAULT_OG_IMAGE = SITE_URL + "/assets/img/journal-og-default.jpg";

const WORDS_PER_MINUTE = 180;
const RELATED_COUNT = 3;

function slugFromFilename(filename) {
  const base = filename.replace(/\.md$/, "");
  const m = base.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return m ? m[1] : base;
}

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = parseFrontMatterYaml(match[1]) || {};
  const body = match[2] || "";
  return { data, body };
}

function stripMarkdownToPlainText(body) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/:::\w+/g, " ")
    .replace(/[#>*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateReadingTime(body) {
  const plain = stripMarkdownToPlainText(body);
  const words = plain.length ? plain.split(/\s+/).filter(Boolean).length : 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function excerptFromBody(body, len = 160) {
  const plain = stripMarkdownToPlainText(body);
  if (plain.length <= len) return plain;
  return plain.slice(0, len).replace(/\s+\S*$/, "") + "…";
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function absoluteUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return SITE_URL + (path.startsWith("/") ? path : "/" + path);
}

function toRelativeFromRoot(absOrSitePath) {
  // turns an absolute site URL or root-relative path into a path relative
  // to journal/<slug>/index.html (two levels deep)
  const p = absOrSitePath.startsWith(SITE_URL)
    ? absOrSitePath.slice(SITE_URL.length)
    : absOrSitePath;
  return "../.." + (p.startsWith("/") ? p : "/" + p);
}

function formatDateFa(iso) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR-u-nu-latn", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch (e) {
    return iso;
  }
}

function readAllPosts() {
  let files = [];
  try {
    files = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  } catch (e) {
    console.error("No journal/_posts directory found:", e.message);
    process.exit(1);
  }

  const posts = [];
  for (const filename of files) {
    const raw = readFileSync(join(POSTS_DIR, filename), "utf8");
    const { data, body } = parseFrontMatter(raw);

    if (!data.title || !data.date) {
      console.warn(`Skipping ${filename}: missing required "title" or "date".`);
      continue;
    }

    const slug = data.slug || slugFromFilename(filename);
    posts.push({
      slug,
      file: filename,
      title: data.title,
      subtitle: data.subtitle || "",
      excerpt: data.subtitle || excerptFromBody(body),
      date: String(data.date),
      updated: data.updated ? String(data.updated) : null,
      category: data.category || null,
      tags: data.tags || [],
      cover: data.cover || null,
      socialImage: data.social_image || null,
      featured: !!data.featured,
      pinned: !!data.pinned,
      series: data.series || null,
      seriesOrder: data.series_order ?? null,
      repost: data.repost || null,
      gallery: data.gallery || [],
      video: data.video || null,
      changelog: data.changelog || [],
      readingTime: estimateReadingTime(body),
    });
  }

  posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.date) - new Date(a.date);
  });

  return posts;
}

function writeIndex(posts) {
  const categorySet = new Set();
  const tagSet = new Set();
  posts.forEach((p) => {
    if (p.category) categorySet.add(p.category);
    p.tags.forEach((t) => tagSet.add(t));
  });

  const slim = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    date: p.date,
    category: p.category,
    tags: p.tags,
    cover: p.cover,
    featured: p.featured,
    pinned: p.pinned,
    series: p.series,
    readingTime: p.readingTime,
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    count: slim.length,
    categories: Array.from(categorySet).sort(),
    tags: Array.from(tagSet).sort(),
    posts: slim,
  };

  writeFileSync(OUT_INDEX, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${slim.length} post(s) to journal/posts-index.json`);
}

function findRelated(post, allPosts) {
  const scored = allPosts
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      let score = 0;
      if (p.category && p.category === post.category) score += 2;
      score += p.tags.filter((t) => post.tags.includes(t)).length;
      return { post: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.post.date) - new Date(a.post.date));
  return scored.slice(0, RELATED_COUNT).map((x) => x.post);
}

function findPrevNext(post, allPosts) {
  const chrono = [...allPosts].sort((a, b) => new Date(a.date) - new Date(b.date));
  const i = chrono.findIndex((p) => p.slug === post.slug);
  return {
    prev: i > 0 ? chrono[i - 1] : null,
    next: i >= 0 && i < chrono.length - 1 ? chrono[i + 1] : null,
  };
}

function findSeries(post, allPosts) {
  if (!post.series) return [];
  return allPosts
    .filter((p) => p.series === post.series)
    .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
}

function metaTopHtml(post) {
  const parts = [];
  if (post.category) parts.push(`<span>${escapeHtml(post.category)}</span>`);
  parts.push(`<span>${formatDateFa(post.date)}</span>`);
  if (post.updated) parts.push(`<span>بروزرسانی: ${formatDateFa(post.updated)}</span>`);
  parts.push(`<span>${post.readingTime} دقیقه مطالعه</span>`);
  return parts.join("");
}

function coverHtml(post) {
  if (!post.cover) return "";
  const rel = escapeHtml(toRelativeFromRoot(absoluteUrl(post.cover)));
  return `<div class="post-cover reveal"><img src="${rel}" alt="${escapeHtml(post.title)}" loading="eager"></div>`;
}

function repostHtml(post) {
  if (!post.repost || !post.repost.url) return "";
  const source = escapeHtml(post.repost.source || "منبع اصلی");
  const url = escapeHtml(post.repost.url);
  return `<div class="repost-card reveal">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
    <span>ابتدا در ${source} منتشر شده — <a href="${url}" target="_blank" rel="noopener">مشاهده‌ی نسخه‌ی اصلی ↗</a></span>
  </div>`;
}

function galleryHtml(post) {
  if (!post.gallery || !post.gallery.length) return "";
  const imgs = post.gallery
    .map((src) => {
      const rel = escapeHtml(toRelativeFromRoot(absoluteUrl(src)));
      return `<button type="button" data-lightbox-src="${rel}"><img src="${rel}" alt="${escapeHtml(post.title)}" loading="lazy"></button>`;
    })
    .join("");
  return `<div class="post-gallery reveal" style="max-width:70ch;margin:32px auto 0">${imgs}</div>`;
}

function videoHtml(post) {
  if (!post.video) return "";
  if (post.video.youtube) {
    return `<div class="post-video reveal" style="max-width:70ch;margin:32px auto 0">
      <iframe src="https://www.youtube.com/embed/${escapeHtml(post.video.youtube)}" title="${escapeHtml(post.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
    </div>`;
  }
  if (post.video.mp4) {
    const rel = escapeHtml(toRelativeFromRoot(absoluteUrl(post.video.mp4)));
    return `<div class="post-video reveal" style="max-width:70ch;margin:32px auto 0"><video src="${rel}" controls preload="metadata"></video></div>`;
  }
  return "";
}

function changelogHtml(post) {
  if (!post.changelog || !post.changelog.length) return "";
  const items = post.changelog
    .map((c) => `<li class="changelog-item"><span class="cl-version">${escapeHtml(c.version)}</span> — ${escapeHtml(c.note)}</li>`)
    .join("");
  return `<div class="reveal" style="max-width:70ch;margin:40px auto 0">
    <h3 style="font-size:.8rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--ink-text-mute);margin-bottom:14px">Changelog</h3>
    <ul class="changelog-list">${items}</ul>
  </div>`;
}

function seriesHtml(post, allPosts) {
  const series = findSeries(post, allPosts);
  if (series.length < 2) return "";
  const items = series
    .map((p) => {
      const cls = p.slug === post.slug ? ' class="is-current"' : "";
      const inner = p.slug === post.slug
        ? escapeHtml(p.title)
        : `<a href="../${escapeHtml(p.slug)}/">${escapeHtml(p.title)}</a>`;
      return `<li${cls}>${inner}</li>`;
    })
    .join("");
  return `<div class="series-box reveal">
    <div class="sb-label">Series</div>
    <div class="sb-title">${escapeHtml(post.series)}</div>
    <ol>${items}</ol>
  </div>`;
}

function prevNextHtml(post, allPosts) {
  const { prev, next } = findPrevNext(post, allPosts);
  if (!prev && !next) return "";
  const prevHtml = prev
    ? `<a href="../${escapeHtml(prev.slug)}/"><div class="pnl-label">نوشته‌ی قبلی</div><div class="pnl-title">${escapeHtml(prev.title)}</div></a>`
    : "<span></span>";
  const nextHtml = next
    ? `<a class="pnl-next" href="../${escapeHtml(next.slug)}/"><div class="pnl-label">نوشته‌ی بعدی</div><div class="pnl-title">${escapeHtml(next.title)}</div></a>`
    : "<span></span>";
  return `<div class="post-nav-links reveal">${prevHtml}${nextHtml}</div>`;
}

function relatedHtml(post, allPosts) {
  const related = findRelated(post, allPosts);
  if (!related.length) return "";
  const cards = related
    .map((p) => {
      const cover = p.cover
        ? `<div class="jc-media"><img src="${escapeHtml(toRelativeFromRoot(absoluteUrl(p.cover)))}" alt="${escapeHtml(p.title)}" loading="lazy"></div>`
        : "";
      return `<a class="jcard" href="../${escapeHtml(p.slug)}/">${cover}<div class="jc-body">
        <div class="jc-meta">${p.category ? `<span class="jc-cat">${escapeHtml(p.category)}</span>` : ""}<span>${formatDateFa(p.date)}</span></div>
        <h3>${escapeHtml(p.title)}</h3>
      </div></a>`;
    })
    .join("");
  return `<div class="related-posts reveal"><h3>نوشته‌های مرتبط</h3><div class="related-grid">${cards}</div></div>`;
}

function resolveOgImage(post) {
  // 1. dedicated social image  2. cover image  3. default Journal card
  return absoluteUrl(post.socialImage) || absoluteUrl(post.cover) || DEFAULT_OG_IMAGE;
}

function jsonLd(post) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: { "@type": "Person", name: "Abolfazl Naeimi", url: SITE_URL + "/" },
    publisher: {
      "@type": "Person",
      name: "Abolfazl Naeimi",
      url: SITE_URL + "/",
      logo: { "@type": "ImageObject", url: SITE_URL + "/assets/img/journal-icon-192.png" },
    },
    image: resolveOgImage(post),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/journal/${post.slug}/` },
    url: `${SITE_URL}/journal/${post.slug}/`,
  };
  if (post.category) ld.articleSection = post.category;
  if (post.tags && post.tags.length) ld.keywords = post.tags.join(", ");
  return JSON.stringify(ld, null, 2);
}

function generatePostPage(post, allPosts, template) {
  const canonical = `${SITE_URL}/journal/${post.slug}/`;
  const ogImage = resolveOgImage(post);
  const description = (post.excerpt || post.title).slice(0, 300);

  let html = template;
  html = html.split("__TITLE__").join(escapeHtml(post.title));
  html = html.split("__DESCRIPTION__").join(escapeHtml(description));
  html = html.split("__CANONICAL__").join(canonical);
  html = html.split("__OG_IMAGE__").join(ogImage);
  html = html.split("__PUBLISHED_ISO__").join(post.date);
  html = html.split("__MODIFIED_META__").join(
    post.updated ? `<meta property="article:modified_time" content="${post.updated}">` : ""
  );
  html = html.split("__ARTICLE_SECTION_META__").join(
    post.category ? `<meta property="article:section" content="${escapeHtml(post.category)}">` : ""
  );
  html = html.split("__ARTICLE_TAG_META__").join(
    post.tags.map((t) => `<meta property="article:tag" content="${escapeHtml(t)}">`).join("\n")
  );
  html = html.split("__SLUG__").join(post.slug);
  html = html.split("__FILE__").join(post.file);
  html = html.split("__JSONLD__").join(jsonLd(post));

  html = html.replace(
    '<div class="jf-meta" id="post-meta-top"></div>',
    `<div class="jf-meta" id="post-meta-top">${metaTopHtml(post)}</div>`
  );
  if (post.subtitle) {
    html = html.replace(
      '<p class="subtitle" id="post-subtitle"></p>',
      `<p class="subtitle" id="post-subtitle">${escapeHtml(post.subtitle)}</p>`
    );
  }
  const slots = {
    '<div class="container" id="post-cover-slot"></div>': coverHtml(post) && `<div class="container" id="post-cover-slot">${coverHtml(post)}</div>`,
    '<div class="container" id="post-repost-slot"></div>': repostHtml(post) && `<div class="container" id="post-repost-slot">${repostHtml(post)}</div>`,
    '<div id="post-gallery-slot"></div>': galleryHtml(post) && `<div id="post-gallery-slot">${galleryHtml(post)}</div>`,
    '<div id="post-video-slot"></div>': videoHtml(post) && `<div id="post-video-slot">${videoHtml(post)}</div>`,
    '<div id="post-changelog-slot"></div>': changelogHtml(post) && `<div id="post-changelog-slot">${changelogHtml(post)}</div>`,
    '<div id="post-series-slot"></div>': seriesHtml(post, allPosts) && `<div id="post-series-slot">${seriesHtml(post, allPosts)}</div>`,
    '<div id="post-nav-slot"></div>': prevNextHtml(post, allPosts) && `<div id="post-nav-slot">${prevNextHtml(post, allPosts)}</div>`,
    '<div id="related-posts-slot"></div>': relatedHtml(post, allPosts) && `<div id="related-posts-slot">${relatedHtml(post, allPosts)}</div>`,
  };
  for (const [placeholder, replacement] of Object.entries(slots)) {
    if (replacement) html = html.replace(placeholder, replacement);
  }

  return html;
}

function writePostPages(posts) {
  if (!existsSync(TEMPLATE_FILE)) {
    console.error("Missing journal/_template/post.html — skipping page generation.");
    return;
  }
  const template = readFileSync(TEMPLATE_FILE, "utf8");

  for (const post of posts) {
    const outDir = join(JOURNAL_DIR, post.slug);
    mkdirSync(outDir, { recursive: true });
    const html = generatePostPage(post, posts, template);
    writeFileSync(join(outDir, "index.html"), html, "utf8");
  }
  console.log(`Generated ${posts.length} post page(s) under journal/<slug>/`);
}

function writeSitemap(posts) {
  const portfolioUrls = `  <url>
    <loc>${SITE_URL}/</loc>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/"/>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/about.html</loc>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/about.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/about.html"/>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/projects.html</loc>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/projects.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/projects.html"/>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/contact.html</loc>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/contact.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/contact.html"/>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${SITE_URL}/en/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/"/>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/"/>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/en/about.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/about.html"/>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/about.html"/>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${SITE_URL}/en/projects.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/projects.html"/>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/projects.html"/>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/en/contact.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/contact.html"/>
    <xhtml:link rel="alternate" hreflang="fa" href="${SITE_URL}/contact.html"/>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>`;

  const journalHome = `  <url>
    <loc>${SITE_URL}/journal/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

  const journalPosts = posts
    .map(
      (p) => `  <url>
    <loc>${SITE_URL}/journal/${p.slug}/</loc>
    <lastmod>${p.updated || p.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

${portfolioUrls}

${journalHome}
${journalPosts}

</urlset>
`;

  writeFileSync(join(ROOT, "sitemap.xml"), xml, "utf8");
  console.log(`Wrote sitemap.xml (8 portfolio pages + ${posts.length + 1} journal pages)`);
}

function rssEscape(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function writeFeed(posts) {
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/journal/${p.slug}/`;
      const pubDate = new Date(p.date).toUTCString();
      return `    <item>
      <title>${rssEscape(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${rssEscape(p.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
      ${p.category ? `<category>${rssEscape(p.category)}</category>` : ""}
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AN Journal — ابوالفضل نعیمی</title>
    <link>${SITE_URL}/journal/</link>
    <atom:link href="${SITE_URL}/journal/feed.xml" rel="self" type="application/rss+xml"/>
    <description>یادداشت‌ها و نوشته‌های ابوالفضل نعیمی درباره ساخت محصول، RimNova و هوش مصنوعی.</description>
    <language>fa</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  writeFileSync(join(JOURNAL_DIR, "feed.xml"), rss, "utf8");
  console.log(`Wrote journal/feed.xml (${posts.length} item(s))`);
}

function main() {
  const posts = readAllPosts();
  writeIndex(posts);
  writePostPages(posts);
  writeSitemap(posts);
  writeFeed(posts);
}

main();
