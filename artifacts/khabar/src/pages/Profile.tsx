import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetUser, useUpdateCurrentUser, getGetUserQueryKey, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { authFetch, useAuth, useCurrentUser, API_BASE_URL } from "@/lib/auth";
import { format, formatDistanceToNow } from "date-fns";
import { MapPin, Edit2, ShieldCheck, FileText, Activity, ArrowUp, ArrowDown, Camera } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

function objectUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/storage${path}`;
}

export default function Profile() {
  const queryClient = useQueryClient();
  const session = useCurrentUser();
  const { refresh } = useAuth();
  const { data: userProfile, isLoading } = useGetUser(session?.uid || "", {
    query: { enabled: !!session?.uid, queryKey: getGetUserQueryKey(session?.uid || "") }
  });

  const updateSession = useUpdateCurrentUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocality, setEditLocality] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-zinc-500">Loading profile...</div>;
  if (!userProfile) return <div className="p-8 text-center text-zinc-500">Profile not found</div>;

  const handleEditToggle = () => {
    if (!isEditing) {
      setEditName(userProfile.displayName);
      setEditLocality(userProfile.locality);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = () => {
    updateSession.mutate({ data: { displayName: editName, locality: editLocality } }, {
      onSuccess: (updatedUser) => {
        setIsEditing(false);
        queryClient.setQueryData(getGetUserQueryKey(session!.uid), (old: any) => {
          if (!old) return old;
          return { ...old, displayName: updatedUser.displayName, locality: updatedUser.locality };
        });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        void refresh();
      }
    });
  };

  // Process history for cumulative chart
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
      {/* Header */}
      <div className="p-6 bg-zinc-950 border-b border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-16 h-16 border border-zinc-800">
                {userProfile.photoUrl && (
                  <AvatarImage src={objectUrl(userProfile.photoUrl)} alt={userProfile.displayName} />
                )}
                <AvatarFallback className="bg-zinc-800 text-zinc-200">
                  {userProfile.displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                className={`absolute -bottom-2 -right-2 w-9 h-9 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors ${
                  isUploadingPhoto ? "opacity-60 cursor-not-allowed" : ""
                }`}
                title="Upload profile photo"
              >
                <Camera className="w-4 h-4 text-zinc-300" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploadingPhoto}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const ct = file.type.toLowerCase();
                    const ok = ["image/jpeg", "image/png", "image/webp"].includes(ct);
                    if (!ok) {
                      toast.error("Please upload a jpg, png, or webp image.");
                      return;
                    }
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("Photo must be under 10MB.");
                      return;
                    }
                    setIsUploadingPhoto(true);
                    try {
                      const fd = new FormData();
                      fd.append("files", file, file.name);
                      const res = await authFetch("/uploads", { method: "POST", body: fd });
                      if (!res.ok) throw new Error("upload_failed");
                      const data = (await res.json()) as { files: { url: string }[] };
                      const url = data.files?.[0]?.url;
                      if (!url) throw new Error("upload_failed");
                      updateSession.mutate(
                        { data: { photoUrl: url } },
                        {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(session!.uid) });
                            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
                            void refresh();
                            toast.success("Profile photo updated.");
                          },
                        },
                      );
                    } catch {
                      toast.error("Failed to upload photo.");
                    } finally {
                      setIsUploadingPhoto(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-3 mb-4">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-zinc-900 border-zinc-800 text-xl font-bold h-12" placeholder="Display Name" />
                <Input value={editLocality} onChange={e => setEditLocality(e.target.value)} className="bg-zinc-900 border-zinc-800" placeholder="Primary Locality" />
                <div className="flex gap-2">
                  <Button onClick={handleSave} size="sm" className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
                  <Button onClick={handleEditToggle} size="sm" variant="ghost" className="text-zinc-400">Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="mb-6 group">
                <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
                  {userProfile.displayName}
                  <Button variant="ghost" size="icon" onClick={handleEditToggle} className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-zinc-500 hover:text-emerald-400">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </h1>
                <div className="text-sm text-zinc-500 mt-1">@{userProfile.username}</div>
                <div className="flex items-center gap-2 text-zinc-400 mt-1">
                  <MapPin className="w-4 h-4" /> {userProfile.locality}
                  <span className="mx-2">•</span>
                  <span className="text-sm">Member since {format(new Date(userProfile.createdAt), 'MMM yyyy')}</span>
                </div>
              </div>
            )}

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
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2 flex items-center gap-3 hidden sm:flex">
                <div className="p-2 bg-blue-500/10 rounded-md text-blue-500"><ShieldCheck className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Verified</div>
                  <div className="text-xl font-bold text-zinc-100">{userProfile.verifiedCount}</div>
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2 flex items-center gap-3 hidden sm:flex">
                <div className="p-2 bg-zinc-800 rounded-md text-zinc-400"><FileText className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Reads</div>
                  <div className="text-xl font-bold text-zinc-100">{userProfile.readCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
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
        {/* Ledger */}
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

        {/* Recent Posts */}
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