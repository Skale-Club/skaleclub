import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Link2, Nfc } from 'lucide-react';
import { validateDestinationUrl } from '@shared/smartTags';
import { normalizeUrlInput, type DirectWriteItem } from '@shared/nfcApp';
import CustomerPicker, { customerPayload, type CustomerChoice } from './CustomerPicker';
import WriteSheet, { type WriteResult } from './WriteSheet';
import { errorMessage, nfcGet, nfcPost, pushRecent, shortUrl, timeAgo, useBanner } from './lib';
import { BTN_PRIMARY, Banner, CARD, CopyButton, FieldLabel, IdentityHeader, INPUT, LinkInput, Pill, Screen, TopBar } from './ui';

export default function DirectScreen() {
  const qc = useQueryClient();
  const { banner, show } = useBanner();
  const [current, setCurrent] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [label, setLabel] = useState('');
  const [customer, setCustomer] = useState<CustomerChoice>(null);
  const [writeOpen, setWriteOpen] = useState(false);
  const [target, setTarget] = useState('');

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('url');
    if (param) {
      setCurrent(param);
      setLink(param);
      pushRecent({ kind: 'direct', value: param });
    }
  }, []);

  const { data: writes } = useQuery({
    queryKey: ['nfc-app', 'direct-writes'],
    queryFn: () => nfcGet<DirectWriteItem[]>('/api/admin/smart-tag-direct-writes'),
    staleTime: 15_000,
  });

  const prepare = () => {
    const check = validateDestinationUrl(normalizeUrlInput(link), { allowHttp: true });
    if (!check.ok) return show({ tone: 'error', text: 'Informe um link completo, por exemplo https://cliente.com.' });
    setTarget(check.url);
    setWriteOpen(true);
  };

  const onWritten = async (result: WriteResult) => {
    await nfcPost<{ id: string }>('/api/admin/smart-tag-direct-writes', {
      url: target,
      label: label.trim() || undefined,
      method: result.method,
      verified: result.verified,
      ...customerPayload(customer),
    });
    pushRecent({ kind: 'direct', value: target });
    void qc.invalidateQueries({ queryKey: ['nfc-app', 'direct-writes'] });
    if (customer && !customer.customerId) void qc.invalidateQueries({ queryKey: ['nfc-app', 'customers'] });
    show({ tone: 'ok', text: 'Gravação registrada.' });
  };

  return (
    <Screen>
      <TopBar title="Link direto do cliente" />
      <Banner banner={banner} />

      <IdentityHeader kind="direct">
        <p className="text-xl font-bold text-white">O chip guarda o link do cliente</p>
        <p className="mt-1 flex items-start gap-2 text-sm text-emerald-100/80">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Sem analytics. Trocar o link exige regravar o chip.
        </p>
        {current && (
          <div className="mt-4 rounded-xl bg-black/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">Link atual no chip</p>
            <div className="mt-1 flex items-center gap-2">
              <a href={current} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all text-sm font-semibold text-white underline-offset-2 active:underline">
                {current}
              </a>
              <CopyButton text={current} />
            </div>
          </div>
        )}
      </IdentityHeader>

      <section className={`${CARD} mt-4 space-y-4 p-4`}>
        <div>
          <FieldLabel>{current ? 'Novo link' : 'Link do cliente'}</FieldLabel>
          <LinkInput value={link} onChange={setLink} onPasteFailed={() => show({ tone: 'error', text: 'Não consegui ler a área de transferência. Cole no campo.' })} />
        </div>
        <div>
          <FieldLabel>Cliente (opcional)</FieldLabel>
          <CustomerPicker value={customer} onChange={setCustomer} />
        </div>
        <div>
          <FieldLabel>Rótulo (opcional)</FieldLabel>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Placa da recepção" maxLength={120} className={INPUT} />
        </div>
        <button
          type="button"
          onClick={prepare}
          disabled={!link.trim()}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-base font-bold text-white transition-colors active:bg-emerald-600 disabled:opacity-50"
          data-testid="button-write-direct"
        >
          <Nfc className="h-5 w-5" />
          Gravar no chip
        </button>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Últimos links diretos</h2>
        {!writes || writes.length === 0 ? (
          <div className={`${CARD} px-6 py-8 text-center text-sm text-slate-400`}>Nenhuma gravação direta ainda.</div>
        ) : (
          <ul className={`${CARD} divide-y divide-white/10 overflow-hidden`}>
            {writes.slice(0, 12).map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                  <Link2 className="h-4 w-4" />
                </span>
                <button type="button" onClick={() => { setLink(w.url); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-white">{shortUrl(w.url)}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {[w.customerName, w.label].filter(Boolean).join(' | ') || 'Sem cliente'}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pill tone={w.verified ? 'green' : 'slate'}>{w.verified ? 'Conferido' : 'Gravado'}</Pill>
                  <span className="text-xs text-slate-500">{timeAgo(new Date(w.createdAt).getTime())}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WriteSheet open={writeOpen} url={target} identity="direct" onClose={() => setWriteOpen(false)} onDone={onWritten} />
    </Screen>
  );
}
