# Application landing-page inventory

Reviewed: 2026-11-11. This is a proposed selection for the Apps catalog, not
approval to publish every project. Public naming remains Apps / Aplicativos for
installable tools and Platforms / Plataformas for online products.

## Scope and evidence

Listed 46 accessible Skale-Club GitHub repositories, then reviewed relevant
READMEs, manifests and release metadata. Also inspected the local projects under
`C:\Users\Vanildo\Dev`, including nested Xpot desktop utilities. The Surface does
not have Xnote, Xink, Xpace, Xvert or Xdeck cloned; GitHub provided the missing
product sources. Local `*-dev`, backups and worktree folders are not additional
products. Client websites and infrastructure repositories are not app candidates.

Release assets below were confirmed through GitHub's release API. No executable
was downloaded, run, tested or signature-verified. A published asset establishes
distribution availability, not product acceptance or Windows certification.

## Recommended first wave: five individual pages

| Product | Main use and audience | Confirmed public release | Recommendation |
| --- | --- | --- | --- |
| [Xnote](https://github.com/Skale-Club/xnote/blob/main/README.md) | Meeting transcription and notes for people working in calls. Captures microphone and system output without adding a meeting bot; local/cloud transcription and AI summaries. | [v0.2.0](https://github.com/Skale-Club/xnote/releases/tag/v0.2.0), portable `Xnote.exe`, Windows | Strong first page; a specific problem and clear demonstration. |
| [Xink](https://github.com/Skale-Club/xink/blob/main/README.md) | Draw over other applications during presentations, teaching and video recording. Hotkeys, drawing/mouse modes and a tray toolbar. | [v0.2.0](https://github.com/Skale-Club/xink/releases/tag/v0.2.0), portable `Xink.exe`, Windows | Strong first page; easy to show in a short visual demonstration. |
| [Xvert](https://github.com/Skale-Club/xvert/blob/main/README.md) | Batch conversion of video, audio and images, processed locally. | [v0.2.0](https://github.com/Skale-Club/xvert/releases/tag/v0.2.0), portable `Xvert.exe`, Windows | Strong utility page with formats, workflow and practical examples. |
| [Xpace](https://github.com/Skale-Club/xpace/blob/main/README.md) | PC care, disk-space inspection, cleaning, startup/apps/drivers, hardware information, sensors and benchmarks. | [v0.2.1](https://github.com/Skale-Club/xpace/releases/tag/v0.2.1), portable `Xpace.exe`, Windows | One consolidated page, covering the former Xcare and Xpecs capabilities. |
| [Xdeck](https://github.com/Skale-Club/xdeck/blob/main/README.md) | Audio-device and microphone control, controller battery/testing, shortcuts and OBS control from the tray, panel or controller. | [v0.7.4](https://github.com/Skale-Club/xdeck/releases/tag/v0.7.4), `XdeckSetup.exe` and portable `Xdeck-0.7.4.zip`, Windows 10/11 x64 | Good individual page for creators, streamers and people using controllers. |

Suggested implementation order: Xnote, Xink, Xvert, Xpace, Xdeck. This is editorial
prioritization, not an assertion that the binaries have passed release review.
Existing technical page paths can be `/downloads/xnote`, `/downloads/xink`,
`/downloads/xvert`, `/downloads/xpace` and `/downloads/xdeck`.

### Copy and requirements to preserve

- **Xnote:** application access can be free while cloud transcription and enhanced
  notes require the user's provider credentials and may incur separate API costs.
  Local transcription does not make an OpenAI-generated summary local. Do not
  promise per-person speaker identification or saved audio playback; the README
  documents source labels and text storage, not an audio archive.
- **Xink:** annotation overlay, not a video recorder. Keep that distinction clear.
- **Xvert:** requires WebView2 and FFmpeg; the app can obtain FFmpeg on first use.
  The Portuguese README still contains an older no-release statement, superseded
  for availability by the actual v0.2.0 release metadata.
- **Xpace:** some operations require administrator rights. Describe actual
  inspection/cleaning features rather than promising automatic speed gains.
- **Xdeck:** requires WebView2 and .NET Framework 4.8. Document installable and
  portable choices. The README distinguishes updater signing from paid Windows
  Authenticode signing; do not advertise Windows certification.

## Optional or later

| Project | Evidence | Suggested treatment |
| --- | --- | --- |
| Xtation | `C:\Users\Vanildo\Dev\xtation\README.md` and [public v1.1.0](https://github.com/Skale-Club/xtation-releases/releases/tag/v1.1.0) confirm three Windows x64 installers wrapping YouTube, YouTube Music and Home Assistant. | Optional single Xtation page with three variants. Present them as desktop companions for third-party services, not three original Skale services. Lower priority than the five original utilities. |
| Xpeed | `C:\Users\Vanildo\Dev\xpeed\README.md` documents OBD diagnostics/trip recording, PWA and Android live/offline variants; `.github/workflows/android-apk.yml` builds APKs. Physical adapter/device verification remains documented work. | Evaluate separately as an automotive product with download options. Define supported hardware, account/API operation and public support before including it among simple free utilities. APKs were not verified in this inventory. |
| Sublibr | [README](https://github.com/Skale-Club/sublibr/blob/main/README.md) describes an Electron subtitle generator/editor with build targets for desktop systems. GitHub identifies the repository as a fork of `stskr/sublibr`; its release collection was empty. | Hold for a separate product/branding decision and an actual distributable. Do not silently market it as an original X-branded app. |

## Exclude from this first download-page batch

| Project or group | Reason |
| --- | --- |
| [Xcare](https://github.com/Skale-Club/xcare/blob/main/README.md), [Xpecs](https://github.com/Skale-Club/xpecs/blob/main/README.md) | Both repositories are archived; their READMEs and Xpace's README explicitly document consolidation into Xpace. Separate pages would duplicate a superseded product. |
| Xtudio | `C:\Users\Vanildo\Dev\xtudio\README.md` explicitly says planning/bootstrap, with no executable or audio engine. Keep as future work rather than a download page. |
| Xpot NFC Writer | `C:\Users\Vanildo\Dev\xpot\nfc-provisioner\README.md` describes a paired companion requiring Xpot Tags and a USB NFC reader, with no independent offline operation. Provide its download inside the relevant Xpot setup/help flow. |
| Xpot Desktop and print bench | A Windows installer exists at `xpot/client/public/desktop/XpotDesktopSetup.exe`; `xpot/print-pipeline/README.md` ties the bench to paired production orders and Bambu Studio. These are operating tools for the Xpot workflow, not general public utilities. |
| Xphere, XmartMenu, Xkedule, Xareable, Xcraper, Xtimator, Xmail, Xpend, PaperPair | Web platforms or account/server-backed products from the existing product line. Keep their marketing under Platforms; an installable PWA is not a reason to duplicate them in a binary-download catalog. |
| Xplore, Xtrenght | Web applications with account/server workflows; Xplore has PWA installation, not a separately packaged native release in the inspected sources. Consider web-product pages independently. |
| Driver RC, Driver Sim | Xpeed's nested READMEs explicitly separate them from the customer application and document hardware/planning-stage work. No public utility download page now. |
| Client websites, Skale Games, Skale Cron, server dashboard and automation tooling | Different audiences and product lines. Avoid mixing customer websites, games, operational services or developer MCP infrastructure into this initial utility catalog. |

Other remote repositories screened as web/infrastructure rather than desktop
utility candidates include Ads Insights AI, Xmart, Fluenverse, Fluenverse 2.0,
Publik, Navigator, Watchapp, RSLC and Remotion. No independent public binary
distribution was established for them by this inventory.

## Next: prepare the five actual landings

For each selected product, prepare a specific value proposition, real screenshot
or short demonstration, three to five verified benefits, installation/platform
requirements, release notes, download choices and concise FAQ. Show provider
costs/dependencies where they affect use. Use real product interfaces, not mock
features or generated UI. Review the downloaded release before enabling public
download buttons.

The foundation's Xnote draft is an editorial placeholder; replace it with the
verified meeting-transcription positioning when creating the actual pages.
This inventory did not create or publish app records, edit another repository,
apply migrations or deploy the website.
