import { useParams, Link } from "wouter";
import { useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";
import { MapPin, ShieldCheck, FileText, Activity, ArrowUp, ArrowDown, ChevronLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: userProfile, isLoading } = useGetUser(id || "", {
    query: { enabled: !!id, queryKey: getGetUserQueryKey(id || "") }
  });

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading profile...</div>;
  if (!userProfile) return <div className="p-8 text-center text-zinc-500">Profile not found</div>;

  let runningScore = 0;
  const chartData = [...userProfile.reputationHistory].reverse().map(event => {
    runningScore += event.pointsChange;
    return {
      date: format(new Date(event.date), 'MMM d'),
      score: runningScore,
      reason: event.reason,
      change: event.pointsChange
    };
  });

  return (
    <div className="flex flex-col w-full pb-10">
      <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 -ml-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="p-6 bg-zinc-950 border-b border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
                {userProfile.displayName}
              </h1>
              <div className="flex items-center gap-2 text-zinc-400 mt-1">
                <MapPin className="w-4 h-4" /> {userProfile.locality}
                <span className="mx-2">•</span>
                <span className="text-sm">Member since {format(new Date(userProfile.createdAt), 'MMM yyyy')}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-md text-emerald-500"><Activity className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Reputation</div>
                  <div className="text-xl font-bold text-emerald-500">{userProfile.currentReputationScore}</div>
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2 flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-md text-zinc-400"><FileText className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Posts</div>
                  <div className="text-xl font-bold text-zinc-100">{userProfile.postCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-zinc-800 bg-[#18181b]">
        <h2 className="text-lg font-bold text-zinc-100 mb-6">Credibility Timeline</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                itemStyle={{ color: '#10b981' }}
                labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
              />
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="flex-1 p-6 border-r border-zinc-800 border-b md:border-b-0 bg-zinc-950">
          <h2 className="text-lg font-bold text-zinc-100 mb-6">Activity Ledger</h2>
          <div className="relative border-l border-zinc-800 ml-3 space-y-6">
            {userProfile.reputationHistory.map((event) => (
              <div key={event.id} className="relative pl-6">
                <div className={`absolute -left-[13px] top-1 w-6 h-6 rounded-full flex items-center justify-center border ${event.pointsChange >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-rose-500/10 border-rose-500/30 text-rose-500'}`}>
                  {event.pointsChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-mono text-sm font-bold ${event.pointsChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {event.pointsChange > 0 ? '+' : ''}{event.pointsChange}
                  </span>
                  <span className="text-xs text-zinc-500">{formatDistanceToNow(new Date(event.date))} ago</span>
                </div>
                <p className="text-sm text-zinc-300">{event.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-zinc-950">
          <div className="p-6 pb-2 border-b border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-100">Recent Posts</h2>
          </div>
          <div className="flex flex-col">
            {userProfile.recentPosts.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">No posts yet</div>
            ) : (
              userProfile.recentPosts.map(post => (
                <PostCard key={post.id} post={post} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}