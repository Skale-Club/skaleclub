import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, ArrowUpRight, Monitor } from "lucide-react";
import { Link, useRoute } from "wouter";
import { usePageSeo } from "@/hooks/use-seo";
import type { PublicDownloadableApp } from "@shared/schema/downloads";
import { fetchJson, HttpError } from "@/lib/queryClient";
import { LanguageContext } from "@/context/LanguageContext";
import { AppLanding } from "@/components/downloads/AppLanding";
import { getAppLanding } from "@shared/appLandings";

const labels = {
  en: { title: "Apps", subtitle: "Small tools. Useful every day.", empty: "Our apps are being prepared.", loading: "Loading apps…", error: "Could not load the apps. Please try again.", back: "All apps", free: "Free", notFound: "App not found.", learnMore: "Explore" },
  pt: { title: "Aplicativos", subtitle: "Ferramentas simples para o dia a dia.", empty: "Estamos preparando nossos aplicativos.", loading: "Carregando aplicativos…", error: "Não foi possível carregar os aplicativos. Tente novamente.", back: "Todos os aplicativos", free: "Grátis", notFound: "Aplicativo não encontrado.", learnMore: "Conhecer" },
};

export default function Downloads() {
  const language = useContext(LanguageContext)?.language ?? "en";
  const text = labels[language];
  const [, params] = useRoute("/downloads/:slug");
  const slug = params?.slug;
  const indexQuery = useQuery<PublicDownloadableApp[]>({ queryKey: ["/api/downloadable-apps"], retry: false, enabled: !slug });
  const detailQuery = useQuery<PublicDownloadableApp>({
    queryKey: ["/api/downloadable-apps", slug],
    queryFn: () => fetchJson<PublicDownloadableApp>(`/api/downloadable-apps/${encodeURIComponent(slug!)}`),
    retry: false, enabled: Boolean(slug),
  });
  const loading = slug ? detailQuery.isLoading : indexQuery.isLoading;
  const error = slug ? detailQuery.isError : indexQuery.isError;
  const editorial = slug ? getAppLanding(slug, language) : undefined;
  const missing = Boolean(slug && detailQuery.error instanceof HttpError && detailQuery.error.status === 404);
  usePageSeo({
    title: slug ? (editorial?.seo.title ?? detailQuery.data?.name ?? text.title) : text.title,
    description: slug ? (editorial?.seo.description ?? detailQuery.data?.tagline) : text.subtitle,
    noindex: Boolean(slug && error),
  });

  if (loading || error) return (
    <div className="min-h-[60vh] bg-navy-950 px-4 pb-20 pt-40 text-center text-fog-300" role={error ? "alert" : undefined} aria-live="polite">
      <p>{loading ? text.loading : missing ? text.notFound : text.error}</p>
      {missing && <Link href="/downloads" className="mt-5 inline-block text-cta-soft underline">{text.back}</Link>}
    </div>
  );
  if (slug && detailQuery.data) return <AppLanding app={detailQuery.data} language={language} />;

  return (
    <div className="bg-navy-950 text-fog-50">
      <div className="container-custom mx-auto max-w-6xl px-4 pb-16 pt-36 sm:px-6 md:pb-24 md:pt-44">
        <header className="mb-10 max-w-2xl">
          <p className="text-sm font-semibold text-cta-soft">Skale Club</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{text.title}</h1>
          <p className="mt-4 text-lg text-fog-300">{text.subtitle}</p>
        </header>
        {!indexQuery.data?.length ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-fog-400" data-testid="downloads-empty">{text.empty}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="downloads-catalog">
            {indexQuery.data.map((app) => {
              const copy = getAppLanding(app.slug, language);
              const Icon = app.slug === "xtation" ? AppWindow : Monitor;
              return (
                <article key={app.id} className="flex flex-col rounded-2xl border border-white/10 bg-navy-900 p-6" data-testid="download-app-card">
                  <div className="flex items-center justify-between gap-3">
                    {copy && app.slug !== "xtation" ? <img src={`/apps/${app.slug}/logo.png`} alt="" className="h-12 w-12 object-contain" width={48} height={48} loading="lazy" /> : <Icon className="h-10 w-10 text-cta-soft" aria-hidden="true" />}
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-fog-300">{text.free}</span>
                  </div>
                  <h2 className="mt-5 font-display text-2xl font-semibold">{app.name}</h2>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-fog-300">{copy?.intro ?? app.tagline}</p>
                  <Link href={`/downloads/${app.slug}`} className="mt-auto flex min-h-11 items-center justify-between gap-2 pt-6 text-sm font-semibold text-cta-soft transition hover:text-fog-50" data-testid="download-app-link">
                    {text.learnMore}<ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
