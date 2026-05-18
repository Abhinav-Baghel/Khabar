import axios from "axios";
import * as cheerio from "cheerio";

export const MAX_ARTICLE_TEXT_CHARS = 15_000;
const FETCH_TIMEOUT_MS = 12_000;

function truncate(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_ARTICLE_TEXT_CHARS) return normalized;
  return normalized.slice(0, MAX_ARTICLE_TEXT_CHARS);
}

function collectParagraphText($: cheerio.CheerioAPI, root: ReturnType<typeof $>): string[] {
  const parts: string[] = [];
  root.find("p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 40) parts.push(text);
  });
  if (parts.length === 0) {
    const block = root.text().replace(/\s+/g, " ").trim();
    if (block.length > 80) parts.push(block);
  }
  return parts;
}

/**
 * Fetches a news article URL and extracts readable body text for AI analysis.
 * @throws when the fetch or extraction fails
 */
export async function scrapeArticleText(articleUrl: string): Promise<string> {
  const response = await axios.get<string>(articleUrl, {
    timeout: FETCH_TIMEOUT_MS,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    responseType: "text",
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const $ = cheerio.load(response.data);
  $("script, style, nav, header, footer, aside, noscript, iframe, svg").remove();

  let parts: string[] = [];

  const article = $("article").first();
  if (article.length) {
    parts = collectParagraphText($, article);
  }

  if (parts.length === 0) {
    $("main, [role='main'], .article-body, .story-content, .post-content").each((_, el) => {
      if (parts.length > 0) return;
      parts = collectParagraphText($, $(el));
    });
  }

  if (parts.length === 0) {
    $("p").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 60) parts.push(text);
    });
  }

  const combined = parts.join("\n\n").trim();
  if (!combined) {
    throw new Error("No article text extracted from page");
  }

  return truncate(combined);
}
