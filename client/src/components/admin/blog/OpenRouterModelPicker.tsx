import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  outputModalities?: string[];
};

export type OpenRouterModelsResponse = {
  models: OpenRouterModel[];
  count?: number;
  warning?: string;
};

type Props = {
  value: string;
  onChange: (modelId: string) => void;
  models: OpenRouterModel[];
  isLoading: boolean;
  placeholder: string;
  testId: string;
};

// Searchable model combobox — same ranking behavior as the Integrations
// OpenRouter tab, reused for the blog's text/image model pickers.
export function OpenRouterModelPicker({ value, onChange, models, isLoading, placeholder, testId }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return models;
    const terms = query.split(/\s+/).filter(Boolean);
    return models
      .map((model) => {
        const id = (model.id || '').toLowerCase();
        const name = (model.name || '').toLowerCase();
        const description = (model.description || '').toLowerCase();
        const haystack = `${id} ${name} ${description}`;
        if (!terms.every((term) => haystack.includes(term))) return null;
        let score = 0;
        if (id.startsWith(query)) score += 4;
        if (id.includes(query)) score += 3;
        if (name.startsWith(query)) score += 2;
        if (name.includes(query)) score += 1;
        return { model, score };
      })
      .filter((item): item is { model: OpenRouterModel; score: number } => Boolean(item))
      .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id))
      .map((item) => item.model);
  }, [models, search]);

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid={testId}
        >
          <span className={`truncate text-left ${value ? '' : 'text-muted-foreground'}`}>
            {value || placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search models..." value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72">
            <CommandEmpty>{isLoading ? 'Loading models...' : 'No models found for this search.'}</CommandEmpty>
            {filtered.map((model) => (
              <CommandItem
                key={model.id}
                value={`${model.id} ${model.name || ''}`}
                onSelect={() => {
                  onChange(model.id);
                  setOpen(false);
                  setSearch('');
                }}
                className="items-start py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{model.id}</span>
                  <span className="truncate text-xs text-muted-foreground">{model.name || 'OpenRouter model'}</span>
                </div>
                <Check className={`ml-2 mt-0.5 h-4 w-4 ${value === model.id ? 'opacity-100' : 'opacity-0'}`} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
