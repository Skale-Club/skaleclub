import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Search, Tag } from 'lucide-react';
import type { SmartTagListItem } from '@shared/smartTagsApi';
import { nfcGet, shortUrl } from './lib';
import { tagStatusPill } from './labels';
import { CARD, ICON_BLOCK_SKALE, INPUT, Pill, Spinner } from './ui';

// Home search: the full printed code opens the piece directly; anything
// shorter searches codes, customers, labels and batches as you type.

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
const LIMIT = 8;

/** Crockford reading of a code fragment typed from a printed piece (O→0, I/L→1). */
function codeFragment(raw: string): string | null {
  const value = raw.trim();
  if (!/^[0-9a-z\s-]{2,12}$/i.test(value)) return null;
  return value.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

async function searchTags(term: string): Promise<SmartTagListItem[]> {
  const terms = [term];
  const fragment = codeFragment(term);
  if (fragment && fragment !== term.toUpperCase()) terms.push(fragment);
  const lists = await Promise.all(
    terms.map((t) => nfcGet<SmartTagListItem[]>(`/api/admin/smart-tags?search=${encodeURIComponent(t)}&limit=${LIMIT}`)),
  );
  const seen = new Set<string>();
  const merged: SmartTagListItem[] = [];
  for (const item of lists.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  // Code matches first: that is what the operator is usually typing.
  const needle = (fragment ?? term).toUpperCase();
  return merged
    .sort((a, b) => Number(!a.publicCode.startsWith(needle)) - Number(!b.publicCode.startsWith(needle)))
    .slice(0, LIMIT);
}

export function TagSearch({
  busy,
  onSubmit,
  onOpen,
}: {
  busy: boolean;
  /** Enter / arrow: the parent resolves full codes and links. */
  onSubmit: (text: string) => void;
  onOpen: (publicCode: string) => void;
}) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<SmartTagListItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = text.trim();
    if (term.length < MIN_CHARS) {
      setResults(null);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchTags(term)
        .then((list) => {
          if (id !== seq.current) return;
          setResults(list);
          setFailed(false);
        })
        .catch(() => {
          if (id === seq.current) setFailed(true);
        })
        .finally(() => {
          if (id === seq.current) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const submit = () => {
    const term = text.trim();
    if (!term) return;
    // One match: open it, even from a partial code or a customer name.
    if (results?.length === 1) return onOpen(results[0].publicCode);
    onSubmit(term);
  };

  return (
    <div className="mt-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fog-400" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Código, cliente ou lote"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
            className={`${INPUT} pl-12`}
            data-testid="input-tag-code"
          />
        </div>
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Abrir tag"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-white/10 bg-navy-800 text-fog-50 active:bg-navy-700 disabled:opacity-40"
        >
          {busy || searching ? <Spinner /> : <ChevronRight className="h-6 w-6" />}
        </button>
      </form>

      {failed && <p className="mt-2 px-1 text-sm text-red-300">Não consegui buscar agora. Tente de novo.</p>}

      {results && !failed && (
        results.length === 0 ? (
          <p className="mt-2 px-1 text-sm text-fog-400" data-testid="text-search-empty">
            Nenhuma tag encontrada para “{text.trim()}”.
          </p>
        ) : (
          <ul className={`${CARD} mt-2 divide-y divide-white/10 overflow-hidden`} data-testid="list-search-results">
            {results.map((tag) => {
              const pill = tagStatusPill(tag.status);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(tag.publicCode)}
                    className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2 text-left active:bg-white/10"
                  >
                    <span className={`h-9 w-9 shrink-0 ${ICON_BLOCK_SKALE}`}>
                      <Tag className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-base font-semibold tracking-wider text-fog-50">{tag.publicCode}</span>
                      <span className="block truncate text-xs text-fog-400">
                        {tag.customerName ?? tag.label ?? 'Sem cliente'}
                        {tag.destinationUrl ? ` · ${shortUrl(tag.destinationUrl)}` : ''}
                      </span>
                    </span>
                    <Pill tone={pill.tone}>{pill.text}</Pill>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
