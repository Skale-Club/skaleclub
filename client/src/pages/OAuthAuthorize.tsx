import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/hooks/use-seo";

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
  usePageSeo({ title: "Authorize access", noindex: true });

  const [, navigate] = useLocation();
  const [params] = useState(parseParams);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // undefined while checking; the Express admin session decides who may authorize.
  const [admin, setAdmin] = useState<{ isAdmin: boolean; email: string | null } | undefined>();

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => active && setAdmin({ isAdmin: Boolean(data.isAdmin), email: data.email ?? null }))
      .catch(() => active && setAdmin({ isAdmin: false, email: null }));
    return () => {
      active = false;
    };
  }, []);

  // Sign-in lives on /admin/login; it brings the person back here afterwards.
  function goToSignIn() {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/admin/login?next=${encodeURIComponent(next)}`);
  }

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
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });

      const json = await res.json();

      if (res.status === 401) {
        goToSignIn();
        return;
      }

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
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 rounded-xl flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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

        {/* Authorization: uses the signed-in admin session */}
        {admin === undefined ? (
          <p className="text-center text-sm text-zinc-500">Verificando sessão…</p>
        ) : !admin.isAdmin ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400 text-center">
              Entre com a sua conta de administrador para autorizar o acesso.
            </p>
            <Button
              type="button"
              onClick={goToSignIn}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Entrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {admin.email && (
              <p className="text-center text-sm text-zinc-400">
                Conectado como <span className="text-white font-medium">{admin.email}</span>
              </p>
            )}

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {loading ? "Autorizando…" : "Autorizar Claude"}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-zinc-600">
          Ao autorizar, um token de acesso será gerado e vinculado à sua conta.
        </p>
      </div>
    </div>
  );
}
