import type { AppRelease, DownloadableAppInput } from "./schema/downloads.js";

// Reviewed fallback assets from 2026-11-11. Recognized distribution slots follow
// GitHub's latest stable release at runtime unless the admin pins the slot.
function portable(slug: string, product: string, version: string, sha256: string, requirements: string): AppRelease {
  return {
    id: `windows-x64-portable-${version.replaceAll(".", "-")}`,
    platform: "windows", architecture: "x64", version,
    downloadUrl: `https://github.com/Skale-Club/${slug}/releases/download/v${version}/${product}.exe`,
    requirements, notes: "Portable Windows application. Keep the executable in a writable folder so its Data folder can be saved alongside it.",
    sha256, isPublished: true,
  };
}

export const APP_CATALOG: DownloadableAppInput[] = [
  {
    slug: "xnote", name: "Xnote", tagline: "Your meetings, turned into useful notes.",
    description: "Capture microphone and computer audio, transcribe locally or with a cloud provider, and turn your notes and transcript into decisions and tasks. Xnote works alongside your call app without joining as a meeting bot.",
    features: ["Microphone and system-audio transcription", "Local or cloud transcription", "Meeting notes, Markdown exports and search", "Optional AI summaries using your OpenAI API account"],
    releases: [portable("xnote", "Xnote", "0.2.0", "f4e47da976f940ec5eeeb041b502eded6589210622dc43c9f8728f4117a26a82", "Windows x64 with Microsoft Edge WebView2 Runtime. Local transcription needs its engine and model; cloud transcription and AI summaries use your own provider credentials and may incur API charges.")],
    isPublished: true,
  },
  {
    slug: "xink", name: "Xink", tagline: "Make your point. Right on the screen.",
    description: "Draw over any application during presentations, lessons and recordings. Switch between drawing and using your mouse while your annotations remain visible. Xink is an annotation overlay; use your preferred recording app to capture video.",
    features: ["Draw over other programs", "Switch between drawing and mouse modes", "Hotkeys and tray controls", "Portable settings beside the executable"],
    releases: [portable("xink", "Xink", "0.2.0", "bf80e577e6bf3d97f9984906b7ac1fc562515839a39381ed74550b7d86ffbc94", "Windows x64 with Microsoft Edge WebView2 Runtime. A separate application is needed to record video.")],
    isPublished: true,
  },
  {
    slug: "xvert", name: "Xvert", tagline: "Different files. One simple conversion flow.",
    description: "Drop in videos, audio and pictures, choose output formats and convert them in batches on your own computer. Xvert uses FFmpeg locally and can help you obtain the conversion engine on first use.",
    features: ["Video, audio and image conversion", "Drag-and-drop batch processing", "Local processing with FFmpeg", "Original files retained by default"],
    releases: [portable("xvert", "Xvert", "0.2.0", "74233436190223540a6f1c709d5d6b6d1505ed757da0358a16f8e9bc5ceb0cf8", "Windows x64, Microsoft Edge WebView2 Runtime and FFmpeg. The app can download FFmpeg when it is missing; that first download requires internet access.")],
    isPublished: true,
  },
  {
    slug: "xpace", name: "Xpace", tagline: "Understand your PC. Take care of what matters.",
    description: "Inspect disk usage, review cleanup candidates, manage startup programs and explore hardware information, sensors and benchmarks in one portable Windows application. Xpace brings together the former Xcare and Xpecs tools.",
    features: ["Disk-space inspection and cleanup review", "Startup programs, apps and drivers", "Hardware information and live sensors", "Reports, exports and benchmarks"],
    releases: [portable("xpace", "Xpace", "0.2.1", "477bcd8ae15ddda611d9bf3d3cd2b9894a5a2383116299034e14ab2735cb134d", "Windows x64 with Microsoft Edge WebView2 Runtime. Some system-management operations require administrator approval.")],
    isPublished: true,
  },
  {
    slug: "xdeck", name: "Xdeck", tagline: "Your audio and your controllers. Within reach.",
    description: "Switch speakers and microphones, control their volume, check controller batteries and inputs, and drive OBS Studio from a tray panel, shortcuts or a controller. Choose a Windows installer or a portable copy.",
    features: ["Audio output and microphone controls", "Controller battery and input testing", "Shortcuts and controller actions", "OBS Studio controls"],
    releases: [
      {
        id: "windows-x64-setup-0-7-4", platform: "windows", architecture: "x64", version: "0.7.4",
        downloadUrl: "https://github.com/Skale-Club/xdeck/releases/download/v0.7.4/XdeckSetup.exe",
        requirements: "Windows 10/11 x64, Microsoft Edge WebView2 Runtime and .NET Framework 4.8.",
        notes: "Windows installer. Choose installation for your user or for everyone on this PC. Installation for everyone requires administrator approval.",
        sha256: "52a2267e1a7617a4a2a9864009e2a21be96137cd0c370be0fcd91872fc42f3fb", isPublished: true,
      },
      {
        id: "windows-x64-portable-0-7-4", platform: "windows", architecture: "x64", version: "0.7.4",
        downloadUrl: "https://github.com/Skale-Club/xdeck/releases/download/v0.7.4/Xdeck-0.7.4.zip",
        requirements: "Windows 10/11 x64, Microsoft Edge WebView2 Runtime and .NET Framework 4.8.",
        notes: "Portable ZIP. Extract it into a writable folder and run Xdeck.exe. Settings stay in the adjacent Data folder.",
        sha256: "45a47033480e2e4e4d612bff8d84645bdd418fa8b1e6b8b644e58b3fb2cff3d0", isPublished: true,
      },
    ],
    isPublished: true,
  },
  {
    slug: "xtation", name: "Xtation", tagline: "Your everyday services. In their own windows.",
    description: "Open YouTube, YouTube Music and your Home Assistant server in dedicated Windows desktop windows. Xtation provides desktop companions for those third-party services, with a separate installer for each variant.",
    features: ["Dedicated YouTube window", "Dedicated YouTube Music window", "Home Assistant at your own server address", "Separate per-user Windows installers"],
    releases: [
      {
        id: "youtube-windows-x64-1-1-0", platform: "windows", architecture: "x64", version: "1.1.0",
        downloadUrl: "https://github.com/Skale-Club/xtation-releases/releases/download/v1.1.0/youtube_1.1.0_x64-setup.exe",
        requirements: "Windows x64 with Microsoft Edge WebView2 Runtime and internet access.",
        notes: "YouTube desktop companion with navigation controls. YouTube is a third-party service; its account and service terms continue to apply.",
        sha256: "b3390cf187b24a8d43160598a4ab23e48e2f3ee8347e1e01e6e9dd33c8b5e20a", isPublished: true,
      },
      {
        id: "youtube-music-windows-x64-1-1-0", platform: "windows", architecture: "x64", version: "1.1.0",
        downloadUrl: "https://github.com/Skale-Club/xtation-releases/releases/download/v1.1.0/youtube-music_1.1.0_x64-setup.exe",
        requirements: "Windows x64 with Microsoft Edge WebView2 Runtime and internet access.",
        notes: "YouTube Music desktop companion with navigation controls. Service subscriptions, if needed, are separate from the app download.",
        sha256: "fce7ac1c62d99f9f2663e2a0168f15aed9ee66f24fe4e1c9bc6ee710c3c715e5", isPublished: true,
      },
      {
        id: "home-assistant-windows-x64-1-1-0", platform: "windows", architecture: "x64", version: "1.1.0",
        downloadUrl: "https://github.com/Skale-Club/xtation-releases/releases/download/v1.1.0/home-assistant_1.1.0_x64-setup.exe",
        requirements: "Windows x64 with Microsoft Edge WebView2 Runtime and access to your own configured Home Assistant server.",
        notes: "Home Assistant desktop companion. Enter your own server address on first run; the server and its devices are not included.",
        sha256: "d5450149966f9bce6a530170ccfa7c980237a97a4d0359dfca1330a1c5cb3f43", isPublished: true,
      },
    ],
    isPublished: true,
  },
];

// Scope record only: no public placeholder app or download exists for Xtudio.
export const FUTURE_APP_SLUGS = ["xtudio"] as const;
