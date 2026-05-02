import { useParams, Link } from "wouter";
import { useGetPost, getGetPostQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "@/components/PostCard";
import { ChevronLeft, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

type AiPending = { status: "pending" };
type AiFailed = { status: "failed"; error: string };
type AiDone = {
  status: "done";
  analysis: {
    hateSpeech: boolean;
    sensationalismScore: number;
    credibilityAssessment: string;
    verdict: string;
    createdAt: string;
  };
};

type MediaItem = { id: number; url: string; kind: "photo" | "video" };

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);

  const { data: post, isLoading } = useGetPost(postId, {
    query: { enabled: Number.isFinite(postId), queryKey: getGetPostQueryKey(postId) },
  });

  const mediaQuery = useQuery({
    queryKey: ["post-media", postId],
    enabled: Number.isFinite(postId),
    queryFn: async () => {
      const res = await authFetch(`/posts/${postId}/media`);
      if (!res.ok) return { media: [] as MediaItem[] };
      return (await res.json()) as { media: MediaItem[] };
    },
  });

  const aiQuery = useQuery({
    queryKey: ["post-ai", postId],
    enabled: Number.isFinite(postId),
    queryFn: async () => {
      const res = await authFetch(`/posts/${postId}/ai-analysis`);
      if (!res.ok) return { status: "pending" } as AiPending;
      return (await res.json()) as AiPending | AiDone | AiFailed;
    },
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 1500 : false),
  });

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading post...</div>;
  if (!post) return <div className="p-8 text-center text-zinc-500">Post not found</div>;

  const media = mediaQuery.data?.media ?? [];
  const ai = aiQuery.data;

  return (
    <div className="flex flex-col w-full">
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 p-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <PostCard post={post} />

      {media.length > 0 && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-100 mb-3">Media</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {media.map((m) =>
              m.kind === "photo" ? (
                <img
                  key={m.id}
                  src={m.url}
                  alt=""
                  className="w-full rounded-xl border border-zinc-800 object-cover max-h-96"
                  loading="lazy"
                />
              ) : (
                <video
                  key={m.id}
                  src={m.url}
                  className="w-full rounded-xl border border-zinc-800 max-h-96"
                  controls
                />
              ),
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-[#18181b] border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-zinc-100">AI Analysis</div>
          {ai?.status === "done" ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1"
            >
              <ShieldCheck className="w-3 h-3" /> Complete
            </Badge>
          ) : ai?.status === "failed" ? (
            <Badge
              variant="outline"
              className="bg-rose-500/10 text-rose-400 border-rose-500/20 gap-1"
            >
              <ShieldAlert className="w-3 h-3" /> Failed
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-orange-500/10 text-orange-400 border-orange-500/20 gap-1"
            >
              <ShieldAlert className="w-3 h-3" /> Scanning
            </Badge>
          )}
        </div>

        {ai?.status === "failed" ? (
          <div className="text-sm text-zinc-400">
            {ai.error || "AI analysis unavailable."}
          </div>
        ) : ai?.status !== "done" ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing report…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Hate speech</div>
                <div className="text-sm font-semibold text-zinc-100">
                  {ai.analysis.hateSpeech ? "Detected" : "Not detected"}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Sensationalism</div>
                <div className="text-sm font-semibold text-zinc-100">
                  {ai.analysis.sensationalismScore}/10
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Verdict</div>
                <div className="text-sm font-semibold text-zinc-100">{ai.analysis.verdict}</div>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                Credibility assessment
              </div>
              <div className="text-sm text-zinc-300">{ai.analysis.credibilityAssessment}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

