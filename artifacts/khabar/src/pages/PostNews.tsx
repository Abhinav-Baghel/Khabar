import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePost,
  getListPostsQueryKey,
  getGetStatsOverviewQueryKey,
} from "@workspace/api-client-react";
import { z } from "zod";
import { toast } from "sonner";
import { authFetch, useCurrentUser } from "@/lib/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, AlertTriangle, Upload, X, MapPin, Image as ImageIcon, Video, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const formSchema = z.object({
  headline: z.string().min(6, "Headline must be at least 6 characters"),
  details: z.string().min(12, "Details must be at least 12 characters"),
  category: z.enum(["infrastructure", "crime", "politics", "event", "health", "weather"]),
  isBreaking: z.boolean(),
  neighborhood: z.string().min(2, "Neighborhood is required"),
});

export default function PostNews() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const session = useCurrentUser();
  const createPost = useCreatePost();
  
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [scan, setScan] = useState<{
    status: "idle" | "scanning" | "blocked" | "ready" | "unavailable";
    verdict?: string;
    sensationalismScore?: number;
  }>({ status: "idle" });
  
  const scanTimeoutRef = useRef<number | null>(null);

  const previews = useMemo(
    () =>
      files.map((f) => ({
        file: f,
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        kind: f.type.startsWith("video/") ? "video" : "photo",
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const p of previews) {
        if (p.url) URL.revokeObjectURL(p.url);
      }
    };
  }, [previews]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      headline: "",
      details: "",
      category: "infrastructure",
      isBreaking: false,
      neighborhood: session?.locality && session.locality !== "Unknown" ? session.locality : "",
    },
  });

  // AI Pre-scan Logic
  useEffect(() => {
    const sub = form.watch((v) => {
      const headline = (v.headline ?? "").trim();
      const details = (v.details ?? "").trim();
      if (headline.length < 6 || details.length < 12) {
        setScan({ status: "idle" });
        return;
      }

      setScan((s) => (s.status === "scanning" ? s : { status: "scanning" }));
      if (scanTimeoutRef.current != null) {
        window.clearTimeout(scanTimeoutRef.current);
      }
      
      scanTimeoutRef.current = window.setTimeout(async () => {
        try {
          const res = await authFetch("/ai/prescan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headline, details }),
          });
          
          if (!res.ok) throw new Error("AI Unavailable");
          
          const data = (await res.json()) as {
            allowPublish: boolean;
            analysis: { verdict: string; sensationalismScore: number };
          };
          
          setScan({
            status: data.allowPublish ? "ready" : "blocked",
            verdict: data.analysis?.verdict,
            sensationalismScore: data.analysis?.sensationalismScore,
          });
        } catch {
          // Graceful fallback if AI fails
          setScan({ status: "unavailable" });
        }
      }, 800); // Slightly longer debounce to save API calls
    });

    return () => {
      sub.unsubscribe();
      if (scanTimeoutRef.current != null) {
        window.clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [form]);

  const validateFiles = (next: File[]) => {
    const errors: string[] = [];
    for (const f of next) {
      const ct = f.type.toLowerCase();
      const isPhoto = ["image/jpeg", "image/png", "image/webp"].includes(ct);
      const isVideo = ["video/mp4", "video/quicktime"].includes(ct);
      if (!isPhoto && !isVideo) {
        errors.push(`Unsupported file type: ${f.name}`);
        continue;
      }
      if (isPhoto && f.size > 10 * 1024 * 1024) {
        errors.push(`Photo exceeds 10MB: ${f.name}`);
      }
      if (isVideo && f.size > 100 * 1024 * 1024) {
        errors.push(`Video exceeds 100MB: ${f.name}`);
      }
    }
    return errors;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsUploading(true);
      let uploaded: { url: string; kind: "photo" | "video"; contentType: string }[] | null = null;

      // Handle File Uploads via Cloudinary
      if (files.length > 0) {
        const errs = validateFiles(files);
        if (errs.length) {
          toast.error(errs[0]);
          setIsUploading(false);
          return;
        }

        const fd = new FormData();
        for (const f of files) fd.append("files", f, f.name);
        const res = await authFetch("/uploads", { method: "POST", body: fd });
        
        if (!res.ok) {
          toast.error("Media upload failed. Check your Cloudinary configuration.");
          setIsUploading(false);
          return;
        }
        const data = await res.json();
        uploaded = data.files ?? [];
      }

      // Submit Post to Database
      createPost.mutate(
        { data: values },
        {
          onSuccess: async (created) => {
            try {
              if (uploaded && uploaded.length > 0) {
                await authFetch(`/posts/${created.id}/media`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    media: uploaded.map((u) => ({
                      url: u.url,
                      kind: u.kind,
                      contentType: u.contentType,
                    })),
                  }),
                });
              }

              queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
              toast.success("News reported successfully!");
              form.reset();
              setFiles([]);
              setLocation("/");
            } catch {
              toast.error("Post published, but attaching media failed.");
              setLocation("/");
            } finally {
              setIsUploading(false);
            }
          },
          onError: () => {
            toast.error("Failed to post news. Please try again.");
            setIsUploading(false);
          },
        },
      );
    } catch {
      toast.error("Failed to process submission.");
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row w-full max-w-5xl mx-auto p-4 sm:p-6 gap-8">
      <div className="flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">Report News</h1>
          <p className="text-zinc-400">Share what's happening in your locality with the community.</p>
        </div>

        <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 relative">
              
              <FormField
                control={form.control}
                name="headline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Headline</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g. Main water pipe burst near Palasia Square" className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/50" {...field} />
                    </FormControl>
                    <FormMessage className="text-rose-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide more context, specific locations, or times..." 
                        className="min-h-[120px] bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 resize-none focus-visible:ring-emerald-500/50" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-rose-500" />
                  </FormItem>
                )}
              />

              {/* AI Status Indicator */}
              <div className="text-xs flex items-center min-h-[20px]">
                {scan.status === "scanning" && (
                  <span className="text-blue-400 flex items-center gap-1.5 animate-pulse"><Sparkles className="w-3 h-3" /> AI reviewing for clarity...</span>
                )}
                {scan.status === "blocked" && (
                  <span className="text-rose-500 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Blocked: {scan.verdict}</span>
                )}
                {scan.status === "ready" && (
                  <span className="text-emerald-500 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> AI verified (Score: {scan.sensationalismScore}/10)</span>
                )}
                {scan.status === "unavailable" && (
                  <span className="text-zinc-500 flex items-center gap-1.5">AI assistant temporarily offline. Proceed manually.</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500/50">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectItem value="infrastructure">Infrastructure</SelectItem>
                          <SelectItem value="crime">Crime</SelectItem>
                          <SelectItem value="politics">Politics</SelectItem>
                          <SelectItem value="event">Events</SelectItem>
                          <SelectItem value="health">Health</SelectItem>
                          <SelectItem value="weather">Weather</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-rose-500" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Locality</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-emerald-500/50" {...field} />
                          <Button
                            type="button"
                            variant="outline"
                            className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-emerald-400"
                            disabled={isLocating}
                            onClick={async () => {
                              if (!navigator.geolocation) return toast.error("GPS is not available in this browser.");
                              setIsLocating(true);
                              navigator.geolocation.getCurrentPosition(
                                async (pos) => {
                                  try {
                                    const { latitude, longitude } = pos.coords;
                                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
                                    if (!res.ok) throw new Error("Fetch failed");
                                    const data = await res.json();
                                    const locality = data?.address?.suburb || data?.address?.neighbourhood || data?.address?.city || "Unknown Zone";
                                    form.setValue("neighborhood", String(locality));
                                    toast.success("Location securely detected.");
                                  } catch {
                                    toast.error("Could not resolve your GPS location.");
                                  } finally {
                                    setIsLocating(false);
                                  }
                                },
                                () => {
                                  toast.error("GPS denied. Please enter locality manually.");
                                  setIsLocating(false);
                                },
                                { enableHighAccuracy: true, timeout: 10000 },
                              );
                            }}
                          >
                            {isLocating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MapPin className="w-4 h-4 mr-1" />}
                            GPS
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-rose-500" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-zinc-300">Media Evidence (Optional)</div>
                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-xs text-zinc-400 hover:text-rose-400 inline-flex items-center gap-1 transition-colors"
                    >
                      <X className="w-3 h-3" /> Clear Media
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all">
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-zinc-700 bg-zinc-950/40 px-4 py-8 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all">
                    <Upload className="w-6 h-6 mb-1" />
                    <span className="text-sm font-medium">Click to upload photos or videos</span>
                    <span className="text-xs text-zinc-600">JPG, PNG, WEBP (Max 10MB) • MP4 (Max 100MB)</span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    />
                  </label>

                  {previews.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {previews.map((p) => (
                        <div key={`${p.file.name}-${p.file.size}`} className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden relative group">
                          {p.url ? (
                            <img src={p.url} alt="" className="w-full h-24 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="w-full h-24 flex items-center justify-center text-zinc-500 bg-zinc-900">
                              {p.kind === "video" ? <Video className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-zinc-950/90 to-transparent p-2 pt-6 text-[10px] text-zinc-300 truncate">
                            {p.file.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="isBreaking"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-zinc-100 flex items-center gap-2">
                        Mark as Breaking News <AlertTriangle className="w-4 h-4 text-rose-500" />
                      </FormLabel>
                      <p className="text-sm text-zinc-500">
                        Only use this for active, unfolding situations in your locality.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-rose-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 text-lg rounded-xl shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-all"
                // FIX: Added graceful fallback for when AI is unavailable
                disabled={createPost.isPending || isUploading || scan.status === "scanning" || scan.status === "blocked"}
              >
                {createPost.isPending || isUploading ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Submitting to network...</span>
                ) : (
                  "Publish Report"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>

      <div className="hidden md:block w-72 shrink-0">
        <div className="sticky top-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6 shadow-lg">
            <h3 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" /> Verification Process
            </h3>
            <ul className="space-y-6 relative before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-zinc-800">
              <li className="relative pl-8">
                <div className="absolute left-0 top-1 w-6 h-6 bg-zinc-950 border border-zinc-700 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-400">1</div>
                <p className="text-sm text-zinc-400 leading-snug"><strong className="text-zinc-200">Submit</strong><br/>Your post goes live immediately to locals in your zone.</p>
              </li>
              <li className="relative pl-8">
                <div className="absolute left-0 top-1 w-6 h-6 bg-zinc-950 border border-orange-500/50 rounded-full flex items-center justify-center text-[10px] font-bold text-orange-500">2</div>
                <p className="text-sm text-zinc-400 leading-snug"><strong className="text-zinc-200">Community Check</strong><br/>Neighbors verify your claim by upvoting or commenting.</p>
              </li>
              <li className="relative pl-8">
                <div className="absolute left-0 top-1 w-6 h-6 bg-zinc-950 border border-emerald-500/50 rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-500">3</div>
                <p className="text-sm text-zinc-400 leading-snug"><strong className="text-zinc-200">Verified Rank</strong><br/>Verified reporters gain platform authority and priority reach.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}