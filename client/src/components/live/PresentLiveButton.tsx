import { useState } from 'react';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { liveRequest, storeController, useLiveSharingEnabled } from '@/lib/liveSharing';
import type { LiveKind, LiveSessionView } from '@shared/liveSharing';

export function PresentLiveButton({ kind, sourceId }: { kind: LiveKind; sourceId: string }) {
  const enabled = useLiveSharingEnabled();
  const [pending, setPending] = useState(false);
  const { language } = useTranslation();
  const { toast } = useToast();
  const pt = language === 'pt';
  if (!enabled) return null;
  async function start() {
    if (pending) return;
    setPending(true);
    try {
      const result = await liveRequest<LiveSessionView & { controllerToken: string }>('', {
        kind, sourceId, language: pt ? 'pt-BR' : 'en',
      });
      storeController(result.state.id, result.controllerToken);
      window.location.assign(`/live/${encodeURIComponent(result.state.id)}/present`);
    } catch {
      toast({ variant: 'destructive', title: pt ? 'Não foi possível iniciar a sessão' : 'Could not start live session' });
      setPending(false);
    }
  }
  return <Button variant="outline" size="sm" disabled={pending} onClick={start} data-testid={`present-live-${sourceId}`}>
    <Radio className="mr-2 h-4 w-4" aria-hidden="true" />
    {pending ? (pt ? 'Iniciando…' : 'Starting…') : (pt ? 'Apresentar ao vivo' : 'Present live')}
  </Button>;
}
