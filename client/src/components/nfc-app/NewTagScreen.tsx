import { useState } from 'react';
import { useLocation } from 'wouter';
import { Check, Plus } from 'lucide-react';
import { SMART_TAG_PRODUCT_TYPES, type SmartTagProductType } from '@shared/smartTags';
import type { SmartTagDetail } from '@shared/smartTagsApi';
import { PRODUCT_LABELS_PT } from './labels';
import { errorMessage, haptic, nfcPost, pushRecent, useBanner } from './lib';
import { BTN_PRIMARY, Banner, CARD, FieldLabel, INPUT, Screen, Spinner, TopBar } from './ui';

export default function NewTagScreen() {
  const [, navigate] = useLocation();
  const { banner, show } = useBanner();
  const [productType, setProductType] = useState<SmartTagProductType>('keychain');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const tag = await nfcPost<SmartTagDetail>('/api/admin/smart-tags', {
        productType,
        label: label.trim() || undefined,
      });
      haptic(40);
      pushRecent({ kind: 'skale', value: tag.publicCode });
      navigate(`/nfc/t/${encodeURIComponent(tag.publicCode)}?write=1`);
    } catch (err) {
      show({ tone: 'error', text: errorMessage(err) });
      setBusy(false);
    }
  };

  return (
    <Screen hero={<TopBar title="Nova tag Skale" eyebrow="Tag Skale" />}>
      <Banner banner={banner} />
      <p className="mb-4 px-1 text-sm text-fog-400">Cria uma tag avulsa com código novo e já abre a gravação do chip.</p>

      <section className={`${CARD} p-4`}>
        <FieldLabel>Tipo de peça</FieldLabel>
        <div className="grid grid-cols-1 gap-2">
          {SMART_TAG_PRODUCT_TYPES.map((t) => {
            const active = t === productType;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setProductType(t)}
                aria-pressed={active}
                className={`flex min-h-[52px] items-center justify-between rounded-none border px-4 text-left text-base font-semibold transition-colors ${
                  active ? 'border-cta bg-cta/15 text-fog-50' : 'border-white/10 bg-navy-900 text-fog-200 active:bg-navy-700'
                }`}
              >
                {PRODUCT_LABELS_PT[t]}
                {active && <Check className="h-5 w-5 text-cta-soft" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <FieldLabel>Rótulo (opcional)</FieldLabel>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Mesa 4" maxLength={120} className={INPUT} />
        </div>

        <button type="button" onClick={() => void create()} disabled={busy} className={`${BTN_PRIMARY} mt-5`} data-testid="button-create-tag">
          {busy ? <Spinner /> : <Plus className="h-5 w-5" />}
          Criar e gravar chip
        </button>
      </section>
    </Screen>
  );
}
