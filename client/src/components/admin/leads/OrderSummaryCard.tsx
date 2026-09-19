import { ExternalLink, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NFC_SNAPSHOT_KEYS } from '@shared/nfc-pricing';
import type { FormLead } from '@shared/schema';

// Everything the order pipeline writes into custom_answers. Listed here so the
// raw key/value fallback below the form answers can hide them — they are shown
// properly by this card instead.
export const ORDER_SNAPSHOT_KEYS = new Set<string>([
  ...NFC_SNAPSHOT_KEYS,
  'nfcPreviousOrders',
  'nfcDeclaredReturning',
  'nfcOrderNotifiedAt',
]);

export function hasOrderSnapshot(lead: FormLead): boolean {
  return Boolean(lead.customAnswers?.nfcTotal);
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={strong ? 'text-lg font-bold text-foreground tabular-nums' : 'text-sm font-medium text-foreground'}>
        {value}
      </p>
    </div>
  );
}

/**
 * The order as the team needs to read it before calling: what was asked for,
 * what it was quoted at, whether this person has ordered before, and the logo
 * they uploaded.
 *
 * Every figure is the snapshot frozen by the server at completion — not a live
 * recalculation — so it keeps showing what the customer was actually quoted
 * even after the price table is tuned.
 */
export function OrderSummaryCard({ lead }: { lead: FormLead }) {
  const answers = lead.customAnswers || {};
  const previousOrders = Number.parseInt(answers.nfcPreviousOrders || '0', 10) || 0;
  const isReturning = previousOrders > 0 || answers.nfcDeclaredReturning === 'yes';
  const logoUrl = answers.logo;
  const logoName = answers.logo__filename || 'Uploaded file';

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-base">Order</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={isReturning ? 'secondary' : 'outline'}>
            {isReturning
              ? `Returning customer${previousOrders ? ` · ${previousOrders} previous` : ''}`
              : 'New customer'}
          </Badge>
          {/* Worth flagging: they said one thing, the phone lookup says another. */}
          {answers.nfcDeclaredReturning === 'yes' && previousOrders === 0 && (
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
              Says returning, no past order found
            </Badge>
          )}
          {answers.nfcPricingVersion && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {answers.nfcPricingVersion}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Figure label="Quantity" value={`${answers.nfcQuantity || '?'} pieces`} />
        <Figure label="Type" value={answers.nfcTypeLabel || answers.nfcTypeId || '?'} />
        <Figure label="Per piece" value={answers.nfcUnitPrice || '?'} />
        <Figure label="Quoted total" value={answers.nfcTotal || '?'} strong />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-primary/20 pt-3 text-sm">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Subtotal / art fee</p>
          <p className="font-medium tabular-nums">
            {answers.nfcSubtotal || '?'} + {answers.nfcArtFee || '$0.00'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Logo</p>
          {logoUrl ? (
            <a
              href={logoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline break-all"
              data-testid="link-order-logo"
            >
              {logoName}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <p className="font-medium text-muted-foreground">Not sent</p>
          )}
        </div>
      </div>

      {answers.enderecoEnvio && (
        <div className="border-t border-primary/20 pt-3">
          <p className="text-xs uppercase text-muted-foreground">Ship to</p>
          <p className="text-sm font-medium whitespace-pre-wrap">{answers.enderecoEnvio}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Estimate quoted to the customer. Nothing has been charged — confirm the total on the call before production.
      </p>
    </div>
  );
}
