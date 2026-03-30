import { useRef, useState } from "react";
import { Loader2, Mic, MicOff, Headphones } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useXpotApp } from "./XpotContext";
import { formatDateTime, formatDuration } from "./utils";
import type { SalesVisit } from "./types";

function VisitAudioRecorder({ visit }: { visit: SalesVisit }) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const existingAudio = visit.note?.audioUrl;
  const existingDuration = visit.note?.audioDurationSeconds;
  const existingTranscription = visit.note?.audioTranscription;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      const interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 300) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      (mediaRecorder as any).intervalId = interval;
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      clearInterval((mediaRecorderRef.current as any).intervalId);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      const audioData = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      await apiRequest("POST", `/api/xpot/visits/${visit.id}/audio`, {
        audioData,
        durationSeconds: recordingTime,
      });

      toast({ title: "Audio note saved" });
      setAudioBlob(null);
      setRecordingTime(0);
      await queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      {existingAudio ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
            <Headphones className="h-4 w-4 shrink-0 text-primary" />
            <audio src={existingAudio} controls className="h-8 w-full min-w-0" />
            {existingDuration ? <span className="shrink-0 text-xs text-white/40">{existingDuration}s</span> : null}
          </div>
          {existingTranscription ? (
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-white/70">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-primary/60">Transcription</div>
              {existingTranscription}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={isRecording ? "destructive" : "outline"}
          className={isRecording ? "h-9 border-red-500 bg-red-500/20 text-red-300 hover:bg-red-500/30" : "h-9 border-white/10 bg-transparent text-white/60 hover:bg-white/10"}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
        >
          {isRecording ? (
            <>
              <MicOff className="mr-1.5 h-3.5 w-3.5" />
              Stop · {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
            </>
          ) : (
            <>
              <Mic className="mr-1.5 h-3.5 w-3.5" />
              {existingAudio ? "Re-record" : "Record voice note"}
            </>
          )}
        </Button>

        {audioBlob && !isRecording && (
          <Button
            type="button"
            size="sm"
            className="h-9 bg-primary text-black hover:bg-primary/90"
            onClick={uploadAudio}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {isUploading ? "Saving..." : `Save (${recordingTime}s)`}
          </Button>
        )}

        {audioBlob && !isRecording && !isUploading && (
          <button
            type="button"
            className="text-xs text-white/35 hover:text-white/60"
            onClick={() => { setAudioBlob(null); setRecordingTime(0); }}
          >
            Discard
          </button>
        )}
      </div>
    </div>
  );
}

export function XpotVisits() {
  const { visitsQuery } = useXpotApp();

  return (
    <div className="space-y-3">
      {visitsQuery.data?.length ? visitsQuery.data.map((visit) => (
        <Card key={visit.id} className="border-white/10 bg-white/5 text-white">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{visit.account?.name || `Account #${visit.accountId}`}</div>
              <Badge variant="secondary" className="bg-white/10 text-white">{visit.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-white/60">
              <div><div className="text-white/35">Check-in</div><div>{formatDateTime(visit.checkedInAt)}</div></div>
              <div><div className="text-white/35">Duration</div><div>{formatDuration(visit.durationSeconds)}</div></div>
            </div>
            {visit.note?.summary ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">{visit.note.summary}</div>
            ) : null}
            <VisitAudioRecorder visit={visit} />
          </CardContent>
        </Card>
      )) : (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-6 text-sm text-white/50">No visits recorded yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
