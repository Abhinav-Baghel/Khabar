import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { 
  ArrowUp, ArrowDown, Bookmark, ShieldAlert, ShieldCheck, 
  MapPin, Clock, CheckCircle2, AlertTriangle, MoreHorizontal, Sparkles, Loader2
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Post, VerificationStatus, useVotePost, useSavePost, useVerifyPost,
  getListPostsQueryKey, getGetStatsOverviewQueryKey
} from "@workspace/api-client-react";
import { API_BASE_URL, authFetch } from "@/lib/auth";

function objectUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/storage${path}`;
}

type AiVerdict = "Likely True" | "Needs Context" | "Misleading" | "Unverifiable";

type AiVerifyResult = {
  verdict: AiVerdict;
  explanation: string;
};

const verdictStyles: Record<AiVerdict, string> = {
  "Likely True": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Needs Context": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Misleading: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  Unverifiable: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function PostCard({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const votePost = useVotePost();
  const savePost = useSavePost();
  const verifyPost = useVerifyPost();

  const [aiVerifyState, setAiVerifyState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [aiVerifyResult, setAiVerifyResult] = useState<AiVerifyResult | null>(null);

  async function handleAiVerify() {
    setAiVerifyState("loading");
    setAiVerifyResult(null);
    try {
      const res = await authFetch("/ai/verify-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleTitle: post.headline,
          articleContent: post.details,
        }),
      });
      if (!res.ok) throw new Error("AI verification failed");
      const data = (await res.json()) as AiVerifyResult;
      setAiVerifyResult(data);
      setAiVerifyState("done");
    } catch {
      setAiVerifyState("error");
    }
  }

  const handleVote = (direction: "up" | "down") => {
    const newDirection = post.currentUserVote === direction ? "clear" : direction;
    votePost.mutate({ id: post.id, data: { direction: newDirection } }, {
      onSuccess: (updatedPost) => {
        // Optimistic update for list
        queryClient.setQueryData(getListPostsQueryKey({}), (old: any) => {
          if (!old) return old;
          return old.map((p: Post) => p.id === post.id ? updatedPost : p);
        });
      }
    });
  };

  const handleSave = () => {
    savePost.mutate({ id: post.id, data: { saved: !post.savedByCurrentUser } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      }
    });
  };

  const handleVerify = (status: VerificationStatus) => {
    verifyPost.mutate({ id: post.id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
      }
    });
  };

  const verificationBadge = {
    unverified: <Badge variant="outline" className="bg-zinc-800/50 text-zinc-400 border-zinc-700 gap-1"><AlertTriangle className="w-3 h-3" /> Pending</Badge>,
    community: <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1"><ShieldAlert className="w-3 h-3" /> Community</Badge>,
    editor: <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1"><ShieldCheck className="w-3 h-3" /> Editor</Badge>,
    verified: <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</Badge>
  }[post.verificationStatus];

  return (
    <article className="p-4 sm:p-5 border-b border-zinc-800 bg-[#18181b] transition-colors hover:bg-zinc-900/80 group">
      {post.isBreaking && (
        <div className="flex items-center gap-2 text-rose-500 text-xs font-bold uppercase tracking-wider mb-3 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          Breaking News
        </div>
      )}
      
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-400 border-purple-500/20"
          >
            Citizen Report
          </Badge>
          {verificationBadge}
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 capitalize">
            {post.category}
          </Badge>
          <span className="text-zinc-500 text-sm flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {post.location.neighborhood}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-zinc-500 hover:text-zinc-300">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => handleVerify("community")}>Verify as Community</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleVerify("editor")}>Verify as Editor</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleVerify("verified")} className="text-emerald-500">Mark Fully Verified</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h2 className="text-xl font-bold text-zinc-100 mb-2 leading-snug">
        <Link
          href={`/p/${post.id}`}
          className="hover:text-emerald-300 transition-colors"
        >
          {post.headline}
        </Link>
      </h2>
      <p className="text-zinc-400 text-sm mb-4 line-clamp-3 leading-relaxed">
        {post.details}
      </p>

      {(aiVerifyState === "loading" || aiVerifyResult || aiVerifyState === "error") && (
        <div
          className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4"
          data-testid="ai-verify-result"
        >
          {aiVerifyState === "loading" && (
            <p className="text-sm text-zinc-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" aria-hidden="true" />
              AI is analyzing...
            </p>
          )}
          {aiVerifyState === "error" && (
            <p className="text-sm text-rose-400">
              AI verification is unavailable. Please try again later.
            </p>
          )}
          {aiVerifyResult && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  AI verdict
                </span>
                <Badge
                  variant="outline"
                  className={verdictStyles[aiVerifyResult.verdict] ?? verdictStyles.Unverifiable}
                >
                  {aiVerifyResult.verdict}
                </Badge>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {aiVerifyResult.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-800/50 rounded-full border border-zinc-800">
            <button 
              onClick={() => handleVote("up")}
              className={`p-2 rounded-l-full transition-colors ${post.currentUserVote === "up" ? "text-emerald-500 bg-emerald-500/10" : "text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"}`}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <span className={`text-sm font-medium px-2 ${post.currentUserVote === "up" ? "text-emerald-500" : post.currentUserVote === "down" ? "text-rose-500" : "text-zinc-300"}`}>
              {post.upvotes - post.downvotes}
            </span>
            <button 
              onClick={() => handleVote("down")}
              className={`p-2 rounded-r-full transition-colors ${post.currentUserVote === "down" ? "text-rose-500 bg-rose-500/10" : "text-zinc-400 hover:text-rose-400 hover:bg-zinc-800"}`}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
          
          <button onClick={handleSave} className={`p-2 rounded-full transition-colors ${post.savedByCurrentUser ? "text-emerald-500 bg-emerald-500/10" : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800"}`}>
            <Bookmark className={`w-5 h-5 ${post.savedByCurrentUser ? "fill-current" : ""}`} />
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={aiVerifyState === "loading"}
            onClick={() => void handleAiVerify()}
            className="border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 gap-1.5 h-8"
            data-testid="button-ai-verify"
          >
            {aiVerifyState === "loading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            )}
            AI Verify
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end text-xs">
            <Link href={`/u/${post.authorId}`} className="text-zinc-300 font-medium hover:text-emerald-400 transition-colors">
              {post.authorName}
            </Link>
            <div className="flex items-center gap-2 text-zinc-500">
              <span className="text-emerald-500 font-mono">{post.authorReputation} rep</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(post.createdAt))} ago</span>
            </div>
          </div>
          <Link href={`/u/${post.authorId}`}>
            <Avatar className="w-8 h-8 border border-zinc-800">
              {post.authorPhotoUrl && (
                <AvatarImage src={objectUrl(post.authorPhotoUrl)} alt={post.authorName} />
              )}
              <AvatarFallback className="bg-zinc-800 text-xs text-zinc-400">{post.authorName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </article>
  );
}