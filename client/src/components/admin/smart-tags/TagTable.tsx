import type { SmartTagListItem } from '@shared/smartTagsApi';
import { formatDateTime } from './api';
import { destinationLabel, productLabel, StatusBadge } from './shared';

const NFC_SHORT: Record<string, string> = {
  not_programmed: '—',
  programmed: 'Written',
  verified: 'Verified',
  locked: 'Locked',
  failed: 'Failed',
};

/** Tag list: a table on desktop, tappable cards on phones. */
export function TagTable({
  tags,
  onOpen,
  showCustomer = true,
  showBatch = true,
}: {
  tags: SmartTagListItem[];
  onOpen: (id: string) => void;
  showCustomer?: boolean;
  showBatch?: boolean;
}) {
  if (tags.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No tags match.</p>;
  }
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {tags.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onOpen(t.id)}
              className="w-full rounded-xl border border-border bg-card p-3 text-left active:bg-muted"
              data-testid={`smart-tag-card-${t.publicCode}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold">{t.publicCode}</span>
                <StatusBadge status={t.status} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {productLabel(t.productType)}
                {showCustomer && t.customerName ? ` · ${t.customerName}` : ''}
                {showBatch && t.batchCode ? ` · ${t.batchCode}` : ''}
              </div>
              <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                QR {t.qrInteractions} · NFC {t.nfcInteractions} · chip {NFC_SHORT[t.nfcStatus] ?? t.nfcStatus} · last {formatDateTime(t.lastInteractionAt)}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">Status</th>
              {showCustomer ? <th className="py-2 pr-3">Customer</th> : null}
              <th className="py-2 pr-3">Destination</th>
              <th className="py-2 pr-3">Chip</th>
              <th className="py-2 pr-3 text-right">QR</th>
              <th className="py-2 pr-3 text-right">NFC</th>
              <th className="py-2 pr-3">Last interaction</th>
              {showBatch ? <th className="py-2">Batch</th> : null}
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                onClick={() => onOpen(t.id)}
                data-testid={`smart-tag-row-${t.publicCode}`}
              >
                <td className="py-2 pr-3 font-mono font-semibold">
                  {t.publicCode}
                  {t.serialNumber ? <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">#{t.serialNumber}</span> : null}
                </td>
                <td className="py-2 pr-3">{productLabel(t.productType)}</td>
                <td className="py-2 pr-3"><StatusBadge status={t.status} /></td>
                {showCustomer ? <td className="py-2 pr-3">{t.customerName ?? '—'}</td> : null}
                <td className="py-2 pr-3">{destinationLabel(t.destinationType)}</td>
                <td className={`py-2 pr-3 text-xs ${t.nfcStatus === 'failed' ? 'text-destructive' : t.nfcStatus === 'verified' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  {NFC_SHORT[t.nfcStatus] ?? t.nfcStatus}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.qrInteractions}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.nfcInteractions}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(t.lastInteractionAt)}</td>
                {showBatch ? <td className="py-2 font-mono text-xs">{t.batchCode ?? '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
