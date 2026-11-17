import { z } from "zod";
import { githubReleaseChannel } from "#shared/appReleaseChannels.js";
import type { DownloadableApp } from "#shared/schema/downloads.js";

const TEN_MINUTES = 10 * 60_000;
const releaseSchema = z.object({
  tag_name: z.string().min(1).max(40), draft: z.literal(false), prerelease: z.literal(false),
  assets: z.array(z.object({ name: z.string().max(200), browser_download_url: z.string().url().max(2000), state: z.string(), digest: z.string().nullable().optional() })).max(200),
});
type Release = z.infer<typeof releaseSchema>;
type Cached = { data?: Release; expiresAt: number; pending?: Promise<Release | undefined> };

export function createAppReleaseResolver({ request = fetch, now = Date.now, ttlMs = TEN_MINUTES }: { request?: typeof fetch; now?: () => number; ttlMs?: number } = {}) {
  const cache = new Map<string, Cached>();
  const lastAssets = new Map<string, { version: string; downloadUrl: string; sha256?: string }>();
  async function latest(repository: string): Promise<Release | undefined> {
    const entry: Cached = cache.get(repository) ?? { expiresAt: 0 };
    if (entry.pending) return entry.pending;
    if (entry.expiresAt > now()) return entry.data;
    const pending = (async () => {
      await Promise.resolve();
      try {
        const response = await request(`https://api.github.com/repos/Skale-Club/${repository}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "SkaleClub-AppDownloads", "X-GitHub-Api-Version": "2026-03-10" },
          signal: AbortSignal.timeout(4_000), redirect: "error",
        });
        if (response.ok) {
          const parsed = releaseSchema.safeParse(await response.json());
          if (parsed.success && /^v?\d+\.\d+\.\d+(?:[.+-][0-9A-Za-z.-]+)?$/.test(parsed.data.tag_name)) entry.data = parsed.data;
        }
      } catch { /* Keep the last complete metadata, or the saved fallback. */ }
      finally { entry.expiresAt = now() + ttlMs; entry.pending = undefined; }
      return entry.data;
    })();
    entry.pending = pending;
    cache.set(repository, entry);
    return pending;
  }

  return async (app: DownloadableApp): Promise<DownloadableApp> => {
    if (!app.isPublished) return app;
    const releases = await Promise.all(app.releases.map(async (saved) => {
      const channel = saved.autoUpdate === false || !saved.isPublished ? undefined : githubReleaseChannel(app.slug, saved);
      if (!channel) return saved;
      const metadata = await latest(channel.repository);
      if (!metadata) return saved;
      const version = metadata.tag_name.replace(/^v/, "");
      const filename = channel.filename(version);
      const expected = `https://github.com/Skale-Club/${channel.repository}/releases/download/${metadata.tag_name}/${filename}`;
      const asset = metadata.assets.find((item) => item.name === filename && item.state === "uploaded" && item.browser_download_url === expected);
      const key = `${channel.repository}/${channel.filename("0.0.0")}`;
      if (asset) {
        const digest = asset.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1];
        lastAssets.set(key, { version, downloadUrl: asset.browser_download_url, ...(digest ? { sha256: digest } : {}) });
      }
      const resolved = lastAssets.get(key);
      if (!resolved) return saved;
      // Never carry the saved version's hash alongside a new binary.
      const { sha256: _oldHash, ...rest } = saved;
      return { ...rest, ...resolved };
    }));
    return { ...app, releases };
  };
}

export const resolveAppReleases = createAppReleaseResolver();
