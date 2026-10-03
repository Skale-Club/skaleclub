import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Nfc, Power, QrCode, ScanLine, Search } from 'lucide-react';
import type { SmartTagDetail } from '@shared/smartTagsApi';
import { SMART_TAG_DESTINATION_TYPES, validateDestinationUrl, type SmartTagDestinationType } from '@shared/smartTags';
import { guessDestinationType, normalizeUrlInput } from '@shared/nfcApp';
import CustomerPicker, { customerPayload, type CustomerChoice } from './CustomerPicker';
import WriteSheet, { type WriteResult } from './WriteSheet';
import { chipStatusPill, DESTINATION_LABELS_PT, tagStatusPill } from './labels';
import { errorMessage, haptic, lookupTag, nfcGet, nfcPost, pushRecent, shortUrl, useBanner } from './lib';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_TERTIARY,
  Banner,
  CARD,
  FieldLabel,
  IdentityHeader,
  INPUT,
  LinkInput,
  OPTION,
  Pill,
  Screen,
  Spinner,
  TopBar,
} from './ui';

async function fetchTag(code: string): Promise<SmartTagDetail | null> {
  const found = await lookupTag(code);
  if (!found) return null;
  return nfcGet<SmartTagDetail>(`/api/admin/smart-tags/${found.id}`);
}

export default function TagScreen({ code }: { code: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { banner, show } = useBanner();
  const queryKey = ['nfc-app', 'tag', code];
  const { data: tag, isLoading, error } = useQuery({ queryKey, queryFn: () => fetchTag(code), staleTime: 0 });

  const [link, setLink] = useState('');
  const [type, setType] = useState<SmartTagDestinationType>('website');
  const [typeTouched, setTypeTouched] = useState(false);
  const [customer, setCustomer] = useState<CustomerChoice>(null);
  const [busy, setBusy] = useState<'save' | 'toggle' | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);

  // Seed the form once per tag load.
  useEffect(() => {
    if (!tag || seeded === tag.id) return;
    setSeeded(tag.id);
    setLink(tag.destinationUrl ?? '');
    if (tag.destinationType && (SMART_TAG_DESTINATION_TYPES as readonly string[]).includes(tag.destinationType)) {
      setType(tag.destinationType as SmartTagDestinationType);
      setTypeTouched(true);
    }
    pushRecent({ kind: 'skale', value: tag.publicCode });
    if (new URLSearchParams(window.location.search).get('write') === '1') {
      window.history.replaceState(null, '', `/nfc/t/${encodeURIComponent(tag.publicCode)}`);
      setWriteOpen(true);
    }
  }, [tag, seeded]);

  const onLink = (value: string) => {
    setLink(value);
    if (!typeTouched) setType(guessDestinationType(value));
  };

  const setDetail = useCallback((detail: SmartTagDetail) => qc.setQueryData(queryKey, detail), [qc, code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <Screen hero={<TopBar title="Tag Skale" eyebrow="Tag Skale" identity="skale" />}>
        <div className="flex justify-center py-20 text-fog-400">
          <Spinner className="h-8 w-8" />
        </div>
      </Screen>
    );
  }

  if (error || !tag) {
    return (
      <Screen hero={<TopBar title="Tag Skale" eyebrow="Tag Skale" identity="skale" />}>
        <div className={`${CARD} mt-4 p-6 text-center`}>
          <ScanLine className="mx-auto h-10 w-10 text-fog-400" />
          <p className="mt-3 text-xl font-semibold tracking-[-0.02em] text-fog-50">{error ? 'Não consegui carregar' : 'Tag não encontrada'}</p>
          <p className="mt-1 text-sm text-fog-400">{error ? errorMessage(error) : `Nenhuma tag com o código ${code}.`}</p>
          <button type="button" onClick={() => navigate('/nfc/home')} className={`${BTN_SECONDARY} mt-5`}>
            Voltar ao início
          </button>
        </div>
      </Screen>
    );
  }

  const status = tagStatusPill(tag.status);
  const chip = chipStatusPill(tag.nfcStatus);
  const needsCustomer = !tag.customerId;
  const disabled = tag.status === 'disabled';

  const save = async () => {
    const normalized = normalizeUrlInput(link);
    const check = validateDestinationUrl(normalized, { allowHttp: true });
    if (!check.ok) return show({ tone: 'error', text: 'Informe um link completo, por exemplo https://cliente.com.' });
    if (needsCustomer && !customer) return show({ tone: 'error', text: 'Escolha o cliente dessa tag.' });
    setBusy('save');
    try {
      const detail = await nfcPost<SmartTagDetail>(`/api/admin/smart-tags/${tag.id}/quick-activate`, {
        destinationUrl: check.url,
        destinationType: type,
        ...(needsCustomer ? customerPayload(customer) : {}),
      });
      setDetail(detail);
      setLink(detail.destinationUrl ?? check.url);
      if (customer && !customer.customerId) void qc.invalidateQueries({ queryKey: ['nfc-app', 'customers'] });
      haptic([40, 30, 40]);
      show({ tone: 'ok', text: 'Link salvo e tag ativa.' });
    } catch (err) {
      show({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const toggle = async () => {
    setBusy('toggle');
    try {
      const detail = await nfcPost<SmartTagDetail>(`/api/admin/smart-tags/${tag.id}/${disabled ? 'activate' : 'disable'}`);
      setDetail(detail);
      show({ tone: 'ok', text: disabled ? 'Tag reativada.' : 'Tag desativada.' });
    } catch (err) {
      show({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const onWritten = async (result: WriteResult) => {
    const detail = await nfcPost<SmartTagDetail>(`/api/admin/smart-tags/${tag.id}/nfc-written`, {
      readbackUrl: result.readbackUrl,
      method: result.method,
    });
    setDetail(detail);
  };

  return (
    <Screen hero={<TopBar title={tag.customerName ?? 'Tag sem cliente'} eyebrow="Tag Skale" identity="skale" />}>
      <Banner banner={banner} />

      <IdentityHeader kind="skale">
        <p className="font-mono text-4xl font-semibold tracking-[0.2em] text-fog-50" data-testid="text-tag-code">
          {tag.publicCode}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone={status.tone}>{status.text}</Pill>
          <Pill tone={chip.tone}>{chip.text}</Pill>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-fog-400">Cliente</dt>
            <dd className="truncate font-semibold text-fog-50">{tag.customerName ?? 'Sem cliente'}</dd>
          </div>
          {tag.label && (
            <div className="flex justify-between gap-4">
              <dt className="text-fog-400">Rótulo</dt>
              <dd className="truncate font-semibold text-fog-50">{tag.label}</dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <dt className="text-fog-400">Destino</dt>
            <dd className="min-w-0 text-right font-semibold text-fog-50">
              {tag.destinationUrl ? (
                <a href={tag.destinationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-cta-soft underline-offset-2 active:underline">
                  <span className="truncate">{shortUrl(tag.destinationUrl)}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : (
                'Nenhum ainda'
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-none border border-white/10 bg-navy-900 py-2">
            <QrCode className="mx-auto h-4 w-4 text-cta-soft" />
            <p className="text-xl font-semibold text-fog-50">{tag.qrInteractions}</p>
            <p className="text-xs text-fog-400">scans de QR</p>
          </div>
          <div className="rounded-none border border-white/10 bg-navy-900 py-2">
            <Nfc className="mx-auto h-4 w-4 text-cta-soft" />
            <p className="text-xl font-semibold text-fog-50">{tag.nfcInteractions}</p>
            <p className="text-xs text-fog-400">toques NFC</p>
          </div>
        </div>
      </IdentityHeader>

      <section className={`${CARD} mt-4 space-y-4 p-4`}>
        <div>
          <FieldLabel>Link de destino</FieldLabel>
          <LinkInput value={link} onChange={onLink} onPasteFailed={() => show({ tone: 'error', text: 'Não consegui ler a área de transferência. Cole no campo.' })} />
        </div>
        <div>
          <FieldLabel>Tipo de destino</FieldLabel>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as SmartTagDestinationType);
              setTypeTouched(true);
            }}
            className={INPUT}
          >
            {SMART_TAG_DESTINATION_TYPES.map((t) => (
              <option key={t} value={t} className={OPTION}>
                {DESTINATION_LABELS_PT[t]}
              </option>
            ))}
          </select>
        </div>
        {needsCustomer && (
          <div>
            <FieldLabel>Cliente (obrigatório)</FieldLabel>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
        )}
        <button type="button" onClick={() => void save()} disabled={busy !== null || !link.trim()} className={BTN_PRIMARY} data-testid="button-save-activate">
          {busy === 'save' ? <Spinner /> : <Power className="h-5 w-5" />}
          {tag.status === 'active' ? 'Salvar link' : 'Salvar e ativar'}
        </button>
      </section>

      <div className="mt-4 space-y-2">
        <button type="button" onClick={() => setWriteOpen(true)} className={BTN_SECONDARY}>
          <Nfc className="h-5 w-5 text-cta-ink" />
          {tag.nfcStatus === 'not_programmed' ? 'Gravar chip' : 'Regravar chip'}
        </button>
        {(tag.status === 'active' || disabled) && (
          <button type="button" onClick={() => void toggle()} disabled={busy !== null} className={BTN_TERTIARY}>
            {busy === 'toggle' ? <Spinner /> : <Power className={`h-5 w-5 ${disabled ? 'text-emerald-400' : 'text-red-400'}`} />}
            {disabled ? 'Reativar tag' : 'Desativar tag'}
          </button>
        )}
        <button type="button" onClick={() => navigate('/nfc/home')} className="flex min-h-[48px] w-full items-center justify-center gap-2 text-sm font-semibold text-fog-400 active:text-fog-50">
          <Search className="h-4 w-4" />
          Ler outra tag
        </button>
      </div>

      <WriteSheet open={writeOpen} url={tag.nfcUrl} identity="skale" onClose={() => setWriteOpen(false)} onDone={onWritten} />
    </Screen>
  );
}
