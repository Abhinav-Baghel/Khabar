import { ExternalLink, Globe, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export type NewsItem = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
  source: string | null;
  language: "en" | "hi" | "unknown";
};

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="p-4 sm:p-5 border-b border-zinc-800 bg-[#18181b] transition-colors hover:bg-zinc-900/80 group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-400 border-blue-500/20"
          >
            News Source
          </Badge>
          {item.source && (
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
              <Globe className="w-3 h-3 mr-1" />
              {item.source}
            </Badge>
          )}
          <span className="text-zinc-500 text-sm flex items-center gap-1">
            <Clock className="w-3 h-3" />{" "}
            {formatDistanceToNow(new Date(item.publishedAt))} ago
          </span>
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
          title="Open source"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <h2 className="text-xl font-bold text-zinc-100 mb-2 leading-snug">
        {item.title}
      </h2>

      {item.description && (
        <p className="text-zinc-400 text-sm mb-4 line-clamp-3 leading-relaxed">
          {item.description}
        </p>
      )}

      {item.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="w-full max-h-72 object-cover"
          />
        </div>
      )}
    </article>
  );
}

