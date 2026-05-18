import { useState, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/auth";

type AiVerdict = "Likely True" | "Needs Context" | "Misleading" | "Unverifiable";

export type AiVerifyResult = {
  verdict: AiVerdict;
  explanation: string;
};

type AiVerifyState = "idle" | "loading" | "done" | "error";

const verdictStyles: Record<AiVerdict, string> = {
  "Likely True": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Needs Context": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Misleading: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  Unverifiable: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export type ArticleAiVerifyInput = {
  articleTitle: string;
  /** Short summary or body text; always sent as a scrape fallback */
  articleContent: string;
  /** External source URL (e.g. news feed `item.url`) for full-article scraping */
  articleUrl?: string;
};

export function useArticleAiVerify({
  articleTitle,
  articleContent,
  articleUrl,
}: ArticleAiVerifyInput) {
  const [state, setState] = useState<AiVerifyState>("idle");
  const [result, setResult] = useState<AiVerifyResult | null>(null);

  const verify = useCallback(async () => {
    setState("loading");
    setResult(null);
    try {
      const trimmedUrl = articleUrl?.trim();
      const payload: Record<string, string> = {
        articleTitle: articleTitle.trim(),
        articleContent: articleContent.trim(),
      };
      if (trimmedUrl) {
        payload.articleUrl = trimmedUrl;
      }

      const res = await authFetch("/ai/verify-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("AI verification failed");
      const data = (await res.json()) as AiVerifyResult;
      setResult(data);
      setState("done");
    } catch {
      setState("error");
    }
  }, [articleTitle, articleContent, articleUrl]);

  const showPanel = state === "loading" || result !== null || state === "error";

  return {
    state,
    result,
    verify,
    loading: state === "loading",
    showPanel,
  };
}

export function AiVerifyTriggerButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={onClick}
      className="border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 gap-1.5 h-8 shrink-0"
      data-testid="button-ai-verify"
      aria-label="AI Verify article"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
      )}
      AI Verify
    </Button>
  );
}

export function AiVerifyResultPanel({
  state,
  result,
  className = "",
}: {
  state: AiVerifyState;
  result: AiVerifyResult | null;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4 ${className}`}
      data-testid="ai-verify-result"
    >
      {state === "loading" && (
        <p className="text-sm text-zinc-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" aria-hidden="true" />
          AI is analyzing...
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-rose-400">
          AI verification is unavailable. Please try again later.
        </p>
      )}
      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              AI verdict
            </span>
            <Badge
              variant="outline"
              className={verdictStyles[result.verdict] ?? verdictStyles.Unverifiable}
            >
              {result.verdict}
            </Badge>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{result.explanation}</p>
        </div>
      )}
    </div>
  );
}
