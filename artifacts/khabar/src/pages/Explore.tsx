import { useGetStatsOverview, useListPosts, getGetStatsOverviewQueryKey, getListPostsQueryKey } from "@workspace/api-client-react";
import { PostCard } from "@/components/PostCard";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, ShieldCheck, AlertTriangle, Users, Search, Globe, MapPin } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/auth";
import { NewsCard, type NewsItem } from "@/components/NewsCard";

const MAJOR_CITIES = [
  "Mumbai", "Delhi", "Bangalore", 
  "Hyderabad", "Chennai", "Kolkata", 
  "Pune", "Ahmedabad"
];

export default function Explore() {
  const { data: stats } = useGetStatsOverview({ query: { refetchInterval: 5000, queryKey: getGetStatsOverviewQueryKey() } });
  const { data: posts, isLoading: postsLoading } = useListPosts({}, { query: { refetchInterval: 5000, queryKey: getListPostsQueryKey({}) } });

  // Search State
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("India"); // Defaults to national trending

  const chartData = stats?.categoryCounts.map(c => ({
    name: c.category.charAt(0).toUpperCase() + c.category.slice(1),
    count: c.count
  })) || [];

  // Nationwide Aggregator Query
  const newsQuery = useQuery({
    queryKey: ["explore-news", activeSearch],
    enabled: activeSearch.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams({ city: activeSearch });
      const res = await fetch(`${API_BASE_URL}/news?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("news_unavailable");
      return (await res.json()) as { items: NewsItem[] };
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveSearch(searchInput.trim());
    }
  };

  return (
    <div className="flex flex-col w-full pb-10">
      <div className="p-4 sm:p-6 border-b border-zinc-800 bg-zinc-950">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6 flex items-center gap-2">
          <Globe className="w-6 h-6 text-emerald-500" /> Nationwide Radar
        </h1>
        
        {/* The Search Bar */}
        <form onSubmit={handleSearch} className="mb-6 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search any district or state in India..."
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-zinc-500"
          />
          <button 
            type="submit" 
            className="absolute inset-y-1.5 right-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold px-4 rounded-lg text-sm transition-colors"
          >
            Explore
          </button>
        </form>

        {/* Quick Links for Major Cities */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
          {MAJOR_CITIES.map((city) => (
            <button
              key={city}
              onClick={() => {
                setSearchInput(city);
                setActiveSearch(city);
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors ${
                activeSearch.toLowerCase() === city.toLowerCase()
                  ? "bg-emerald-500 text-zinc-950 font-medium"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <MapPin className="w-3 h-3" /> {city}
            </button>
          ))}
        </div>

        {/* The Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
            <div className="text-zinc-500 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider"><Activity className="w-3.5 h-3.5" /> Total Reports</div>
            <div className="text-2xl font-bold text-zinc-100">{stats?.totalPosts || 0}</div>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
            <div className="text-rose-500/80 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider"><AlertTriangle className="w-3.5 h-3.5" /> Breaking</div>
            <div className="text-2xl font-bold text-rose-500">{stats?.breakingNow || 0}</div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
            <div className="text-emerald-500/80 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider"><ShieldCheck className="w-3.5 h-3.5" /> Verified</div>
            <div className="text-2xl font-bold text-emerald-500">{stats?.verifiedToday || 0}</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
            <div className="text-blue-500/80 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider"><Users className="w-3.5 h-3.5" /> Reporters</div>
            <div className="text-2xl font-bold text-blue-500">{stats?.activeReporters || 0}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col bg-zinc-950">
        <div className="p-4 sm:px-6 py-4 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/20">
          <h2 className="text-lg font-semibold text-zinc-100">
            {activeSearch === "India" ? "Trending Nationwide" : `Live from ${activeSearch}`}
          </h2>
          <span className="text-xs font-medium bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md">
            Aggregated Feed
          </span>
        </div>

        {/* Multi-Source Aggregator Results */}
        <div className="flex flex-col">
          {newsQuery.isLoading ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Globe className="w-8 h-8 text-emerald-500/50 animate-pulse mb-4" />
              <div className="text-zinc-500">Scanning nationwide sources...</div>
            </div>
          ) : newsQuery.isError || !newsQuery.data?.items?.length ? (
            <div className="p-12 text-center text-zinc-500 bg-zinc-950">
              No recent news found for "{activeSearch}". Try another city!
            </div>
          ) : (
            newsQuery.data.items.map((item) => (
              <NewsCard key={`explore-news:${item.id}`} item={item} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}