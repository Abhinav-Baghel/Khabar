import { Router, type IRouter } from "express";
import * as z from "zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "../lib/gemini";

const router: IRouter = Router();

const PrescanBody = z.object({
  headline: z.string().min(1),
  details: z.string().min(1),
});

const AiSchema = z.object({
  hateSpeech: z.boolean(),
  sensationalismScore: z.number().min(0).max(10),
  credibilityAssessment: z.string().min(1),
  verdict: z.string().min(1),
});

const VerifyArticleBody = z
  .object({
    articleTitle: z.string().min(1),
    articleContent: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
  })
  .refine((data) => !!(data.articleContent?.trim() || data.summary?.trim()), {
    message: "articleContent or summary is required",
  });

const VerifyArticleVerdict = z.enum([
  "Likely True",
  "Needs Context",
  "Misleading",
  "Unverifiable",
]);

const VerifyArticleSchema = z.object({
  verdict: VerifyArticleVerdict,
  explanation: z.string().min(1),
});

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Failed to parse AI JSON");
  }
}

async function analyzeWithGemini(opts: { headline: string; details: string }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      "You are a strict JSON generator. Output ONLY a single JSON object and nothing else.",
  });

  const prompt = [
    "Analyze this local-news report for moderation + credibility.",
    "Return ONLY valid JSON with keys exactly:",
    "{\"hateSpeech\":boolean,\"sensationalismScore\":number,\"credibilityAssessment\":string,\"verdict\":string}",
    "sensationalismScore must be a number from 0 to 10.",
    "",
    `Headline: ${opts.headline}`,
    `Details: ${opts.details}`,
  ].join("\n");

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = extractJsonObject(text);
  return AiSchema.parse(parsed);
}

async function verifyArticleWithGemini(opts: { articleTitle: string; articleContent: string }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      "You are an impartial fact-checker and strict JSON generator. Output ONLY a single JSON object and nothing else.",
  });

  const prompt = [
    "Review the following news article as an impartial fact-checker.",
    "Assess the headline and body for factual plausibility, missing context, sensationalism, and obvious bias.",
    "You do not have live web access; base your judgment only on the text provided.",
    "",
    "Return ONLY valid JSON with exactly these two keys (no markdown fences, no commentary):",
    '{"verdict": string, "explanation": string}',
    "",
    'The "verdict" value MUST be exactly one of these four strings (case-sensitive, including spaces):',
    '"Likely True", "Needs Context", "Misleading", "Unverifiable"',
    "",
    'The "explanation" value MUST be a brief 2-3 sentence explanation of the verdict, highlighting any obvious bias or missing facts.',
    "",
    `Title: ${opts.articleTitle}`,
    `Content: ${opts.articleContent}`,
  ].join("\n");

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = extractJsonObject(text);
  return VerifyArticleSchema.parse(parsed);
}

router.post("/ai/prescan", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = PrescanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const analysis = await analyzeWithGemini(parsed.data);
    const allowPublish = analysis.hateSpeech === false && analysis.sensationalismScore <= 9;
    res.json({ allowPublish, analysis });
  } catch (error) {
    req.log.warn({ err: error }, "AI prescan failed");
    res.status(503).json({ error: "AI service unavailable", allowPublish: false });
  }
});

router.post("/ai/verify-article", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = VerifyArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const articleContent = (parsed.data.articleContent ?? parsed.data.summary ?? "").trim();

  try {
    const result = await verifyArticleWithGemini({
      articleTitle: parsed.data.articleTitle.trim(),
      articleContent,
    });
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "AI verify-article failed");
    res.status(500).json({ error: "AI verification failed" });
  }
});

export default router;

