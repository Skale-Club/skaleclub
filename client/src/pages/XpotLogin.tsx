import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Mail, MapPinned, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { initSupabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
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

export default function XpotLogin() {
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
  const companyLogo = companySettings?.logoIcon || "";

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const response = await fetch("/api/supabase-config");
      const config = await response.json();
      const hasSupabase = Boolean(config.url && config.anonKey);
      if (mounted) {
        setIsSupabaseAuth(hasSupabase);
      }

      // Check existing server session first
      const user = await getCurrentUser();
      if (mounted && user) {
        queryClient.removeQueries({ queryKey: ["/api/xpot/me"] });
        setLocation("/xpot");
        return;
      }

      // After Google OAuth redirect, Supabase sets a browser session from the URL hash
      // but there's no server session yet — exchange it now.
      if (hasSupabase) {
        try {
          const supabase = await initSupabase();
          const { data } = await supabase.auth.getSession();
          const accessToken = data.session?.access_token;

          if (accessToken) {
            const loginResponse = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ accessToken }),
            });

            if (mounted && loginResponse.ok) {
              queryClient.removeQueries({ queryKey: ["/api/xpot/me"] });
              setLocation("/xpot");
            } else if (mounted) {
              const result = await loginResponse.json().catch(() => ({}));
              setError(result.message || "Sign-in failed. Please try again.");
            }
          }
        } catch (err: any) {
          if (mounted) setError(err.message || "Sign-in failed. Please try again.");
        }
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

      queryClient.removeQueries({ queryKey: ["/api/xpot/me"] });
      setLocation("/xpot");
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
          redirectTo: `${getCanonicalOrigin()}/xpot/login`,
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
    <main className="min-h-screen bg-background text-foreground px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>

        <Card className="w-full rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="px-5 pb-4 pt-7 text-center md:px-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center overflow-hidden">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Logo"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <MapPinned className={`h-6 w-6 text-primary ${companyLogo ? 'hidden' : ''}`} />
            </div>
            <CardTitle className="text-2xl leading-none tracking-tight text-card-foreground">
              {companySettings?.companyName || 'Xpot'}
            </CardTitle>
            <CardDescription className="pt-2 text-base text-muted-foreground">
              Sign in to access the Xpot workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-7 md:px-6">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {isSupabaseAuth ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={googleSubmitting}
                  className="h-12 w-full"
                >
                  {googleSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <img src={googleLogoUrl} alt="" aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  Continue with Google
                </Button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">or continue with</div>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="xpot-email" className="text-base font-medium">Email</Label>      
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="xpot-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="rep@example.com"
                        className="h-12 bg-background pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="xpot-password" className="text-base font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="xpot-password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="*****"
                        className="h-12 bg-background pl-10 text-base"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={submitting} className="h-12 w-full">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In
                  </Button>
                </form>
                <p className="text-center text-sm text-muted-foreground">
                  Are you an administrator?{' '}
                  <button
                    type="button"
                    onClick={() => setLocation('/admin/login')}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in to Admin
                  </button>
                </p>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => { window.location.href = "/api/login"; }}
                className="h-12 w-full"
              >
                Continue with Google
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );}
