import { useRef, useState } from "react";
import { Loader2, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const MAX_SECONDS = 300;

const WAVEFORM = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 1];

/**
 * Shared voice recorder UI used in both CheckIn (active visit) and Visits (visit detail).
 *
 * - onUpload: receives { audioBlob, durationSeconds } and returns a Promise.
 *   Caller is responsible for the API call so each context can hit its own endpoint.
 * - existingAudio / existingDuration / existingTranscription: optional, shown above recorder.
 */
export function VoiceRecorder({
  onUpload,
  existingAudio,
  existingDuration,
  existingTranscription,
}: {
  onUpload: (args: { audioBlob: Blob; durationSeconds: number }) => Promise<void>;
  existingAudio?: string | null;
  existingDuration?: number | null;
  existingTranscription?: string | null;
}) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_SECONDS - 1) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  }

  function stopRecording() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); }
    setIsRecording(false);
  }

  async function handleUpload() {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      await onUpload({ audioBlob, durationSeconds: recordingTime });
      setAudioBlob(null);
      setRecordingTime(0);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }

  const timeDisplay = `${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, "0")}`;
  const progress = Math.min(100, (recordingTime / MAX_SECONDS) * 100);

  return (
    <div className="space-y-3">
      {/* Existing audio playback */}
      {existingAudio ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 p-2">
            <Headphones className="h-4 w-4 shrink-0 text-primary" />
            <audio src={existingAudio} controls className="h-8 w-full min-w-0" />
            {existingDuration ? <span className="shrink-0 text-xs text-muted-foreground">{existingDuration}s</span> : null}
          </div>
          {existingTranscription ? (
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-muted-foreground">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-primary/60">Transcription</div>
              {existingTranscription}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Recorder row */}
      <div className="flex items-center gap-3">
        {/* Round record/stop button */}
        <Button
          type="button"
          size="icon"
          variant={isRecording ? "destructive" : "outline"}
          className="h-12 w-12 shrink-0 rounded-full"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
        >
          {isRecording
            ? <div className="h-3 w-3 rounded-sm bg-destructive-foreground" />
            : <div className="h-3 w-3 rounded-full bg-foreground/80" />}
        </Button>

        {/* State feedback */}
        <div className="flex-1 min-w-0">
          {isRecording ? (
            <div className="flex items-center gap-2">
              <div className="flex items-end gap-[3px] h-5">
                {WAVEFORM.map((scale, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-destructive"
                    style={{
                      height: `${scale * 100}%`,
                      animation: `pulse 0.${6 + (i % 4)}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.07}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm font-mono text-foreground/80 tabular-nums">{timeDisplay}</span>
            </div>
          ) : audioBlob ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary flex-1">Recorded ({recordingTime}s)</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setAudioBlob(null); setRecordingTime(0); }}
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground/70">
              {existingAudio ? "Re-record voice note" : "Tap to record voice notes"}
            </span>
          )}
        </div>

        {/* Upload button */}
        {audioBlob && !isRecording && (
          <Button size="sm" onClick={handleUpload} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
          </Button>
        )}
      </div>

      {/* 5-min progress bar */}
      {isRecording && (
        <div className="space-y-0.5">
          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-destructive transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-muted-foreground/50">{MAX_SECONDS - recordingTime}s left</div>
        </div>
      )}
    </div>
  );
}
