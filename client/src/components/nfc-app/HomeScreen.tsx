import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Download, Link2, Nfc, PlusCircle, QrCode, ScanLine, Settings2, Tag } from 'lucide-react';
import QrScanner from './QrScanner';
import { TagSearch } from './TagSearch';
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
import {
  ActionTile,
  BTN_DIRECT,
  BTN_PRIMARY,
  BTN_TERTIARY,
  Banner,
  BottomSheet,
  CARD,
  CopyButton,
  EYEBROW,
  EYEBROW_MUTED,
  ICON_BLOCK_DIRECT,
  ICON_BLOCK_SKALE,
  SHEET_TITLE,
  Screen,
} from './ui';
import { isWebNfcSupported, scanOnce } from './webNfc';

type Sheet = { kind: 'empty' } | { kind: 'text'; text: string } | { kind: 'nfc' } | null;

export default function HomeScreen() {
  const [, navigate] = useLocation();
  const { banner, show } = useBanner();
  const { canInstall, install } = useInstallPrompt();
  const [recents, setRecents] = useState<RecentItem[]>(getRecents);
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

  const hero = (
    <header>
      <div className="flex min-h-[64px] items-center justify-between">
        <span className={`h-10 w-10 ${ICON_BLOCK_SKALE}`}>
          <Nfc className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-1">
          {canInstall && (
            <button
              type="button"
              onClick={() => void install()}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm font-semibold text-fog-50 active:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Instalar
            </button>
          )}
          <Link
            href="/nfc/devices"
            aria-label="Aparelhos"
            className="flex h-12 w-12 items-center justify-center rounded-full text-fog-300 active:bg-white/10"
          >
            <Settings2 className="h-6 w-6" />
          </Link>
        </div>
      </div>
      <p className={EYEBROW}>Skale Club</p>
      <h1 className="mt-3 text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-fog-50">Skale NFC</h1>
    </header>
  );

  return (
    <Screen hero={hero}>
      <Banner banner={banner} />

      <div className="space-y-3">
        {nfcSupported && (
          <ActionTile
            primary
            icon={Nfc}
            title="Aproximar NFC"
            description="Ler ou configurar um chip"
            onClick={() => void startNfc()}
            disabled={busy}
            testId="button-scan-nfc"
          />
        )}
        <ActionTile
          primary={!nfcSupported}
          icon={QrCode}
          title="Escanear QR"
          description="Câmera traseira"
          onClick={() => setQrOpen(true)}
          disabled={busy}
          testId="button-scan-qr"
        />
        {!nfcSupported && ios && (
          <p className="px-1 text-sm text-fog-400">
            No iPhone o app não lê chip NFC, só QR e código. Para ler e gravar chip direto pelo app, use um Android com Chrome.
          </p>
        )}
        {!nfcSupported && !ios && (
          <p className="px-1 text-sm text-fog-400">Este navegador não lê NFC. No Android, abra pelo Chrome para aproximar o chip.</p>
        )}
      </div>

      <TagSearch
        busy={busy}
        onSubmit={(text) => void handleScan(text)}
        onOpen={(publicCode) => {
          pushRecent({ kind: 'skale', value: publicCode });
          navigate(tagPath(publicCode));
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-2">
        <ActionTile
          compact
          icon={Link2}
          iconClassName="text-emerald-400"
          title="Link direto de cliente"
          description="Grava o site do cliente no chip"
          onClick={() => navigate('/nfc/direct')}
        />
        <ActionTile
          compact
          icon={PlusCircle}
          title="Nova tag Skale"
          description="Cria um código e grava no chip"
          onClick={() => navigate('/nfc/new')}
        />
      </div>

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className={EYEBROW_MUTED}>Recentes</h2>
          {recents.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearRecents();
                setRecents([]);
              }}
              className="min-h-[44px] px-2 text-xs font-semibold text-fog-400 active:text-fog-50"
            >
              Limpar
            </button>
          )}
        </div>
        {recents.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center px-6 py-8 text-center`}>
            <ScanLine className="h-8 w-8 text-fog-400" />
            <p className="mt-2 text-sm text-fog-400">As tags que você abrir aparecem aqui.</p>
          </div>
        ) : (
          <ul className={`${CARD} divide-y divide-white/10 overflow-hidden`}>
            {recents.map((item) => (
              <li key={`${item.kind}:${item.value}`}>
                <button type="button" onClick={() => openRecent(item)} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left active:bg-white/10">
                  <span className={`h-9 w-9 ${item.kind === 'skale' ? ICON_BLOCK_SKALE : ICON_BLOCK_DIRECT}`}>
                    {item.kind === 'skale' ? <Tag className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-base font-semibold text-fog-50 ${item.kind === 'skale' ? 'font-mono tracking-[0.12em]' : ''}`}>
                      {item.kind === 'skale' ? item.value : shortUrl(item.value)}
                    </span>
                    <span className="block text-xs text-fog-400">{item.kind === 'skale' ? 'Tag Skale' : 'Link direto'}</span>
                  </span>
                  <span className="shrink-0 text-xs text-fog-400">{timeAgo(item.at)}</span>
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
          <p className={`mt-4 ${SHEET_TITLE}`}>Aproxime o chip</p>
          <p className="mt-1 text-sm text-fog-400">Encoste no verso do celular.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            stopNfc();
            setSheet(null);
          }}
          className={BTN_TERTIARY}
        >
          Cancelar
        </button>
      </BottomSheet>

      <BottomSheet open={sheet?.kind === 'empty'} onClose={() => setSheet(null)} title="Chip vazio">
        <h2 className={SHEET_TITLE}>Chip vazio</h2>
        <p className="mt-1 text-sm text-fog-400">Esse chip ainda não tem link. O que você quer fazer?</p>
        <div className="mt-5 space-y-3">
          <button type="button" onClick={() => navigate('/nfc/new')} className={BTN_PRIMARY}>
            <Tag className="h-5 w-5" />
            Vincular a uma tag Skale
          </button>
          <button type="button" onClick={() => navigate('/nfc/direct')} className={BTN_DIRECT}>
            <Link2 className="h-5 w-5" />
            Gravar link direto
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet?.kind === 'text'} onClose={() => setSheet(null)} title="Texto lido">
        <h2 className={SHEET_TITLE}>Texto lido</h2>
        <p className="mt-1 text-sm text-fog-400">Isso não é um link nem um código de tag.</p>
        <p className="mt-4 break-words rounded-none border border-white/10 bg-navy-900 p-4 text-base text-fog-50">
          {sheet?.kind === 'text' ? sheet.text : ''}
        </p>
        <div className="mt-4">{sheet?.kind === 'text' && <CopyButton text={sheet.text} label="Copiar texto" large />}</div>
      </BottomSheet>
    </Screen>
  );
}
