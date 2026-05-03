import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Radio, Loader2 } from "lucide-react";
import type { CurrentUser } from "@workspace/api-zod";
import { authFetch, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={props.className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.73 1.22 9.25 3.6l6.9-6.9C36.02 2.38 30.36 0 24 0 14.64 0 6.63 5.38 2.68 13.22l8.06 6.26C12.62 13.55 17.86 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.92-2.19 5.39-4.64 7.05l7.1 5.5c4.15-3.84 7.34-9.5 7.34-16.8z"
      />
      <path
        fill="#FBBC05"
        d="M10.74 28.26c-.5-1.48-.78-3.06-.78-4.76s.28-3.28.78-4.76l-8.06-6.26C.92 15.47 0 19.61 0 23.5c0 3.89.92 8.03 2.68 11.52l8.06-6.76z"
      />
      <path
        fill="#34A853"
        d="M24 47c6.36 0 11.7-2.1 15.6-5.7l-7.1-5.5c-1.97 1.32-4.5 2.1-8.5 2.1-6.14 0-11.38-4.05-13.26-9.48l-8.06 6.76C6.63 41.62 14.64 47 24 47z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

export default function Login() {
  const { setUser } = useAuth();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Login failed");
      }
      const user = (await res.json()) as CurrentUser;
      setUser(user);
      const needsPhone = !!user.phoneNumber;
      const unverified = !user.isEmailVerified || (needsPhone && !user.isPhoneVerified);
      navigate(unverified ? "/verify" : next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Radio className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold tracking-tight">Khabar</span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-500 mb-6">Sign in to file and verify hyperlocal news.</p>

          <Button
            variant="outline"
            className="w-full border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
            asChild
          >
            <a
              href={`/api/auth/google?next=${encodeURIComponent(next)}`}
              data-testid="button-google-login"
            >
              <GoogleIcon className="h-5 w-5 mr-2" />
              Continue with Google
            </a>
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <div className="text-xs text-zinc-500">or</div>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="form-login">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                data-testid="input-password"
              />
            </div>

            {error && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2" data-testid="text-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-login"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-sm text-zinc-500 text-center mt-6">
            New to Khabar?{" "}
            <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
