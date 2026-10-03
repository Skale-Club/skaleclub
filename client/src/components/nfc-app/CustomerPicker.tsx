import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, User, X } from 'lucide-react';
import type { SmartTagCustomerItem } from '@shared/smartTagsApi';
import { nfcGet } from './lib';
import { INPUT } from './ui';

export type CustomerChoice = { customerId: string; name: string } | { customerId: null; name: string } | null;

interface Props {
  value: CustomerChoice;
  onChange: (v: CustomerChoice) => void;
}

/** Pick an existing customer or type a new name (created by the server on save). */
export default function CustomerPicker({ value, onChange }: Props) {
  const [text, setText] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['nfc-app', 'customers'],
    queryFn: () => nfcGet<SmartTagCustomerItem[]>('/api/admin/smart-tag-customers'),
    staleTime: 60_000,
  });

  const query = text.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = data ?? [];
    const filtered = query ? list.filter((c) => c.businessName.toLowerCase().includes(query)) : list;
    return filtered.slice(0, 6);
  }, [data, query]);
  const exact = (data ?? []).some((c) => c.businessName.toLowerCase() === query);

  if (value) {
    return (
      <div className="flex min-h-[48px] items-center gap-3 rounded-none border border-white/10 bg-navy-900 pl-4 pr-1">
        <User className="h-4 w-4 shrink-0 text-fog-400" />
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-fog-50">{value.name}</span>
        {!value.customerId && <span className="shrink-0 rounded-full bg-cta/15 px-2 py-0.5 text-xs font-semibold text-cta-soft">novo</span>}
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setText('');
          }}
          aria-label="Trocar cliente"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fog-300 active:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isLoading ? 'Carregando clientes' : 'Buscar ou digitar nome do cliente'}
        autoCapitalize="words"
        className={INPUT}
      />
      {(matches.length > 0 || query) && (
        <ul className="mt-2 divide-y divide-white/10 overflow-hidden rounded-none border border-white/10 bg-navy-900">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChange({ customerId: c.id, name: c.businessName })}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-white/10"
              >
                <span className="truncate text-base text-fog-50">{c.businessName}</span>
                <span className="shrink-0 text-xs text-fog-400">{c.tagCount} tag{c.tagCount === 1 ? '' : 's'}</span>
              </button>
            </li>
          ))}
          {query && !exact && (
            <li>
              <button
                type="button"
                onClick={() => onChange({ customerId: null, name: text.trim() })}
                className="flex min-h-[48px] w-full items-center gap-2 px-4 py-2 text-left text-base font-semibold text-cta-soft active:bg-white/10"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Criar cliente "{text.trim()}"</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function customerPayload(choice: CustomerChoice): { customerId?: string; customerName?: string } {
  if (!choice) return {};
  return choice.customerId ? { customerId: choice.customerId } : { customerName: choice.name };
}
