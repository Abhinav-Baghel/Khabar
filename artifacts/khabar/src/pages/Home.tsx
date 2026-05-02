import { useListPosts, getListPostsQueryKey, PostCategory } from "@workspace/api-client-react";
import { PostCard } from "@/components/PostCard";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Radio, X, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL, useCurrentUser } from "@/lib/auth";
import { NewsCard, type NewsItem } from "@/components/NewsCard";
import { useFeedFilter } from "@/lib/feedFilter";

const CATEGORIES: { label: string; value: PostCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Infrastructure", value: "infrastructure" },
  { label: "Crime", value: "crime" },
  { label: "Politics", value: "politics" },
  { label: "Events", value: "event" },
  { label: "Health", value: "health" as PostCategory },
  { label: "Weather", value: "weather" as PostCategory },
];

// Pre-loaded popular Indore localities for quick filtering
const POPULAR_LOCALITIES = [
  "Vijay Nagar",
  "Kalani Nagar",
  "Palasia",
  "Bhawarkuan",
  "Rajwada",
  "Saket Nagar",
  "LIG Colony",
  "Annapurna"
];

type NewsApiResponse = { items: NewsItem[] };

export default function Home() {
  const [category, setCategory] = useState<PostCategory | "all">("all");
  const session = useCurrentUser();
  
  // We added setLocality here to power the new buttons
  const { locality, setLocality, clear } = useFeedFilter() as any;
  
  const { data: posts, isLoading } = useListPosts(
    category === "all" ? {} : { category },
    { query: { refetchInterval: 5000, queryKey: getListPostsQueryKey(category === "all" ? {} : { category }) } }
  );

  const city = (session?.district ?? "").trim();
  
  // 1. We added 'category' to the queryKey so it refetches when you click a filter
  const newsQuery = useQuery({
    queryKey: ["news", city, category],
    enabled: city.length > 0,
    queryFn: async () => {
      // 1. Safe query string builder (No new URL() crashes!)
      const params = new URLSearchParams({ city });
      if (category !== "all") {
        params.append("category", category);
      }
      
      // 2. Append it safely to the base URL
      const res = await fetch(`${API_BASE_URL}/news?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("news_unavailable");
      return (await res.json()) as NewsApiResponse;
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const newsItems = newsQuery.data?.items ?? [];
  const newsUnavailable = city.length > 0 && newsQuery.isError;

  const mergedAll = [
    ...(posts ?? []).map((p) => ({ type: "citizen" as const, createdAt: p.createdAt, post: p })),
    ...newsItems.map((n) => ({ type: "news" as const, createdAt: n.publishedAt, item: n })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  // 3. Upgraded the filter logic to handle both category and locality strictly
  const merged = mergedAll.filter((entry) => {
    if (locality && entry.type === "citizen") {
       if (entry.post.location.neighborhood?.toLowerCase() !== locality.toLowerCase()) return false;
    }
    
    if (category !== "all" && entry.type === "citizen") {
      if (entry.post.category !== category) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full">
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-zinc-100">Your Local Feed</h1>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium uppercase tracking-wider">
                CURRENT ZONE
              </span>
              {locality ? (
                <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  #{locality}
                  <button
                    onClick={clear}
                    className="text-emerald-300 hover:text-emerald-100"
                    title="Clear locality filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <span className="text-zinc-400">All localities</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium bg-emerald-500/10 px-2 py-1 rounded-md">
            <Radio className="w-3 h-3 animate-pulse" /> Live
          </div>
        </div>
        
        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Badge
              key={cat.value}
              variant={category === cat.value ? "default" : "outline"}
              className={`cursor-pointer whitespace-nowrap text-sm px-4 py-1.5 transition-colors ${
                category === cat.value 
                  ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border-transparent" 
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-100 border-zinc-800 hover:border-zinc-700"
              }`}
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </Badge>
          ))}
        </div>

        {/* Locality Buttons (New!) */}
        <div className="flex gap-2 overflow-x-auto pt-3 pb-1 scrollbar-hide border-t border-zinc-800/50 mt-1">
          <div className="flex items-center pr-2 text-zinc-500">
            <MapPin className="w-4 h-4" />
          </div>
          {POPULAR_LOCALITIES.map((loc) => {
            const isActive = locality?.toLowerCase() === loc.toLowerCase();
            return (
              <Badge
                key={loc}
                variant="outline"
                className={`cursor-pointer whitespace-nowrap text-xs px-3 py-1 transition-colors font-normal ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
                }`}
                onClick={() => {
                  if (isActive) {
                    clear();
                  } else if (setLocality) {
                    setLocality(loc);
                  }
                }}
              >
                {loc}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col">
        {isLoading ? (
          <div className="p-8 text-center text-zinc-500">Loading feed...</div>
        ) : merged.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <Radio className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-lg font-medium text-zinc-300">
              {newsUnavailable ? "Be the first to report news in your area!" : "No posts found for this filter"}
            </p>
            <p className="text-sm mt-1">
              {newsUnavailable
                ? "External news is temporarily unavailable."
                : "Try selecting a different category or locality."}
            </p>
          </div>
        ) : (
          merged.map((entry) =>
            entry.type === "citizen" ? (
              <PostCard key={`p:${entry.post.id}`} post={entry.post} />
            ) : (
              <NewsCard key={`n:${entry.item.id}`} item={entry.item} />
            ),
          )
        )}
      </div>
    </div>
  );
}