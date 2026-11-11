import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import type { CatalogItem } from "@shared/catalog";
import { platformSlug } from "@shared/platforms";
import { getPlatformLanding } from "@shared/platformLandings";
import { usePageSeo } from "@/hooks/use-seo";
import { fetchJson, HttpError } from "@/lib/queryClient";
import { LanguageContext } from "@/context/LanguageContext";
import { withLanguage } from "@shared/languagePath";
import { PlatformLanding } from "@/components/platforms/PlatformLanding";

const labels = {
  en: { title: "Platforms", loading: "Loading platform…", error: "Could not load this platform. Please try again.", missing: "Platform not found.", back: "All platforms" },
  pt: { title: "Plataformas", loading: "Carregando plataforma…", error: "Não foi possível carregar esta plataforma. Tente novamente.", missing: "Plataforma não encontrada.", back: "Todas as plataformas" },
};

export default function PlatformDetail() {
  const language = useContext(LanguageContext)?.language ?? "en";
  const text = labels[language];
  const [, params] = useRoute("/platforms/:slug");
  const slug = params?.slug ?? "";
  const query = useQuery<CatalogItem>({
    queryKey: ["/api/platforms", slug],
    queryFn: () => fetchJson<CatalogItem>(`/api/platforms/${encodeURIComponent(slug)}`),
    enabled: Boolean(slug), retry: false, staleTime: 60_000,
  });
  const editorial = getPlatformLanding(platformSlug(slug) ?? "", language);
  const missing = query.error instanceof HttpError && query.error.status === 404;
  usePageSeo({
    title: editorial?.seo.title ?? query.data?.title ?? text.title,
    description: editorial?.seo.description ?? query.data?.description ?? query.data?.subtitle,
    noindex: Boolean(query.isError),
  });

  if (query.isLoading || query.isError || !query.data) return (
    <div className="min-h-[60vh] bg-navy-950 px-4 pb-20 pt-[calc(var(--nav-offset,5rem)+5rem)] text-center text-fog-300" role={query.isError ? "alert" : undefined} aria-live="polite">
      <p>{query.isLoading ? text.loading : missing ? text.missing : text.error}</p>
      {missing && <Link href={withLanguage("/apps", language)} className="mt-5 inline-block text-cta-soft underline">{text.back}</Link>}
    </div>
  );

  return <PlatformLanding key={query.data.key} item={query.data} language={language} />;
}
