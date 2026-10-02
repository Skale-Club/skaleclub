import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AuthContext';
import { AppLoader } from '@/components/ui/spinner';
import { extractFirstUrl } from '@shared/reviewLink';

interface Place {
  placeId?: string;
  name?: string;
  address?: string;
  reviewUrl: string;
}

interface HistoryEntry extends Place {
  at: number;
}

const SELF_PATH = '/admin/review-link';
const MANIFEST_HREF = '/review-link.webmanifest';
const HISTORY_KEY = 'reviewLinkHistory';
const USE_LOCATION_KEY = 'reviewLinkUseLocation';
const PENDING_KEY = 'reviewLinkPending';
const HISTORY_LIMIT = 15;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / blocked storage: the tool still works, it just forgets.
  }
}

/** Text arriving from the Android share sheet (share_target) or saved before a login bounce. */
function takeInitialInput(): string {
  const params = new URLSearchParams(window.location.search);
  // Apps repeat themselves across title/text/url (Maps puts the name in both), so drop echoes.
  const parts: string[] = [];
  for (const value of [params.get('text'), params.get('url'), params.get('title')]) {
    const v = value?.trim();
    if (v && !parts.some((p) => p.includes(v))) parts.push(v);
  }
  const shared = parts.join('\n');
  if (params.has('title') || params.has('text') || params.has('url') || params.has('source')) {
    window.history.replaceState(null, '', SELF_PATH);
  }
  if (shared) return shared;
  try {
    const pending = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    return pending ?? '';
  } catch {
    return '';
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews: fall back to a temporary selection.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Point the page at this tool's own manifest so "Install" / "Add to Home Screen" installs the tool, not the site. */
function useToolManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const previousHref = link?.getAttribute('href');
    const previousAppleTitle = appleTitle?.content;
    const previousTitle = document.title;
    link?.setAttribute('href', MANIFEST_HREF);
    if (appleTitle) appleTitle.content = 'Review Link';
    document.title = 'Review Link';
    return () => {
      if (link && previousHref) link.setAttribute('href', previousHref);
      if (appleTitle && previousAppleTitle) appleTitle.content = previousAppleTitle;
      document.title = previousTitle;
    };
  }, []);
}

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return { promptEvent, installed, isIos, clear: () => setPromptEvent(null) };
}

function CopyButton({ text, large = false }: { text: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    if (!(await copyText(text))) return;
    navigator.vibrate?.(30);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  if (large) {
    return (
      <button
        type="button"
        onClick={onCopy}
        data-testid="button-copy-review-link"
        className={`flex w-full items-center justify-center gap-2 rounded-full py-4 text-lg font-bold text-white transition-colors ${
          copied ? 'bg-emerald-600' : 'bg-cta active:bg-cta-hover'
        }`}
      >
        {copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
        {copied ? 'Copiado!' : 'Copiar link de avaliação'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copiar link"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
    >
      {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
    </button>
  );
}

function ResultCard({ place }: { place: Place }) {
  const canShare = typeof navigator.share === 'function';
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="card-review-result">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-white">{place.name || 'Empresa encontrada'}</p>
          {place.address && <p className="mt-0.5 text-sm text-slate-400">{place.address}</p>}
        </div>
      </div>
      <p className="mb-4 break-all rounded-lg bg-black/40 p-3 font-mono text-xs leading-relaxed text-slate-300">
        {place.reviewUrl}
      </p>
      <CopyButton text={place.reviewUrl} large />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title: 'Deixe sua avaliação', url: place.reviewUrl }).catch(() => {})}
            className="flex items-center justify-center gap-2 rounded-full bg-white/10 py-3 text-sm font-semibold text-white active:bg-white/20"
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
        )}
        <a
          href={place.reviewUrl}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center justify-center gap-2 rounded-full bg-white/10 py-3 text-sm font-semibold text-white active:bg-white/20 ${
            canShare ? '' : 'col-span-2'
          }`}
        >
          <ExternalLink className="h-4 w-4" /> Testar link
        </a>
      </div>
    </section>
  );
}

export default function ReviewLinkTool() {
  const { isAdmin, loading } = useAdminAuth();
  const [, setLocation] = useLocation();
  const [initialInput] = useState(takeInitialInput);
  const [input, setInput] = useState(initialInput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => readStorage(HISTORY_KEY, []));
  const [useLocationBias, setUseLocationBias] = useState<boolean>(() => readStorage(USE_LOCATION_KEY, true));
  const install = useInstallPrompt();
  const autoRan = useRef(false);
  useToolManifest();

  useEffect(() => {
    if (!loading && !isAdmin) {
      try {
        if (input.trim()) window.sessionStorage.setItem(PENDING_KEY, input);
      } catch {
        // Ignore storage errors.
      }
      setLocation(`/admin/login?next=${encodeURIComponent(SELF_PATH)}`);
    }
  }, [loading, isAdmin, input, setLocation]);

  const choose = useCallback((place: Place) => {
    setSelected(place);
    setHistory((prev) => {
      const next = [{ ...place, at: Date.now() }, ...prev.filter((h) => h.reviewUrl !== place.reviewUrl)].slice(0, HISTORY_LIMIT);
      writeStorage(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const resolve = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (text.length < 2) return;
      setBusy(true);
      setError('');
      setPlaces([]);
      setSelected(null);
      try {
        // Only a name search benefits from where the user is standing.
        const coords = !extractFirstUrl(text) && useLocationBias ? await getPosition() : null;
        const res = await fetch('/api/tools/review-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ input: text, ...(coords ?? {}) }),
        });
        const data = (await res.json().catch(() => ({}))) as { places?: Place[]; message?: string };
        if (res.status === 401 || res.status === 403) {
          try {
            window.sessionStorage.setItem(PENDING_KEY, text);
          } catch {
            // Ignore storage errors.
          }
          setLocation(`/admin/login?next=${encodeURIComponent(SELF_PATH)}`);
          return;
        }
        if (!res.ok) throw new Error(data.message || 'Não foi possível gerar o link.');
        const found = data.places ?? [];
        if (found.length === 0) throw new Error('Nenhuma empresa encontrada. Tente o nome completo + cidade.');
        setPlaces(found);
        if (found.length === 1) choose(found[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível gerar o link.');
      } finally {
        setBusy(false);
      }
    },
    [choose, setLocation, useLocationBias],
  );

  // Arrived from the share sheet (or back from login): convert right away.
  useEffect(() => {
    if (autoRan.current || loading || !isAdmin || !initialInput.trim()) return;
    autoRan.current = true;
    void resolve(initialInput);
  }, [loading, isAdmin, initialInput, resolve]);

  const pasteAndGo = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setInput(text);
        void resolve(text);
      }
    } catch {
      setError('Não consegui ler a área de transferência. Toque e segure no campo para colar.');
    }
  };

  const toggleLocation = () => {
    setUseLocationBias((prev) => {
      writeStorage(USE_LOCATION_KEY, !prev);
      return !prev;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    writeStorage(HISTORY_KEY, []);
  };

  if (loading || !isAdmin) return <AppLoader />;

  const inputIsLink = !!extractFirstUrl(input);

  return (
    <div className="min-h-[100dvh] bg-[#0d121a] text-white">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {!install.installed && (
              <a href="/admin" aria-label="Voltar ao admin" className="-ml-2 rounded-full p-2 text-slate-400 active:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </a>
            )}
            <div>
              <h1 className="text-xl font-bold leading-tight">Link de Avaliação</h1>
              <p className="text-xs text-slate-400">Google Business → link para deixar review</p>
            </div>
          </div>
          {install.promptEvent && !install.installed && (
            <button
              type="button"
              onClick={async () => {
                await install.promptEvent?.prompt();
                install.clear();
              }}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold active:bg-white/20"
            >
              <Download className="h-4 w-4" /> Instalar
            </button>
          )}
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void resolve(input);
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Cole o link do Google Maps (Compartilhar → Copiar link) ou digite o nome da empresa"
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-base text-white placeholder:text-slate-500 focus:border-cta focus:outline-none"
            data-testid="input-review-source"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={pasteAndGo}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3.5 font-semibold active:bg-white/20 disabled:opacity-50"
              data-testid="button-paste"
            >
              <ClipboardPaste className="h-5 w-5" /> Colar
            </button>
            <button
              type="submit"
              disabled={busy || input.trim().length < 2}
              className="flex items-center justify-center gap-2 rounded-full bg-cta py-3.5 font-bold active:bg-cta-hover disabled:opacity-50"
              data-testid="button-generate"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : inputIsLink || !input.trim() ? <Star className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              {busy ? 'Gerando…' : inputIsLink || !input.trim() ? 'Gerar link' : 'Buscar empresa'}
            </button>
          </div>
          {!inputIsLink && input.trim() && (
            <button
              type="button"
              onClick={toggleLocation}
              className="flex items-center gap-2 self-start text-xs text-slate-400"
            >
              <MapPin className={`h-4 w-4 ${useLocationBias ? 'text-cta' : ''}`} />
              {useLocationBias ? 'Buscando perto de mim (toque para desligar)' : 'Localização desligada (toque para ligar)'}
            </button>
          )}
        </form>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        {selected && <ResultCard place={selected} />}

        {places.length > 1 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-300">
              {selected ? 'Outros resultados' : 'Qual dessas é a empresa?'}
            </h2>
            {places
              .filter((p) => p.reviewUrl !== selected?.reviewUrl)
              .map((p) => (
                <button
                  key={p.reviewUrl}
                  type="button"
                  onClick={() => choose(p)}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
                >
                  <p className="font-medium">{p.name || p.placeId}</p>
                  {p.address && <p className="text-xs text-slate-400">{p.address}</p>}
                </button>
              ))}
          </section>
        )}

        {!selected && !busy && !error && places.length === 0 && (
          <section className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
            <p className="mb-2 font-semibold text-slate-300">Como pegar o link no celular</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Abra a empresa no app Google Maps.</li>
              <li>Toque em <strong>Compartilhar</strong> → <strong>Copiar link</strong>.</li>
              <li>Volte aqui e toque em <strong>Colar</strong>.</li>
            </ol>
            <p className="mt-3">Ou digite só o nome da empresa: a busca usa sua localização.</p>
            {!install.installed && (
              <p className="mt-3 text-xs">
                {install.isIos
                  ? 'Dica: no Safari, toque em Compartilhar → "Adicionar à Tela de Início" para usar como app.'
                  : 'Dica: instale como app e, no Google Maps, compartilhe direto para "Review Link".'}
              </p>
            )}
          </section>
        )}

        {history.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Recentes</h2>
              <button type="button" onClick={clearHistory} className="flex items-center gap-1 text-xs text-slate-500">
                <Trash2 className="h-3.5 w-3.5" /> Limpar
              </button>
            </div>
            {history.map((h) => (
              <div key={h.reviewUrl} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <button type="button" onClick={() => setSelected(h)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{h.name || h.reviewUrl}</p>
                  {h.address && <p className="truncate text-xs text-slate-400">{h.address}</p>}
                </button>
                <CopyButton text={h.reviewUrl} />
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
