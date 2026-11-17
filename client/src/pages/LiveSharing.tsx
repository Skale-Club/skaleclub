import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import QRCode from 'react-qr-code';
import { ChevronLeft, ChevronRight, Copy, ExternalLink, Radio, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LiveSlide } from '@/components/live/LiveSlide';
import { useLiveSession } from '@/hooks/use-live-session';
import { usePageSeo } from '@/hooks/use-seo';
import { liveSlideCount } from '@shared/liveSharing';

const copy = {
  en: {
    title: 'Live session', loading: 'Connecting…', ended: 'This live session has ended or is no longer available.',
    link: 'Open the latest link shared by your presenter to join.', owner: 'Sign in with the account that created this session to present.', failed: 'Connection failed. Please try again.',
    retry: 'Try again', code: 'Enter the proposal access code', incorrect: 'Incorrect access code. Please try again.',
    join: 'Join session', live: 'Live', reconnecting: 'Reconnecting…', disconnected: 'Presenter disconnected. Waiting for reconnection…',
    following: 'Following the presenter', takeover: 'Take control in this tab', controller: 'Another tab controls this session. Take control to present here.',
    previous: 'Previous slide', next: 'Next slide', slide: 'Slide', language: 'Language', share: 'Share with client',
    replace: 'Replace sharing link', end: 'End session', endConfirm: 'End this live session for everyone?',
    shared: 'Join on your device', protected: 'This proposal still requires its existing access code.',
    copy: 'Copy link', copied: 'Copied', output: 'Open clean output', revoke: 'Revoke audience access', close: 'Hide sharing panel',
    guests: 'Connected devices', stale: 'The session changed. Controls are now up to date; try again.',
    copyFailed: 'Select and copy the link below.',
  },
  pt: {
    title: 'Sessão ao vivo', loading: 'Conectando…', ended: 'Esta sessão ao vivo terminou ou não está mais disponível.',
    link: 'Abra o link mais recente enviado pelo apresentador para entrar.', owner: 'Entre com a conta que criou esta sessão para apresentar.', failed: 'Falha na conexão. Tente novamente.',
    retry: 'Tentar novamente', code: 'Digite o código de acesso da proposta', incorrect: 'Código incorreto. Tente novamente.',
    join: 'Entrar na sessão', live: 'Ao vivo', reconnecting: 'Reconectando…', disconnected: 'Apresentador desconectado. Aguardando reconexão…',
    following: 'Acompanhando o apresentador', takeover: 'Assumir controle nesta aba', controller: 'Outra aba controla esta sessão. Assuma o controle para apresentar aqui.',
    previous: 'Slide anterior', next: 'Próximo slide', slide: 'Slide', language: 'Idioma', share: 'Compartilhar com cliente',
    replace: 'Substituir link de acesso', end: 'Encerrar sessão', endConfirm: 'Encerrar esta sessão ao vivo para todos?',
    shared: 'Entre pelo seu dispositivo', protected: 'Esta proposta continua exigindo seu código de acesso existente.',
    copy: 'Copiar link', copied: 'Copiado', output: 'Abrir tela limpa', revoke: 'Revogar acesso do público', close: 'Ocultar compartilhamento',
    guests: 'Dispositivos conectados', stale: 'A sessão mudou. Os controles foram atualizados; tente novamente.',
    copyFailed: 'Selecione e copie o link abaixo.',
  },
};

export default function LiveSharing() {
  const { id } = useParams<{ id: string }>();
  const presenter = window.location.pathname.endsWith('/present');
  return <Session key={`${id}:${presenter}`} id={id} presenter={presenter} />;
}

function Session({ id, presenter }: { id: string; presenter: boolean }) {
  usePageSeo({ title: 'Live session', noindex: true });
  const session = useLiveSession(id, presenter);
  const [accessCode, setAccessCode] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | ''>('');
  const pt = session.state?.language === 'pt-BR' || (!session.state && navigator.language.toLowerCase().startsWith('pt'));
  const t = pt ? copy.pt : copy.en;
  const canControl = presenter && session.controller && !session.pending && !session.terminal && session.authorized;
  const count = session.snapshot ? liveSlideCount(session.snapshot) : 0;
  const index = session.state?.slideIndex ?? 0;

  useEffect(() => {
    if (!canControl) return;
    const key = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest('input,select,textarea,button,a,[contenteditable="true"]'))) return;
      if (event.key === 'ArrowRight' && index < count - 1) {
        event.preventDefault(); void session.command({ type: 'navigate', slideIndex: index + 1 });
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault(); void session.command({ type: 'navigate', slideIndex: index - 1 });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [canControl, index, count, session.command]);

  useEffect(() => { setCopyStatus(''); }, [session.shareUrl]);

  const message = session.error === 'code' ? t.incorrect : session.error === 'link' ? (presenter ? t.owner : t.link)
    : session.error === 'controller' ? t.controller : session.error === 'stale' ? t.stale
      : session.error === 'failed' ? t.failed : '';

  if (session.terminal) return <Screen><p role="status" data-testid="live-terminal">{t.ended}</p></Screen>;
  if (session.loading) return <Screen><p role="status">{t.loading}</p></Screen>;
  if (session.codeRequired) return <Screen>
    <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void session.join(accessCode); }}>
      <label htmlFor="live-access-code" className="text-xl font-semibold">{t.code}</label>
      <Input id="live-access-code" data-testid="live-access-code" autoComplete="one-time-code" value={accessCode}
        onChange={(e) => setAccessCode(e.target.value)} aria-invalid={session.error === 'code'} className="border-zinc-600 bg-zinc-900 text-white" />
      {message && <p role="alert">{message}</p>}
      <Button disabled={session.pending || !accessCode.trim()} type="submit" data-testid="live-join">{session.pending ? t.loading : t.join}</Button>
    </form>
  </Screen>;
  if (!session.snapshot || !session.state) return <Screen>
    <p role="alert">{message || t.link}</p>
    <Button variant="outline" disabled={session.pending} onClick={() => void session.retry()}>{t.retry}</Button>
  </Screen>;

  const status = !session.connected ? t.reconnecting : session.state.status === 'disconnected' ? t.disconnected : t.live;
  return <div className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-950 text-white" data-testid={presenter ? 'live-presenter' : 'live-audience'}>
    <header className="shrink-0 border-b border-white/10 bg-zinc-950 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <h1 className="truncate text-sm font-medium">{presenter ? session.snapshot.title : t.following}</h1>
        </div>
        <p className="text-xs text-zinc-300" role="status" aria-live="polite" data-testid="live-status">{status}</p>
      </div>
      {presenter && <>
        {!session.controller && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-100">
          <p>{t.controller}</p>
          <Button onClick={() => void session.takeover()} disabled={session.pending} data-testid="live-takeover">{t.takeover}</Button>
        </div>}
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={t.title}>
          <Button variant="outline" size="icon" disabled={!canControl || index <= 0} onClick={() => void session.command({ type: 'navigate', slideIndex: index - 1 })}
            aria-label={t.previous} data-testid="live-previous"><ChevronLeft className="h-4 w-4" /></Button>
          <label className="sr-only" htmlFor="live-slide-jump">{t.slide}</label>
          <select id="live-slide-jump" data-testid="live-slide-jump" className="h-9 max-w-44 rounded-md border border-zinc-600 bg-zinc-900 px-2 text-sm"
            disabled={!canControl} value={index} onChange={(e) => void session.command({ type: 'navigate', slideIndex: Number(e.target.value) })}>
            {Array.from({ length: count }, (_, i) => <option key={i} value={i}>{t.slide} {i + 1} / {count}</option>)}
          </select>
          <Button variant="outline" size="icon" disabled={!canControl || index >= count - 1} onClick={() => void session.command({ type: 'navigate', slideIndex: index + 1 })}
            aria-label={t.next} data-testid="live-next"><ChevronRight className="h-4 w-4" /></Button>
          <label className="sr-only" htmlFor="live-language">{t.language}</label>
          <select id="live-language" data-testid="live-language" className="h-9 rounded-md border border-zinc-600 bg-zinc-900 px-2 text-sm" value={session.state.language}
            disabled={!canControl} onChange={(e) => void session.command({ type: 'language', language: e.target.value as 'en' | 'pt-BR' })}>
            <option value="en">English</option><option value="pt-BR">Português</option>
          </select>
          <Button disabled={!canControl} size="sm" data-testid="live-share" onClick={() => { setShowShare(true); if (!session.shareUrl) void session.share(); }}>
            <Share2 className="mr-2 h-4 w-4" />{t.share}
          </Button>
          <Button variant="destructive" size="sm" disabled={!canControl} data-testid="live-end"
            onClick={() => { if (window.confirm(t.endConfirm)) void session.command({ type: 'end' }); }}>{t.end}</Button>
          {session.audienceCount !== null && <span className="text-xs text-zinc-400">{t.guests}: {session.audienceCount}</span>}
        </div>
      </>}
      {message && <p role="alert" className="mt-2 text-sm text-amber-200">{message}</p>}
    </header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <LiveSlide snapshot={session.snapshot} state={session.state} />
      {presenter && session.controller && showShare && session.shareUrl && <aside className="relative max-h-[55dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-zinc-900 p-5 md:max-h-none md:w-80 md:border-l md:border-t-0" data-testid="live-share-panel">
        <Button variant="ghost" size="icon" className="absolute right-1 top-1" aria-label={t.close} onClick={() => setShowShare(false)}><X className="h-4 w-4" /></Button>
        <h2 className="mb-4 pr-5 text-lg font-semibold">{t.shared}</h2>
        <div className="mx-auto w-fit rounded-lg bg-white p-3" data-testid="live-qr"><QRCode value={session.shareUrl} size={196} title={t.shared} /></div>
        {session.requiresCode && <p className="mt-4 text-sm text-amber-200" data-testid="live-code-notice">{t.protected}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="outline" data-testid="live-copy-link" onClick={async () => {
            try { await navigator.clipboard.writeText(session.shareUrl); setCopyStatus('copied'); } catch { setCopyStatus('failed'); }
          }}><Copy className="mr-2 h-4 w-4" />{copyStatus === 'copied' ? t.copied : t.copy}</Button>
          {copyStatus === 'failed' && <><p role="status" className="text-sm">{t.copyFailed}</p><Input aria-label={t.copy} readOnly value={session.shareUrl} onFocus={(e) => e.currentTarget.select()} /></>}
          <Button asChild variant="outline"><a href={session.shareUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid="live-clean-output"><ExternalLink className="mr-2 h-4 w-4" />{t.output}</a></Button>
          <Button variant="outline" disabled={!canControl} onClick={() => void session.share()} data-testid="live-replace-link">{t.replace}</Button>
          <Button variant="destructive" disabled={!canControl} onClick={() => void session.revoke()} data-testid="live-revoke">{t.revoke}</Button>
        </div>
      </aside>}
    </div>
  </div>;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-zinc-950 px-6 text-center text-white">{children}</div>;
}
