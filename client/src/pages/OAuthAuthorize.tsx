import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { initSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function parseParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    client_id:             p.get("client_id") ?? "",
    redirect_uri:          p.get("redirect_uri") ?? "",
    state:                 p.get("state") ?? "",
    code_challenge:        p.get("code_challenge") ?? "",
    code_challenge_method: p.get("code_challenge_method") ?? "S256",
    scope:                 p.get("scope") ?? "mcp",
    response_type:         p.get("response_type") ?? "code",
  };
}

export default function OAuthAuthorize() {
  const [, navigate] = useLocation();
  const [params] = useState(parseParams);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If required params are missing, show error
  if (!params.redirect_uri || !params.code_challenge) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-red-400 text-sm">Parâmetros OAuth inválidos ou ausentes.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = await initSupabase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError || !data.session) {
        setError("Email ou senha incorretos.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: data.session.access_token,
          ...params,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message ?? "Erro ao autorizar.");
        setLoading(false);
        return;
      }

      window.location.href = json.redirect_to;
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[#FFFF01]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-white text-xl font-semibold">Autorizar acesso</h1>
          <p className="text-zinc-400 text-sm">
            <span className="text-white font-medium">Claude</span> está solicitando acesso ao{" "}
            <span className="text-white font-medium">Skale Club</span>
          </p>
        </div>

        {/* Permissions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Permissões solicitadas</p>
          <ul className="space-y-1.5">
            {[
              "Ler e criar Estimates",
              "Ler e criar Presentations",
            ].map(perm => (
              <li key={perm} className="flex items-center gap-2 text-sm text-zinc-300">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {perm}
              </li>
            ))}
          </ul>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">Email</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="bg-zinc-900 border-zinc-700 text-white"
              placeholder="admin@skale.club"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">Senha</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="bg-zinc-900 border-zinc-700 text-white"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFFF01] hover:bg-yellow-300 text-black font-bold rounded-full"
          >
            {loading ? "Autorizando…" : "Autorizar Claude"}
          </Button>
        </form>

        <p className="text-center text-xs text-zinc-600">
          Ao autorizar, um token de acesso será gerado e vinculado à sua conta.
        </p>
      </div>
    </div>
  );
}
