/**
 * Cross-platform wrapper: downloads gitleaks if needed, then scans the repo
 * with the project's .gitleaks.toml config. Run via `npm run secrets:scan`.
 *
 * The binary is cached under `node_modules/.bin/.gitleaks-cache/` so subsequent
 * runs reuse it. CI uses the workflow at .github/workflows/gitleaks.yml — this
 * script is for local developer ergonomics only.
 */
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, chmodSync } from "node:fs";
import { tmpdir, arch, platform } from "node:os";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const GITLEAKS_VERSION = "8.30.1";

function platformAsset(): { url: string; binaryName: string; archive: "zip" | "tar.gz" } {
  const a = arch();
  const p = platform();
  const archMap: Record<string, string> = { x64: "x64", arm64: "arm64" };
  const arch_ = archMap[a];
  if (!arch_) throw new Error(`Unsupported architecture: ${a}`);

  if (p === "win32") {
    return {
      url: `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_windows_${arch_}.zip`,
      binaryName: "gitleaks.exe",
      archive: "zip",
    };
  }
  if (p === "linux") {
    return {
      url: `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${arch_}.tar.gz`,
      binaryName: "gitleaks",
      archive: "tar.gz",
    };
  }
  if (p === "darwin") {
    return {
      url: `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_darwin_${arch_}.tar.gz`,
      binaryName: "gitleaks",
      archive: "tar.gz",
    };
  }
  throw new Error(`Unsupported platform: ${p}`);
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  // @ts-expect-error — Node ReadableStream / web stream interop
  await pipeline(res.body, createWriteStream(dest));
}

async function ensureGitleaks(): Promise<string> {
  const cacheDir = resolve("node_modules", ".bin", ".gitleaks-cache");
  const { url, binaryName, archive } = platformAsset();
  const cachedBin = join(cacheDir, binaryName);

  if (existsSync(cachedBin)) return cachedBin;

  console.log(`Downloading gitleaks ${GITLEAKS_VERSION} for ${platform()}/${arch()}...`);
  mkdirSync(cacheDir, { recursive: true });
  const archivePath = join(tmpdir(), `gitleaks-${GITLEAKS_VERSION}.${archive}`);
  await downloadTo(url, archivePath);

  if (archive === "zip") {
    // Use PowerShell on Windows (no unzip in base shell).
    const result = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", `Expand-Archive -Force -Path "${archivePath}" -DestinationPath "${cacheDir}"`],
      { stdio: "inherit" },
    );
    if (result.status !== 0) throw new Error("Failed to extract zip archive");
  } else {
    const result = spawnSync("tar", ["-xzf", archivePath, "-C", cacheDir, binaryName], {
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error("Failed to extract tar.gz archive");
    chmodSync(cachedBin, 0o755);
  }

  if (!existsSync(cachedBin)) {
    throw new Error(`Binary missing after extraction: ${cachedBin}`);
  }
  return cachedBin;
}

async function main() {
  const bin = await ensureGitleaks();
  console.log(`Running gitleaks scan...\n`);
  const result = spawnSync(
    bin,
    [
      "detect",
      "--source", ".",
      "--config", ".gitleaks.toml",
      "--redact",
      "--verbose",
      "--no-banner",
    ],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(99);
});
