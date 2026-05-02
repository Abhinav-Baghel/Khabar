import { Redirect, useLocation } from "wouter";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Radio } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [location] = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Radio className="w-8 h-8 animate-pulse text-emerald-500" />
          <span className="text-sm">Loading Khabar...</span>
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    const next = encodeURIComponent(location || "/");
    return <Redirect to={`/login?next=${next}`} />;
  }

  // Enforce verification: email always, phone only if provided.
  if (status === "authenticated" && user) {
    const needsPhone = !!user.phoneNumber;
    const unverified =
      !user.isEmailVerified || (needsPhone && !user.isPhoneVerified);
    const onVerifyPage = (location || "").startsWith("/verify");
    if (unverified && !onVerifyPage) {
      return <Redirect to="/verify" />;
    }
  }

  return <>{children}</>;
}
