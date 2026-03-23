import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Mail, MapPinned, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { initSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getCurrentUser() {
  const response = await fetch("/api/auth/user", { credentials: "include" });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function getCanonicalOrigin() {
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
  if (hostname.endsWith(".vercel.app")) return "https://skale.club";
  return origin;
}

export default function FieldLogin() {
  const [, setLocation] = useLocation();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [isSupabaseAuth, setIsSupabaseAuth] = useState(false);
  const googleLogoUrl = "https://commons.wikimedia.org/wiki/Special:FilePath/Google_Favicon_2025.svg";
  const companyLogo = companySettings?.logoDark || companySettings?.logoMain || companySettings?.logoIcon || "";

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const response = await fetch("/api/supabase-config");
      const config = await response.json();
      if (mounted) {
        setIsSupabaseAuth(Boolean(config.url && config.anonKey));
      }

      const user = await getCurrentUser();
      if (mounted && user) {
        setLocation("/checkin");
      }
    }

    void initialize();
    return () => {
      mounted = false;
    };
  }, [setLocation]);

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (!isSupabaseAuth) {
        window.location.href = "/api/login";
        return;
      }

      const supabase = await initSupabase();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("No access token returned");
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: "Login failed" }));
        throw new Error(result.message || "Login failed");
      }

      setLocation("/checkin");
    } catch (loginError: any) {
      setError(loginError.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleSubmitting(true);

    try {
      if (!isSupabaseAuth) {
        window.location.href = "/api/login";
        return;
      }

      const supabase = await initSupabase();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getCanonicalOrigin()}/checkin/login`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (loginError: any) {
      setError(loginError.message || "Login failed");
      setGoogleSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070b12] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>

        <Card className="border border-white/10 bg-white/5 text-white shadow-2xl shadow-black/30 backdrop-blur">
          <CardHeader className="space-y-3 text-center">
            {companyLogo ? (
              <div className="mx-auto">
                <img 
                  src={companyLogo} 
                  alt="Company Logo" 
                  className="mx-auto max-h-16 object-contain"
                />
              </div>
            ) : (
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
                <MapPinned className="h-6 w-6 text-primary" />
              </div>
            )}
            <CardTitle className="text-2xl">Check In</CardTitle>
            <CardDescription className="text-white/60">
              Sign in to access the Check In workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <p className="text-center text-sm text-white/50">
              Are you an administrator?{' '}
              <button
                type="button"
                onClick={() => setLocation('/admin/login')}
                className="font-medium text-primary hover:underline"
              >
                Sign in to Admin
              </button>
            </p>

            {isSupabaseAuth ? (
              <>
                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleSubmitting}
                  className="h-12 w-full bg-white text-slate-900 hover:bg-slate-100"
                >
                  {googleSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <img src={googleLogoUrl} alt="" aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  Continue with Google
                </Button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs uppercase tracking-[0.24em] text-white/40">or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="field-email" className="text-white/80">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        id="field-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="rep@example.com"
                        className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="field-password" className="text-white/80">Password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        id="field-password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="********"
                        className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting} className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In
                  </Button>
                </form>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => { window.location.href = "/api/login"; }}
                className="h-12 w-full bg-white text-slate-900 hover:bg-slate-100"
              >
                Continue with Google
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}