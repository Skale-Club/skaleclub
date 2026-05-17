import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mic, MicOff, Sparkles, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, queryClient } from '@/lib/queryClient';

export type GeneratePresentationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: { id: string; slug: string }) => void;
};

export function GeneratePresentationDialog({
  open,
  onOpenChange,
  onSuccess,
}: GeneratePresentationDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [genTitle, setGenTitle] = useState('');
  const [genPrompt, setGenPrompt] = useState('');
  const [audioData, setAudioData] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionPreview, setTranscriptionPreview] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => { setAudioData(reader.result as string); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({ title: t('Microphone access denied'), variant: 'destructive' });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function resetState() {
    setGenTitle('');
    setGenPrompt('');
    setAudioData(null);
    setTranscriptionPreview('');
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Transcribe audio if present (D-05)
      let transcription = '';
      if (audioData) {
        const transcribeRes = await apiRequest('POST', '/api/presentations/transcribe', { audioData });
        if (!transcribeRes.ok) throw new Error('Audio transcription failed');
        const transcribeData = await transcribeRes.json();
        transcription = transcribeData.transcription || '';
        setTranscriptionPreview(transcription);
      }
      // Step 2: Build merged prompt (D-06)
      const mergedPrompt = transcription && genPrompt
        ? `[Audio input]: ${transcription}\n\n[Additional context]: ${genPrompt}`
        : transcription || genPrompt;
      if (!mergedPrompt.trim()) throw new Error('Please enter a prompt or record audio');
      // Step 3: Generate presentation (D-08)
      const res = await apiRequest('POST', '/api/presentations/generate', {
        title: genTitle.trim(),
        prompt: mergedPrompt,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || 'Generation failed');
      }
      return res.json() as Promise<{ id: string; slug: string }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      onOpenChange(false);
      resetState();
      onSuccess(result);  // D-03: navigate to new presentation editor
    },
    onError: (err: any) => {
      toast({ title: t('Generation failed'), description: err.message, variant: 'destructive' });
    },
  });

  function handleOpenChange(o: boolean) {
    onOpenChange(o);
    if (!o) {
      resetState();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {t('Generate Presentation with AI')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="gen-title" className="text-xs">{t('Title')}</Label>
            <Input
              id="gen-title"
              placeholder="e.g. Acme Corp Agency Intro"
              value={genTitle}
              onChange={(e) => setGenTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-prompt" className="text-xs">{t('Context prompt')}</Label>
            <Textarea
              id="gen-prompt"
              placeholder="Describe the presentation: client, tone, number of slides, key messages..."
              rows={4}
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t('Audio input (optional)')}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isRecording ? 'destructive' : 'outline'}
                size="sm"
                onClick={isRecording ? stopRecording : startRecording}
                className="gap-2"
                disabled={generateMutation.isPending}
              >
                {isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isRecording ? t('Stop recording') : t('Record audio')}
              </Button>
              {audioData && !isRecording && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <MicOff className="w-3 h-3" />
                  {t('Audio captured')}
                </span>
              )}
            </div>
            {transcriptionPreview && (
              <p className="text-xs text-muted-foreground italic truncate">
                {t('Transcription')}: {transcriptionPreview}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={generateMutation.isPending}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!genTitle.trim() || (!genPrompt.trim() && !audioData) || generateMutation.isPending}
            className="gap-2"
          >
            {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Sparkles className="w-4 h-4" />
            {t('Generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
