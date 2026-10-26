import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { aiErrorMessage, type AiLanguage } from '../ai/boardsAiApi';

function Choice<T extends string | number>({ value, options, onChange, testId }: { value: T; options: { id: T; label: string }[]; onChange: (value: T) => void; testId: string }) {
  return (
    <div className="inline-flex gap-1 rounded-xl border p-1" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          data-testid={`${testId}-${option.id}`}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.id ? 'bg-[#5173D6] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// "Generate mind map from a topic".
export function AiGenerateDialog({
  open,
  onOpenChange,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (input: { topic: string; depth: 2 | 3; language: AiLanguage }) => Promise<unknown>;
}) {
  const { t, language: uiLanguage } = useTranslation();
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<2 | 3>(2);
  const [language, setLanguage] = useState<AiLanguage>(uiLanguage === 'pt' ? 'pt' : 'en');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setLanguage(uiLanguage === 'pt' ? 'pt' : 'en');
    else setTopic('');
  }, [open, uiLanguage]);

  async function submit() {
    const value = topic.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onGenerate({ topic: value, depth, language });
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('Could not generate the mind map'), description: t(aiErrorMessage(err)), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" data-testid="board-ai-generate-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#5173D6]" />
            {t('Generate mind map from a topic')}
          </DialogTitle>
          <DialogDescription>{t('The map is added at the center of your view. You can undo it in one step.')}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="board-ai-topic">{t('Topic')}</Label>
            <Input
              id="board-ai-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('e.g. Launching a podcast')}
              maxLength={300}
              autoFocus
              data-testid="board-ai-topic"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="space-y-1.5">
              <Label>{t('Depth')}</Label>
              <div>
                <Choice
                  value={depth}
                  options={[
                    { id: 2, label: t('2 levels') },
                    { id: 3, label: t('3 levels') },
                  ]}
                  onChange={setDepth}
                  testId="board-ai-depth"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('Language')}</Label>
              <div>
                <Choice
                  value={language}
                  options={[
                    { id: 'en', label: 'English' },
                    { id: 'pt', label: 'Português' },
                  ]}
                  onChange={setLanguage}
                  testId="board-ai-language"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={!topic.trim() || busy} className="gap-2" data-testid="board-ai-generate">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? t('Generating…') : t('Generate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// "Summarize board": shows the text with a copy button.
export function AiSummaryDialog({
  open,
  onOpenChange,
  loading,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  summary: string | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('Could not copy the summary'), variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="board-ai-summary-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#5173D6]" />
            {t('Board summary')}
          </DialogTitle>
          <DialogDescription>{t('Written by AI from the content of this board. Check it before sharing.')}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" data-testid="board-ai-summary-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('Summarizing…')}
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed" data-testid="board-ai-summary-text">
            {summary}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
          <Button onClick={() => void copy()} disabled={!summary || loading} className="gap-2" data-testid="board-ai-summary-copy">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t('Copied') : t('Copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
