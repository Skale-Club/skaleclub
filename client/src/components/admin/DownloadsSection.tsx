import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import type { DownloadableApp, DownloadableAppInput, AppRelease } from "@shared/schema/downloads";
import { DOWNLOAD_ARCHITECTURES, DOWNLOAD_PLATFORMS } from "@shared/downloads";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "./shared";
import { Loader2 } from "@/components/ui/loader";

const emptyApp = (): DownloadableAppInput => ({ slug: "", name: "", tagline: "", description: "", features: [], releases: [], isPublished: false });
const emptyRelease = (): AppRelease => ({ id: "", platform: "windows", architecture: "x64", version: "1.0.0", downloadUrl: "https://", requirements: "", notes: "", isPublished: false });
const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function DownloadsSection() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DownloadableAppInput>(emptyApp);
  const [featuresText, setFeaturesText] = useState("");
  const queryKey = ["/api/admin/downloadable-apps"];
  const { data: apps, isLoading, isError } = useQuery<DownloadableApp[]>({ queryKey, retry: false });
  const save = useMutation({
    mutationFn: async (input: DownloadableAppInput) => {
      const response = selectedId
        ? await apiRequest("PUT", `/api/admin/downloadable-apps/${selectedId}`, input)
        : await apiRequest("POST", "/api/admin/downloadable-apps", input);
      return response.json() as Promise<DownloadableApp>;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/downloadable-apps"] });
      setSelectedId(saved.id);
      setForm(toInput(saved));
      setFeaturesText(saved.features.join("\n"));
      toast({ title: "Downloadable app saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save downloadable app", description: error.message, variant: "destructive" }),
  });

  const selectApp = (app: DownloadableApp) => { setSelectedId(app.id); setForm(toInput(app)); setFeaturesText((app.features ?? []).join("\n")); };
  const updateField = <K extends keyof DownloadableAppInput>(key: K, value: DownloadableAppInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateRelease = (index: number, patch: Partial<AppRelease>) => updateField("releases", form.releases.map((release, i) => i === index ? { ...release, ...patch } : release));

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return <div className="space-y-6">
    <SectionHeader title="Downloads" description="Manage free desktop and mobile app listings and releases." icon={<Download className="h-5 w-5" />} />
    {isError && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Could not load downloadable apps. Refresh the page to try again.</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(220px,0.65fr)_minmax(0,1.6fr)]" data-testid="downloads-admin">
      <aside className="space-y-3">
        <Button type="button" className="w-full" disabled={save.isPending} data-testid="downloads-new-app" onClick={() => { setSelectedId(null); setForm(emptyApp()); setFeaturesText(""); }}><Plus aria-hidden="true" className="mr-2 h-4 w-4" />New app</Button>
        {!isError && !apps?.length && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No apps yet. Create a draft to get started.</p>}
        {apps?.map((app) => <button key={app.id} type="button" disabled={save.isPending} onClick={() => selectApp(app)} className={`w-full rounded-xl border p-4 text-left transition hover:bg-muted/50 ${selectedId === app.id ? "border-primary bg-primary/5" : "border-border"}`} data-testid="downloads-select-app"><span className="block font-semibold">{app.name}</span><span className="mt-1 block text-sm text-muted-foreground">/{app.slug} · {app.isPublished ? "Published" : "Draft"}</span></button>)}
      </aside>
      <form className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7" data-testid="downloads-editor" onSubmit={(event) => { event.preventDefault(); save.mutate({ ...form, features: featuresText.split("\n").map((s) => s.trim()).filter(Boolean) }); }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{selectedId ? "Edit app" : "New downloadable app"}</h2><p className="mt-1 text-sm text-muted-foreground">App listing details and platform releases.</p></div><Button type="submit" disabled={save.isPending} data-testid="downloads-save-app"><Save aria-hidden="true" className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save app"}</Button></div>
        <fieldset disabled={save.isPending} className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input required maxLength={120} value={form.name} onChange={(e) => updateField("name", e.target.value)} /></Field>
          <Field label="URL slug"><Input required maxLength={80} pattern="[a-z][a-z0-9]*(?:-[a-z0-9]+)*" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} placeholder="my-app" /></Field>
          <Field label="Tagline" className="sm:col-span-2"><Input required maxLength={240} value={form.tagline} onChange={(e) => updateField("tagline", e.target.value)} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea required rows={5} maxLength={10000} value={form.description} onChange={(e) => updateField("description", e.target.value)} /></Field>
          <Field label="Features (one per line)" className="sm:col-span-2"><Textarea rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder="Fast and simple\nWorks offline" /></Field>
        </div>
        <section className="space-y-4 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Releases</h3><p className="text-sm text-muted-foreground">Each published release appears as a download option.</p></div><Button type="button" variant="outline" size="sm" onClick={() => updateField("releases", [...form.releases, emptyRelease()])}><Plus className="mr-1 h-4 w-4" />Add release</Button></div>
          {form.releases.map((release, index) => <fieldset key={index} className="min-w-0 space-y-4 rounded-xl border border-border p-4">
            <legend className="font-medium">Release {index + 1}</legend>
            <div className="flex justify-end"><Button type="button" size="icon" variant="ghost" aria-label="Remove release" onClick={() => updateField("releases", form.releases.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" /></Button></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Release ID"><Input required pattern="[a-z0-9][a-z0-9-]{0,79}" value={release.id} onChange={(e) => updateRelease(index, { id: e.target.value })} placeholder="windows-x64-1-0-0" /></Field>
              <Field label="Platform"><select className={fieldClass} value={release.platform} onChange={(e) => updateRelease(index, { platform: e.target.value as AppRelease["platform"] })}>{DOWNLOAD_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select></Field>
              <Field label="Architecture"><select className={fieldClass} value={release.architecture} onChange={(e) => updateRelease(index, { architecture: e.target.value as AppRelease["architecture"] })}>{DOWNLOAD_ARCHITECTURES.map((architecture) => <option key={architecture} value={architecture}>{architecture}</option>)}</select></Field>
              <Field label="Version"><Input required maxLength={40} value={release.version} onChange={(e) => updateRelease(index, { version: e.target.value })} placeholder="1.0.0" /></Field>
              <Field label="Public HTTPS download URL" className="sm:col-span-2"><Input required type="url" placeholder="https://…" value={release.downloadUrl === "https://" ? "" : release.downloadUrl} onChange={(e) => updateRelease(index, { downloadUrl: e.target.value })} /></Field>
              <Field label="System requirements" className="sm:col-span-2"><Input maxLength={500} value={release.requirements} onChange={(e) => updateRelease(index, { requirements: e.target.value })} /></Field>
              <Field label="SHA-256 (optional)" className="sm:col-span-2"><Input pattern="[a-fA-F0-9]{64}" maxLength={64} value={release.sha256 ?? ""} onChange={(e) => updateRelease(index, { sha256: e.target.value || undefined })} placeholder="64 hex characters" /></Field>
              <Field label="Release notes" className="sm:col-span-2 lg:col-span-3"><Textarea rows={3} maxLength={5000} value={release.notes} onChange={(e) => updateRelease(index, { notes: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={release.isPublished} onChange={(e) => updateRelease(index, { isPublished: e.target.checked })} />Publish this release</label>
            </div>
          </fieldset>)}
          {form.releases.length === 0 && <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">Add a release when an app build is ready to share.</p>}
        </section>
        <label className="flex items-center gap-3 rounded-xl border border-border p-4"><input type="checkbox" className="h-4 w-4" checked={form.isPublished} onChange={(e) => updateField("isPublished", e.target.checked)} /><span><span className="block font-medium">Publish app</span><span className="text-sm text-muted-foreground">Uncheck to hide the app while keeping its draft.</span></span></label>
        </fieldset>
      </form>
    </div>
  </div>;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block space-y-1.5 text-sm font-medium ${className}`}><span>{label}</span>{children}</label>;
}

function toInput(app: DownloadableApp): DownloadableAppInput {
  return { slug: app.slug, name: app.name, tagline: app.tagline, description: app.description, features: app.features ?? [], releases: app.releases ?? [], isPublished: app.isPublished };
}
