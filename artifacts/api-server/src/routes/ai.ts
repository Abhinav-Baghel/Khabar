import { Router, type IRouter } from "express";
import * as z from "zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    model: "gemini-1.5-flash",
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

export default router;

