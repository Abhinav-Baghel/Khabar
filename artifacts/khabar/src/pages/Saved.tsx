import { useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { PostCard } from "@/components/PostCard";
import { Bookmark, Radio } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";

export default function Saved() {
  const user = useCurrentUser();
  const { data: posts, isLoading } = useListPosts(
    { savedBy: user?.uid },
    {
      query: {
        enabled: !!user?.uid,
        refetchInterval: 5000,
        queryKey: getListPostsQueryKey({ savedBy: user?.uid }),
      },
    }
  );

  return (
    <div className="flex flex-col w-full">
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-emerald-500" /> Your Saved Reports
          </h1>
          <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium bg-emerald-500/10 px-2 py-1 rounded-md">
            <Radio className="w-3 h-3 animate-pulse" /> Live
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {isLoading ? (
          <div className="p-8 text-center text-zinc-500">Loading saved posts...</div>
        ) : posts?.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <Bookmark className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-lg font-medium text-zinc-300">No saved reports</p>
            <p className="text-sm mt-1 text-zinc-500">Posts you save will appear here for quick access.</p>
          </div>
        ) : (
          posts?.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </div>
    </div>
  );
}