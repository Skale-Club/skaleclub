import type { AppRelease } from "./schema/downloads.js";

type Channel = { slug: string; repository: string; filename: (version: string) => string };
export const APP_RELEASE_CHANNELS: readonly Channel[] = [
  ...["xnote", "xink", "xvert", "xpace"].map((slug) => ({ slug, repository: slug, filename: () => `${slug[0].toUpperCase()}${slug.slice(1)}.exe` })),
  { slug: "xdeck", repository: "xdeck", filename: () => "XdeckSetup.exe" },
  { slug: "xdeck", repository: "xdeck", filename: (version) => `Xdeck-${version}.zip` },
  ...["youtube", "youtube-music", "home-assistant"].map((variant) => ({ slug: "xtation", repository: "xtation-releases", filename: (version: string) => `${variant}_${version}_x64-setup.exe` })),
];

// Only the reviewed Windows x64 distribution slots follow GitHub. Other URLs
// remain manual, and the admin can pin any recognized slot with autoUpdate=false.
export function githubReleaseChannel(slug: string, release: Pick<AppRelease, "platform" | "architecture" | "version" | "downloadUrl">): Channel | undefined {
  if (release.platform !== "windows" || release.architecture !== "x64") return undefined;
  return APP_RELEASE_CHANNELS.find((channel) => channel.slug === slug &&
    release.downloadUrl === `https://github.com/Skale-Club/${channel.repository}/releases/download/v${release.version}/${channel.filename(release.version)}`);
}
