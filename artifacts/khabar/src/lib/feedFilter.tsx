import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type FeedFilterContextValue = {
  locality: string | null;
  setLocality: (locality: string | null) => void;
  clear: () => void;
};

const FeedFilterContext = createContext<FeedFilterContextValue | undefined>(undefined);

export function FeedFilterProvider({ children }: { children: ReactNode }) {
  const [locality, setLocalityState] = useState<string | null>(null);

  const value = useMemo<FeedFilterContextValue>(
    () => ({
      locality,
      setLocality: (l) => setLocalityState(l && l.trim() ? l.trim() : null),
      clear: () => setLocalityState(null),
    }),
    [locality],
  );

  return <FeedFilterContext.Provider value={value}>{children}</FeedFilterContext.Provider>;
}

export function useFeedFilter(): FeedFilterContextValue {
  const ctx = useContext(FeedFilterContext);
  if (!ctx) throw new Error("useFeedFilter must be used within <FeedFilterProvider>");
  return ctx;
}

