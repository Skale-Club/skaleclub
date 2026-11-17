export type AppLandingLanguage = "en" | "pt";
export type AppBrandAccent = "blue" | "violet" | "green" | "cyan" | "orange" | "slate";

export interface AppLandingContent {
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  intro: string;
  benefits: [string, string, string];
  essentials?: string;
  seo: { title: string; description: string };
  brandAccent: AppBrandAccent;
}

export const APP_LANDING_SLUGS = ["xnote", "xink", "xvert", "xpace", "xdeck", "xtation"] as const;
export type AppLandingSlug = (typeof APP_LANDING_SLUGS)[number];

type LocalizedLanding = Record<AppLandingLanguage, AppLandingContent>;

const APP_LANDINGS: Record<AppLandingSlug, LocalizedLanding> = {
  xnote: {
    en: {
      slug: "xnote", name: "Xnote", eyebrow: "Meeting notes, without a bot",
      headline: "Keep the useful parts.",
      intro: "Capture your mic and system audio to create searchable notes and tasks—without saving a replayable audio file.",
      benefits: ["Works beside your call app", "Choose local or cloud transcription", "Review searchable notes and transcript"],
      essentials: "Optional cloud AI uses your own API key and may have provider charges.",
      seo: { title: "Xnote for Windows | Meeting Notes", description: "Capture call audio, transcribe locally or with a provider, and keep meeting notes, summaries and tasks." },
      brandAccent: "violet",
    },
    pt: {
      slug: "xnote", name: "Xnote", eyebrow: "Notas de reunião, sem bot",
      headline: "Guarde o que importa.",
      intro: "Capture o microfone e o áudio do sistema para criar notas e tarefas pesquisáveis, sem salvar uma gravação para reproduzir depois.",
      benefits: ["Funciona junto do app de chamadas", "Escolha transcrição local ou em nuvem", "Revise notas e transcrição pesquisáveis"],
      essentials: "A IA em nuvem opcional usa sua chave de API e pode ter custos do provedor.",
      seo: { title: "Xnote para Windows | Notas de reunião", description: "Capture o áudio de chamadas, transcreva localmente ou por um provedor e organize notas, resumos e tarefas." },
      brandAccent: "violet",
    },
  },
  xink: {
    en: {
      slug: "xink", name: "Xink", eyebrow: "Draw over any app",
      headline: "Explain it on screen.",
      intro: "Mark up presentations, lessons and demos with a floating annotation toolbar for Windows.",
      benefits: ["Draw over the apps you use", "Switch to click-through mouse mode", "Use pen, shapes, text and pointers"],
      essentials: "Xink annotates your screen; it does not record video. Use a separate screen recorder.",
      seo: { title: "Xink for Windows | Screen Annotation", description: "Draw over Windows apps with a floating toolbar, annotation tools and click-through mouse mode." },
      brandAccent: "blue",
    },
    pt: {
      slug: "xink", name: "Xink", eyebrow: "Desenhe sobre qualquer app",
      headline: "Explique direto na tela.",
      intro: "Anote apresentações, aulas e demonstrações com uma barra flutuante para Windows.",
      benefits: ["Desenhe sobre os apps que usa", "Alterne para o modo mouse com cliques", "Use caneta, formas, texto e apontadores"],
      essentials: "O Xink anota a tela; não grava vídeo. Use um gravador de tela separado.",
      seo: { title: "Xink para Windows | Anotações na tela", description: "Desenhe sobre aplicativos Windows com barra flutuante, ferramentas de anotação e modo mouse." },
      brandAccent: "blue",
    },
  },
  xvert: {
    en: {
      slug: "xvert", name: "Xvert", eyebrow: "Media conversion, on your PC",
      headline: "Convert your media.",
      intro: "Convert batches of videos, music and pictures locally with one Windows app.",
      benefits: ["Queue video, audio and images", "Choose formats and quality", "Keep originals unless you opt in"],
      essentials: "Uses FFmpeg; the app can download it if needed.",
      seo: { title: "Xvert for Windows | Media Converter", description: "Convert video, audio and image batches locally with Xvert for Windows." },
      brandAccent: "green",
    },
    pt: {
      slug: "xvert", name: "Xvert", eyebrow: "Conversão de mídia no computador",
      headline: "Converta suas mídias.",
      intro: "Converta lotes de vídeos, músicas e imagens localmente em um app Windows.",
      benefits: ["Enfileire vídeo, áudio e imagens", "Escolha formatos e qualidade", "Preserve originais por padrão"],
      essentials: "Usa FFmpeg; o app pode baixá-lo se necessário.",
      seo: { title: "Xvert para Windows | Conversor de mídia", description: "Converta lotes de vídeos, áudios e imagens localmente com Xvert para Windows." },
      brandAccent: "green",
    },
  },
  xpace: {
    en: {
      slug: "xpace", name: "Xpace", eyebrow: "Care and insight for your PC",
      headline: "See your PC clearly.",
      intro: "Inspect disk space, review cleanup, manage startup and drivers, and check hardware in one Windows utility.",
      benefits: ["Explore folders and large files", "Review cleanup before confirming", "Check devices, sensors and benchmarks"],
      essentials: "Some operations require administrator approval. Review cleanup selections before confirming.",
      seo: { title: "Xpace for Windows | PC Care & Hardware", description: "Review disk usage and cleanup, manage startup and drivers, and inspect hardware with Xpace." },
      brandAccent: "cyan",
    },
    pt: {
      slug: "xpace", name: "Xpace", eyebrow: "Manutenção e informações do PC",
      headline: "Entenda seu PC.",
      intro: "Examine o disco, revise limpezas, gerencie inicialização e drivers e consulte o hardware em uma ferramenta Windows.",
      benefits: ["Explore pastas e arquivos grandes", "Revise a limpeza antes de confirmar", "Consulte dispositivos, sensores e benchmarks"],
      essentials: "Algumas operações exigem aprovação de administrador. Revise os itens antes de confirmar a limpeza.",
      seo: { title: "Xpace para Windows | Manutenção e hardware", description: "Revise uso do disco e limpeza, gerencie inicialização e drivers e consulte hardware com Xpace." },
      brandAccent: "cyan",
    },
  },
  xdeck: {
    en: {
      slug: "xdeck", name: "Xdeck", eyebrow: "Audio and controllers from the tray",
      headline: "Stay in control.",
      intro: "Switch audio devices, check controllers and use OBS controls from a Windows tray app.",
      benefits: ["Change output, mic, volume and mute", "Check batteries and test controllers", "Open panel controls with a gamepad"],
      essentials: "Windows 10/11 x64, WebView2 and .NET Framework 4.8.",
      seo: { title: "Xdeck for Windows | Audio & Controller Controls", description: "Switch audio devices, check controller batteries, test gamepads and access OBS controls from the Windows tray." },
      brandAccent: "orange",
    },
    pt: {
      slug: "xdeck", name: "Xdeck", eyebrow: "Áudio e controles pela bandeja",
      headline: "Tenha o controle.",
      intro: "Alterne dispositivos de áudio, confira controles e use funções do OBS por um app na bandeja do Windows.",
      benefits: ["Troque saída, microfone, volume e mudo", "Confira baterias e teste controles", "Abra o painel usando um gamepad"],
      essentials: "Windows 10/11 x64, WebView2 e .NET Framework 4.8.",
      seo: { title: "Xdeck para Windows | Áudio e controles", description: "Alterne áudio, confira bateria, teste gamepads e acesse controles do OBS pela bandeja do Windows." },
      brandAccent: "orange",
    },
  },
  xtation: {
    en: {
      slug: "xtation", name: "Xtation", eyebrow: "Your services in dedicated windows",
      headline: "One window per service.",
      intro: "Open YouTube, YouTube Music or your own Home Assistant in a dedicated Windows desktop app.",
      benefits: ["Keep services in separate windows", "Use a toolbar with YouTube apps", "Connect to your own Home Assistant"],
      essentials: "Xtation wraps third-party services; accounts and subscriptions are separate. The Home Assistant app needs your own server address.",
      seo: { title: "Xtation for Windows | YouTube & Home Assistant", description: "Open YouTube, YouTube Music and your own Home Assistant in dedicated Windows desktop apps." },
      brandAccent: "slate",
    },
    pt: {
      slug: "xtation", name: "Xtation", eyebrow: "Seus serviços em janelas próprias",
      headline: "Um app por serviço.",
      intro: "Abra YouTube, YouTube Music ou seu próprio Home Assistant em um app dedicado para Windows.",
      benefits: ["Mantenha serviços em janelas separadas", "Use uma barra nos apps do YouTube", "Conecte seu próprio Home Assistant"],
      essentials: "O Xtation exibe serviços de terceiros; contas e assinaturas são separadas. O app Home Assistant exige o endereço do seu servidor.",
      seo: { title: "Xtation para Windows | YouTube e Home Assistant", description: "Abra YouTube, YouTube Music e seu Home Assistant em aplicativos próprios para Windows." },
      brandAccent: "slate",
    },
  },
};

export function getAppLanding(slug: string, language: AppLandingLanguage): AppLandingContent | undefined {
  if (!(APP_LANDING_SLUGS as readonly string[]).includes(slug)) return undefined;
  return APP_LANDINGS[slug as AppLandingSlug][language];
}
