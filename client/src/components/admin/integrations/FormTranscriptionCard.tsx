import { useEffect, useState } from 'react';
import { Mic, Save } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';

type TranscriptionProvider = 'groq' | 'openrouter';

type TranscriptionSettings = {
  provider: TranscriptionProvider;
  model: string;
  enabled: boolean;
};

const PROVIDER_MODELS: Record<TranscriptionProvider, { value: string; label: string }[]> = {
  groq: [
    { value: 'whisper-large-v3-turbo', label: 'whisper-large-v3-turbo' },
    { value: 'whisper-large-v3', label: 'whisper-large-v3' },
  ],
  openrouter: [
    { value: 'openai/whisper-large-v3', label: 'openai/whisper-large-v3' },
    { value: 'openai/whisper-1', label: 'openai/whisper-1' },
  ],
};

export function FormTranscriptionCard() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<TranscriptionProvider>('groq');
  const [model, setModel] = useState('whisper-large-v3-turbo');
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data } = useQuery<TranscriptionSettings>({
    queryKey: ['/api/integrations/form-transcription'],
  });

  useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setModel(data.model);
    setEnabled(data.enabled);
  }, [data]);

  const save = async (next?: Partial<TranscriptionSettings>) => {
    const nextProvider = next?.provider ?? provider;
    const nextModel = next?.model ?? model;
    const nextEnabled = next?.enabled ?? enabled;
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/form-transcription', {
        provider: nextProvider,
        model: nextModel,
        enabled: nextEnabled,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/form-transcription'] });
      toast({ title: 'Form transcription settings saved' });
    } catch (error: any) {
      toast({ title: 'Failed to save transcription settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const changeProvider = (nextProvider: TranscriptionProvider) => {
    setProvider(nextProvider);
    const nextModel = PROVIDER_MODELS[nextProvider][0].value;
    setModel(nextModel);
  };

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Form Voice Transcription</CardTitle>
            <p className="text-sm text-muted-foreground">Choose the speech-to-text provider for public forms</p>
          </div>
          <Switch
            className="ml-auto"
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              void save({ enabled: checked });
            }}
            disabled={isSaving}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={(value) => changeProvider(value as TranscriptionProvider)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="groq">Groq Whisper</SelectItem>
              <SelectItem value="openrouter">OpenRouter STT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_MODELS[provider].map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => save()} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
