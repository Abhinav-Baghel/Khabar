import { Router, type IRouter } from "express";

type NormalizedNewsItem = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
  source: string | null;
  language: "en" | "hi" | "unknown";
};

const router: IRouter = Router();

function normalizeLanguage(value: string | undefined): NormalizedNewsItem["language"] {
  if (value === "en") return "en";
  if (value === "hi") return "hi";
  return "unknown";
}

function coerceIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function stableIdFromUrlOrTitle(url: string | undefined, title: string | undefined): string | null {
  const base = (url ?? "").trim() || (title ?? "").trim();
  if (!base) return null;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

// SOURCE 1: NewsData.io
async function fetchNewsData(city: string, category?: string): Promise<NormalizedNewsItem[]> {
  const key = process.env.NEWSDATA_KEY;
  if (!key) return [];

  const url = new URL("https://newsdata.io/api/1/news");
  url.searchParams.set("apikey", key);
  url.searchParams.set("country", "in");
  
  // STRICT SEARCH: Must contain city AND category
  const query = category && category !== "all" ? `"${city}" AND "${category}"` : `"${city}"`;
  url.searchParams.set("q", query);

  try {
    const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!resp.ok) return [];
    const data = await resp.json() as any;
    
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map((r: any) => ({
      id: `nd:${stableIdFromUrlOrTitle(r.link, r.title) || Math.random().toString()}`,
      title: (r.title ?? "").trim(),
      description: (r.description ?? "").trim() || null,
      url: (r.link ?? "").trim(),
      publishedAt: coerceIsoDate(r.pubDate) || new Date().toISOString(),
      imageUrl: (r.image_url ?? "").trim() || null,
      source: (r.source_id ?? "").trim() || "NewsData",
      language: normalizeLanguage(r.language),
    })).filter((item: any) => item.title && item.url);
  } catch (e) {
    return [];
  }
}

// SOURCE 2: GNews
async function fetchGNews(city: string, category?: string): Promise<NormalizedNewsItem[]> {
  const key = process.env.GNEWS_KEY;
  if (!key) return [];

  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("apikey", key);
  url.searchParams.set("country", "in");
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");

  // STRICT SEARCH
  const query = category && category !== "all" ? `"${city}" AND "${category}"` : `"${city}"`;
  url.searchParams.set("q", query);

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return [];
    const data = await resp.json() as any;

    const results = Array.isArray(data.articles) ? data.articles : [];
    return results.map((r: any) => ({
      id: `gn:${stableIdFromUrlOrTitle(r.url, r.title) || Math.random().toString()}`,
      title: r.title,
      description: r.description || null,
      url: r.url,
      publishedAt: coerceIsoDate(r.publishedAt) || new Date().toISOString(),
      imageUrl: r.image || null,
      source: r.source?.name || "GNews",
      language: "en",
    })).filter((item: any) => item.title && item.url);
  } catch (e) {
    return [];
  }
}

// SOURCE 3: NewsAPI.org
async function fetchNewsAPI(city: string, category?: string): Promise<NormalizedNewsItem[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];

  const url = new URL("https://newsapi.org/v2/everything");
  
  // STRICT SEARCH
  const query = category && category !== "all" ? `+"${city}" +"${category}"` : `+"${city}"`;
  
  url.searchParams.set("q", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");

  try {
    const resp = await fetch(url.toString(), {
      headers: { "X-Api-Key": key }
    });
    if (!resp.ok) return [];
    const data = await resp.json() as any;

    const results = Array.isArray(data.articles) ? data.articles : [];
    return results.map((r: any) => ({
      id: `na:${stableIdFromUrlOrTitle(r.url, r.title) || Math.random().toString()}`,
      title: r.title,
      description: r.description || null,
      url: r.url,
      publishedAt: coerceIsoDate(r.publishedAt) || new Date().toISOString(),
      imageUrl: r.urlToImage || null,
      source: r.source?.name || "NewsAPI",
      language: "en",
    })).filter((item: any) => item.title && item.url && item.title !== "[Removed]");
  } catch (e) {
    return [];
  }
}

router.get("/news", async (req, res): Promise<void> => {
  const city = (req.query.city as string | undefined)?.trim();
  const category = (req.query.category as string | undefined)?.trim();

  if (!city) {
    res.status(400).json({ error: "city query param is required" });
    return;
  }

  try {
    const [newsData, gNews, newsApi] = await Promise.all([
      fetchNewsData(city, category),
      fetchGNews(city, category),
      fetchNewsAPI(city, category)
    ]);

    const allArticles = [...newsData, ...gNews, ...newsApi];
    const uniqueArticles = new Map<string, NormalizedNewsItem>();

    for (const item of allArticles) {
      const urlKey = item.url.toLowerCase();
      if (!uniqueArticles.has(urlKey)) {
        uniqueArticles.set(urlKey, item);
      }
    }

    let sortedItems = Array.from(uniqueArticles.values()).sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
    );

    // 🛑 THE BOUNCER: Manually filter out garbage the APIs ignored
    if (category && category !== "all") {
      const catLower = category.toLowerCase();
      sortedItems = sortedItems.filter(item => {
        const textToSearch = `${item.title} ${item.description || ""}`.toLowerCase();
        // Force the article to ACTUALLY contain the category keyword
        return textToSearch.includes(catLower);
      });
    }

    res.json({ items: sortedItems });
  } catch (error) {
    req.log.warn({ err: error }, "News aggregation failed");
    res.status(503).json({ error: "News services unavailable", items: [] });
  }
});

export default router;
