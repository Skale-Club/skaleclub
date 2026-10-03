import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronRight, Download, Link2, Nfc, PlusCircle, QrCode, ScanLine, Settings2, Tag } from 'lucide-react';
import QrScanner from './QrScanner';
import {
  classify,
  clearRecents,
  directPath,
  errorMessage,
  getRecents,
  haptic,
  isIos,
  lookupTag,
  pushRecent,
  shortUrl,
  tagPath,
  timeAgo,
  useBanner,
  useInstallPrompt,
  type RecentItem,
} from './lib';
import { BTN_PRIMARY, BTN_SECONDARY, Banner, BottomSheet, CARD, CopyButton, INPUT, Screen, Spinner } from './ui';
import { isWebNfcSupported, scanOnce } from './webNfc';

type Sheet = { kind: 'empty' } | { kind: 'text'; text: string } | { kind: 'nfc' } | null;

export default function HomeScreen() {
  const [, navigate] = useLocation();
  const { banner, show } = useBanner();
  const { canInstall, install } = useInstallPrompt();
  const [recents, setRecents] = useState<RecentItem[]>(getRecents);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const nfcAbort = useRef<AbortController | null>(null);
  const nfcSupported = isWebNfcSupported();
  const ios = isIos();

  const handleScan = useCallback(
    async (raw: string) => {
      const result = classify(raw);
      if (result.kind === 'empty') return setSheet({ kind: 'empty' });
      if (result.kind === 'text') return setSheet({ kind: 'text', text: result.text });
      if (result.kind === 'direct') {
        pushRecent({ kind: 'direct', value: result.url });
        return navigate(directPath(result.url));
      }
      setBusy(true);
      try {
        const tag = await lookupTag(result.code);
        if (!tag) {
          show({ tone: 'error', text: `Não achei nenhuma tag com o código ${result.code}.` });
          return;
        }
        pushRecent({ kind: 'skale', value: tag.publicCode });
        navigate(tagPath(tag.publicCode));
      } catch (err) {
        show({ tone: 'error', text: errorMessage(err) });
      } finally {
        setBusy(false);
      }
    },
    [navigate, show],
  );

  // ?code= / ?url= (shared links, home-screen shortcuts).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get('code') || params.get('url');
    if (incoming) {
      window.history.replaceState(null, '', '/nfc/home');
      void handleScan(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopNfc = useCallback(() => {
    nfcAbort.current?.abort();
    nfcAbort.current = null;
  }, []);
  useEffect(() => stopNfc, [stopNfc]);

  const startNfc = async () => {
    stopNfc();
    const ctrl = new AbortController();
    nfcAbort.current = ctrl;
    setSheet({ kind: 'nfc' });
    try {
      const reading = await scanOnce(ctrl.signal);
      haptic(40);
      setSheet(null);
      if (reading.kind === 'url') await handleScan(reading.url);
      else if (reading.kind === 'text') await handleScan(reading.text);
      else setSheet({ kind: 'empty' });
    } catch (err) {
      const e = err as { silent?: boolean; message?: string };
      if (e.silent) return;
      setSheet(null);
      show({ tone: 'error', text: e.message || 'Falha ao ler o NFC.' });
    }
  };

  const openRecent = (item: RecentItem) => navigate(item.kind === 'skale' ? tagPath(item.value) : directPath(item.value));

  return (
    <Screen>
      <header className="flex min-h-[64px] items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cta text-white">
            <Nfc className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold text-white">Skale NFC</span>
        </div>
        <div className="flex items-center gap-1">
          {canInstall && (
            <button
              type="button"
              onClick={() => void install()}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold text-white active:bg-white/20"
            >
              <Download className="h-4 w-4" />
              Instalar
            </button>
          )}
          <Link
            href="/nfc/devices"
            aria-label="Aparelhos"
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-300 active:bg-white/10"
          >
            <Settings2 className="h-6 w-6" />
          </Link>
        </div>
      </header>

      <Banner banner={banner} />

      <div className="mt-2 space-y-3">
        {nfcSupported && (
          <button
            type="button"
            onClick={() => void startNfc()}
            disabled={busy}
            data-testid="button-scan-nfc"
            className="flex min-h-[112px] w-full items-center gap-4 rounded-3xl bg-cta px-6 text-left text-white shadow-lg shadow-cta/20 active:bg-cta-hover disabled:opacity-60"
          >
            <Nfc className="h-12 w-12 shrink-0" />
            <span>
              <span className="block text-2xl font-extrabold">Aproximar NFC</span>
              <span className="block text-sm font-medium text-white/80">Ler ou configurar um chip</span>
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          disabled={busy}
          data-testid="button-scan-qr"
          className={
            nfcSupported
              ? 'flex min-h-[72px] w-full items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-6 text-left text-white active:bg-white/10'
              : 'flex min-h-[112px] w-full items-center gap-4 rounded-3xl bg-cta px-6 text-left text-white shadow-lg shadow-cta/20 active:bg-cta-hover'
          }
        >
          <QrCode className={nfcSupported ? 'h-8 w-8 shrink-0' : 'h-12 w-12 shrink-0'} />
          <span>
            <span className={`block font-extrabold ${nfcSupported ? 'text-xl' : 'text-2xl'}`}>Escanear QR</span>
            <span className="block text-sm font-medium text-white/70">Câmera traseira</span>
          </span>
        </button>
        {!nfcSupported && ios && (
          <p className="px-1 text-sm text-slate-400">
            No iPhone o app não lê chip NFC, só QR e código. Para ler e gravar chip direto pelo app, use um Android com Chrome.
          </p>
        )}
        {!nfcSupported && !ios && (
          <p className="px-1 text-sm text-slate-400">Este navegador não lê NFC. No Android, abra pelo Chrome para aproximar o chip.</p>
        )}
      </div>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void handleScan(code.trim());
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digitar código da tag"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={INPUT}
          data-testid="input-tag-code"
        />
        <button
          type="submit"
          disabled={!code.trim() || busy}
          aria-label="Abrir tag"
          className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20 disabled:opacity-40"
        >
          {busy ? <Spinner /> : <ChevronRight className="h-6 w-6" />}
        </button>
      </form>

      <div className="mt-5 grid grid-cols-1 gap-2">
        <Link href="/nfc/direct" className={BTN_SECONDARY}>
          <Link2 className="h-5 w-5 text-emerald-400" />
          Gravar link direto de cliente
        </Link>
        <Link href="/nfc/new" className={BTN_SECONDARY}>
          <PlusCircle className="h-5 w-5 text-blue-300" />
          Nova tag Skale
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recentes</h2>
          {recents.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearRecents();
                setRecents([]);
              }}
              className="min-h-[44px] px-2 text-xs font-semibold text-slate-400 active:text-white"
            >
              Limpar
            </button>
          )}
        </div>
        {recents.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center px-6 py-8 text-center`}>
            <ScanLine className="h-8 w-8 text-slate-500" />
            <p className="mt-2 text-sm text-slate-400">As tags que você abrir aparecem aqui.</p>
          </div>
        ) : (
          <ul className={`${CARD} divide-y divide-white/10 overflow-hidden`}>
            {recents.map((item) => (
              <li key={`${item.kind}:${item.value}`}>
                <button type="button" onClick={() => openRecent(item)} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left active:bg-white/10">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
                      item.kind === 'skale' ? 'bg-cta' : 'bg-emerald-500'
                    }`}
                  >
                    {item.kind === 'skale' ? <Tag className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-base font-semibold text-white ${item.kind === 'skale' ? 'font-mono tracking-wider' : ''}`}>
                      {item.kind === 'skale' ? item.value : shortUrl(item.value)}
                    </span>
                    <span className="block text-xs text-slate-400">{item.kind === 'skale' ? 'Tag Skale' : 'Link direto'}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{timeAgo(item.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {qrOpen && (
        <QrScanner
          onClose={() => setQrOpen(false)}
          onResult={(text) => {
            setQrOpen(false);
            void handleScan(text);
          }}
        />
      )}

      <BottomSheet
        open={sheet?.kind === 'nfc'}
        onClose={() => {
          stopNfc();
          setSheet(null);
        }}
        title="Aproximar NFC"
      >
        <div className="flex flex-col items-center py-6 text-center">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-cta opacity-20" />
            <span className="absolute inset-4 animate-pulse rounded-full bg-cta opacity-30" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-cta text-white">
              <Nfc className="h-10 w-10" />
            </span>
          </div>
          <p className="mt-4 text-xl font-bold text-white">Aproxime o chip</p>
          <p className="mt-1 text-sm text-slate-400">Encoste no verso do celular.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            stopNfc();
            setSheet(null);
          }}
          className={BTN_SECONDARY}
        >
          Cancelar
        </button>
      </BottomSheet>

      <BottomSheet open={sheet?.kind === 'empty'} onClose={() => setSheet(null)} title="Chip vazio">
        <h2 className="text-xl font-bold text-white">Chip vazio</h2>
        <p className="mt-1 text-sm text-slate-400">Esse chip ainda não tem link. O que você quer fazer?</p>
        <div className="mt-5 space-y-3">
          <button type="button" onClick={() => navigate('/nfc/new')} className={BTN_PRIMARY}>
            <Tag className="h-5 w-5" />
            Vincular a uma tag Skale
          </button>
          <button
            type="button"
            onClick={() => navigate('/nfc/direct')}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-base font-bold text-white active:bg-emerald-600"
          >
            <Link2 className="h-5 w-5" />
            Gravar link direto
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet?.kind === 'text'} onClose={() => setSheet(null)} title="Texto lido">
        <h2 className="text-xl font-bold text-white">Texto lido</h2>
        <p className="mt-1 text-sm text-slate-400">Isso não é um link nem um código de tag.</p>
        <p className="mt-4 break-words rounded-2xl border border-white/10 bg-white/5 p-4 text-base text-white">
          {sheet?.kind === 'text' ? sheet.text : ''}
        </p>
        <div className="mt-4">{sheet?.kind === 'text' && <CopyButton text={sheet.text} label="Copiar texto" large />}</div>
      </BottomSheet>
    </Screen>
  );
}
