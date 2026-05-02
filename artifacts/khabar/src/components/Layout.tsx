import { Link, useLocation } from "wouter";
import {
  useListTrendingLocalities,
  useListTopReporters,
  getListTrendingLocalitiesQueryKey,
  getListTopReportersQueryKey,
} from "@workspace/api-client-react";
import { Home, Compass, PenSquare, Bookmark, User as UserIcon, LogOut, Radio } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth, API_BASE_URL } from "@/lib/auth";
import { FeedFilterProvider, useFeedFilter } from "@/lib/feedFilter";

function objectUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/storage${path}`;
}

function NavLinks() {
  const [location] = useLocation();
  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/post", label: "Post News", icon: PenSquare },
    { href: "/saved", label: "Saved", icon: Bookmark },
    { href: "/profile", label: "Profile", icon: UserIcon },
  ];

  return (
    <div className="flex flex-col space-y-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`flex items-center gap-4 px-4 py-3 rounded-full transition-colors ${
            location === link.href
              ? "bg-zinc-800 text-emerald-500 font-medium"
              : "hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <link.icon className="w-6 h-6" />
          <span className="hidden lg:inline text-lg">{link.label}</span>
        </Link>
      ))}
    </div>
  );
}

function RightSidebar() {
  const { locality: selectedLocality, setLocality, clear } = useFeedFilter();
  const { data: trending } = useListTrendingLocalities({
    query: { queryKey: getListTrendingLocalitiesQueryKey() },
  });
  const { data: reporters } = useListTopReporters(
    { limit: 5 },
    { query: { queryKey: getListTopReportersQueryKey({ limit: 5 }) } },
  );

  return (
    <div className="flex-col space-y-8 sticky top-0 h-screen overflow-y-auto py-6 px-4 hidden md:flex w-72 lg:w-80 border-l border-zinc-800">
      <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-zinc-100">Trending Localities</h3>
          {selectedLocality && (
            <button
              onClick={clear}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Clear locality filter"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {trending?.length ? (
            trending.map((locality) => (
              <button
                key={locality.neighborhood}
                onClick={() => setLocality(locality.neighborhood)}
                className={`px-3 py-1.5 transition-colors rounded-lg text-sm ${
                  selectedLocality === locality.neighborhood
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                }`}
              >
                <span className="text-emerald-500 mr-1">#</span>
                {locality.neighborhood}
                <span className="ml-2 text-xs text-zinc-500">
                  {locality.postCount}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-zinc-500">Be the first to file a report.</p>
          )}
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
        <h3 className="font-bold text-lg text-zinc-100 mb-4">Top Reporters</h3>
        <div className="flex flex-col space-y-4">
          {reporters?.length ? (
            reporters.map((reporter, index) => (
              <Link
                key={reporter.uid}
                href={`/u/${reporter.uid}`}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 font-mono text-sm">{index + 1}</span>
                  <Avatar className="w-8 h-8">
                    {reporter.photoUrl && (
                      <AvatarImage src={objectUrl(reporter.photoUrl)} alt={reporter.displayName} />
                    )}
                    <AvatarFallback className="bg-zinc-800 text-xs">
                      {reporter.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">
                      {reporter.displayName}
                    </span>
                    <span className="text-xs text-zinc-500">{reporter.locality}</span>
                  </div>
                </div>
                <span className="text-sm font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {reporter.currentReputationScore}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No reporters yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <FeedFilterProvider>
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex justify-center">
        <div className="w-full max-w-7xl flex relative">
          {/* Left Sidebar (Desktop) */}
          <div className="hidden md:flex flex-col w-20 lg:w-64 border-r border-zinc-800 h-screen sticky top-0 py-6 px-2 lg:px-4 shrink-0">
            <Link href="/" className="flex items-center gap-3 px-2 lg:px-4 mb-8">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/20">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <span className="hidden lg:inline text-2xl font-bold tracking-tight">Khabar</span>
            </Link>

            <NavLinks />

            {user && (
              <div className="mt-auto hidden lg:flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800" data-testid="user-pill">
                <Link href="/profile" className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="w-10 h-10">
                    {user.photoUrl && (
                      <AvatarImage src={objectUrl(user.photoUrl)} alt={user.displayName} />
                    )}
                    <AvatarFallback className="bg-emerald-900/50 text-emerald-500">
                      {user.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate">{user.displayName}</span>
                    <span className="text-xs text-zinc-500 truncate">@{user.username}</span>
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void logout()}
                  className="text-zinc-500 hover:text-rose-400 shrink-0"
                  title="Sign out"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Center Content */}
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <div className="max-w-2xl mx-auto min-h-screen border-x border-zinc-800/30">
              {children}
            </div>
          </main>

          {/* Right Sidebar (Desktop) */}
          <RightSidebar />

          {/* Mobile Bottom Nav */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 z-50 px-6 py-3 flex justify-between items-center pb-safe">
            <Link href="/" className="p-2 text-zinc-400 hover:text-emerald-400">
              <Home className="w-6 h-6" />
            </Link>
            <Link href="/explore" className="p-2 text-zinc-400 hover:text-emerald-400">
              <Compass className="w-6 h-6" />
            </Link>
            <Link
              href="/post"
              className="p-3 bg-emerald-600 text-white rounded-full -mt-8 shadow-lg shadow-emerald-900/20"
            >
              <PenSquare className="w-6 h-6" />
            </Link>
            <Link href="/saved" className="p-2 text-zinc-400 hover:text-emerald-400">
              <Bookmark className="w-6 h-6" />
            </Link>
            <Link href="/profile" className="p-2 text-zinc-400 hover:text-emerald-400">
              <UserIcon className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </div>
    </FeedFilterProvider>
  );
}
