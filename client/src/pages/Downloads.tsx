import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Monitor, Smartphone, ArrowLeft, Check, Package } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import { usePageSeo } from "@/hooks/use-seo";
import type { PublicDownloadableApp } from "@shared/schema/downloads";
import { appDownloadPath } from "@shared/downloads";
import { fetchJson, HttpError } from "@/lib/queryClient";
import { LanguageContext } from "@/context/LanguageContext";
import { languageHref } from "@/lib/languageRouting";

const copy = {
  title: "Free app downloads",
  subtitle: "Explore free apps for desktop and mobile.",
  empty: "No apps are available to download yet.",
  loading: "Loading apps…",
  error: "Apps could not be loaded. Please try again.",
  back: "All downloads",
  free: "Free",
  features: "What it does",
  releases: "Downloads",
  requirements: "Requirements",
  notes: "Release notes",
  checksum: "SHA-256",
  download: "Download",
  notFound: "This app could not be found.",
  noReleases: "There are no published downloads for this app yet.",
  learnMore: "Learn more",
  version: "Version",
};
const copyPt: Record<keyof typeof copy, string> = {
  title: "Aplicativos grátis para baixar", subtitle: "Conheça aplicativos gratuitos para computador e celular.",
  empty: "Ainda não há aplicativos disponíveis para baixar.", loading: "Carregando aplicativos…",
  error: "Não foi possível carregar os aplicativos. Tente novamente.", back: "Todos os downloads", free: "Grátis",
  features: "O que ele faz", releases: "Downloads", requirements: "Requisitos", notes: "Notas da versão",
  checksum: "SHA-256", download: "Baixar", notFound: "Não foi possível encontrar este aplicativo.",
  noReleases: "Ainda não há downloads publicados para este aplicativo.",
  learnMore: "Saiba mais", version: "Versão",
};

const platformNames: Record<string, string> = {
  windows: "Windows", macos: "macOS", linux: "Linux", android: "Android", ios: "iOS",
};
const architectureNames: Record<string, string> = { x64: "x64", arm64: "ARM64", universal: "Universal" };

function useCopy() {
  const { t } = useTranslation();
  const language = useContext(LanguageContext)?.language;
  return (key: keyof typeof copy) => language === "pt" ? copyPt[key] : t(copy[key]);
}

function DownloadButton({ app, release }: { app: PublicDownloadableApp; release: PublicDownloadableApp["releases"][number] }) {
  const label = useCopy();
  return (
    <a href={appDownloadPath(app.slug, release.id)} data-testid="download-release" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
      <Download aria-hidden="true" className="h-4 w-4" />{label("download")} · {platformNames[release.platform] ?? release.platform} {release.version}
    </a>
  );
}

function AppDetails({ app }: { app: PublicDownloadableApp }) {
  const label = useCopy();
  const published = app.releases.filter((release) => release.isPublished);
  return (
    <main className="container-custom mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-20">
      <Link href={languageHref("/downloads")} className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden="true" className="h-4 w-4" />{label("back")}</Link>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10" data-testid="download-app-detail">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"><Check aria-hidden="true" className="h-4 w-4" />{label("free")}</p><h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{app.name}</h1><p className="mt-3 max-w-2xl text-lg text-muted-foreground">{app.tagline}</p></div>
          <Package aria-hidden="true" className="hidden h-12 w-12 shrink-0 text-primary sm:block" />
        </div>
        <p className="mt-8 whitespace-pre-line leading-7 text-foreground/85">{app.description}</p>
        {app.features.length > 0 && <section className="mt-10"><h2 className="text-xl font-semibold">{label("features")}</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{app.features.map((feature, index) => <li key={`${index}-${feature}`} className="flex gap-3 rounded-xl bg-muted/50 p-4"><Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul></section>}
        <section className="mt-10"><h2 className="text-xl font-semibold">{label("releases")}</h2>{published.length === 0 ? <p className="mt-4 rounded-xl bg-muted/50 p-5 text-muted-foreground">{label("noReleases")}</p> : <div className="mt-4 grid gap-4">{published.map((release) => <article key={release.id} className="rounded-2xl border border-border p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="font-semibold">{platformNames[release.platform] ?? release.platform} · {architectureNames[release.architecture] ?? release.architecture}</h3><p className="mt-1 text-sm text-muted-foreground">{label("version")} {release.version}</p>{release.requirements && <p className="mt-3 text-sm"><span className="font-medium">{label("requirements")}: </span>{release.requirements}</p>}</div><DownloadButton app={app} release={release} /></div>
          {release.notes && <div className="mt-4 border-t border-border pt-4"><h4 className="text-sm font-semibold">{label("notes")}</h4><p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{release.notes}</p></div>}
          {release.sha256 && <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{label("checksum")}: {release.sha256}</p>}
        </article>)}</div>}</section>
      </div>
    </main>
  );
}

export default function Downloads() {
  const label = useCopy();
  const [, params] = useRoute("/downloads/:slug");
  const slug = params?.slug;
  const indexQuery = useQuery<PublicDownloadableApp[]>({ queryKey: ["/api/downloadable-apps"], retry: false, enabled: !slug });
  const detailQuery = useQuery<PublicDownloadableApp>({
    queryKey: ["/api/downloadable-apps", slug],
    queryFn: () => fetchJson<PublicDownloadableApp>(`/api/downloadable-apps/${encodeURIComponent(slug!)}`),
    retry: false,
    enabled: Boolean(slug),
  });
  const apps = indexQuery.data;
  const isLoading = slug ? detailQuery.isLoading : indexQuery.isLoading;
  const isError = slug ? detailQuery.isError : indexQuery.isError;
  usePageSeo({ title: slug ? (detailQuery.data?.name ?? "Downloads") : label("title"), description: slug ? detailQuery.data?.tagline : label("subtitle"), noindex: Boolean(slug && isError) });

  if (isLoading) return <main className="container-custom mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground" aria-live="polite">{label("loading")}</main>;
  if (slug && detailQuery.error instanceof HttpError && detailQuery.error.status === 404) return <main className="container-custom mx-auto max-w-5xl px-4 py-16 text-center"><p>{label("notFound")}</p><Link href={languageHref("/downloads")} className="mt-4 inline-block text-primary underline">{label("back")}</Link></main>;
  if (isError) return <main className="container-custom mx-auto max-w-5xl px-4 py-16 text-center text-destructive" role="alert">{label("error")}</main>;
  if (slug) {
    const app = detailQuery.data;
    return app ? <AppDetails app={app} /> : <main className="container-custom mx-auto max-w-5xl px-4 py-16 text-center"><p>{label("notFound")}</p><Link href={languageHref("/downloads")} className="mt-4 inline-block text-primary underline">{label("back")}</Link></main>;
  }
  return (
    <main className="container-custom mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-20">
      <header className="mx-auto mb-10 max-w-3xl text-center"><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"><Download aria-hidden="true" className="h-4 w-4" />{label("free")}</span><h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">{label("title")}</h1><p className="mt-4 text-lg text-muted-foreground">{label("subtitle")}</p></header>
      {!apps?.length ? <p className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-muted-foreground" data-testid="downloads-empty">{label("empty")}</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="downloads-catalog">{apps.map((app) => <article key={app.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" data-testid="download-app-card"><div className="flex items-start justify-between gap-3"><div><span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><Check aria-hidden="true" className="h-3.5 w-3.5" />{label("free")}</span><h2 className="mt-3 text-2xl font-bold">{app.name}</h2></div>{app.releases.some((r) => r.platform === "android" || r.platform === "ios") ? <Smartphone aria-hidden="true" className="h-6 w-6 text-muted-foreground" /> : <Monitor aria-hidden="true" className="h-6 w-6 text-muted-foreground" />}</div><p className="mt-2 text-muted-foreground">{app.tagline}</p><p className="mt-4 line-clamp-3 text-sm leading-6">{app.description}</p><p className="mt-auto pt-6 text-sm text-muted-foreground">{app.releases.length} {label("releases").toLowerCase()}</p><Link href={languageHref(`/downloads/${app.slug}`)} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted" data-testid="download-app-link">{label("learnMore")}</Link></article>)}</div>}
    </main>
  );
}
