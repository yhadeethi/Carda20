import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceDebriefRecorderProps {
  onTranscriptReady: (transcript: string) => void;
  onCancel: () => void;
}

type RecorderState = "idle" | "recording" | "processing";

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function VoiceDebriefRecorder({ onTranscriptReady, onCancel }: VoiceDebriefRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError("Microphone access is needed for voice debrief");
        } else if (err.name === 'NotFoundError') {
          setPermissionError("No microphone detected");
        } else {
          setPermissionError("Could not access microphone");
        }
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    setState("processing");

    recorder.onstop = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });

      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      try {
        const res = await fetch('/api/debrief/transcribe', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Transcription failed');
        }

        const data = await res.json();
        onTranscriptReady(data.transcript);
      } catch (err) {
        console.error('[VoiceDebrief] Transcription error:', err);
        toast({
          title: "Transcription failed",
          description: err instanceof Error ? err.message : "Could not transcribe audio. Please try again.",
          variant: "destructive",
        });
        setState("idle");
      }
    };

    recorder.stop();
  }, [onTranscriptReady, toast]);

  return (
    <div className="px-5 pt-4 pb-8">
      <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />

      {state === "idle" && (
        <div className="flex flex-col items-center gap-6">
          {permissionError ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <MicOff className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">{permissionError}</p>
              <button
                onClick={onCancel}
                className="text-sm text-muted-foreground underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="text-lg font-bold text-foreground">Voice Debrief</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Tap the mic and speak about your meeting. We'll extract notes, tasks, and reminders automatically.
                </p>
              </div>

              <button
                onClick={startRecording}
                className="w-[72px] h-[72px] rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
                aria-label="Start recording"
                data-testid="button-start-recording"
              >
                <Mic className="w-8 h-8 text-white" />
              </button>

              <button
                onClick={onCancel}
                className="text-sm text-muted-foreground"
                data-testid="button-cancel-recording"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {state === "recording" && (
        <div className="flex flex-col items-center gap-5">
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">Recording...</h2>
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-recording-time">{formatTime(elapsed)}</p>
          </div>

          <div className="flex items-end gap-1 h-10" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-red-500 opacity-80"
                style={{
                  height: `${20 + Math.random() * 20}px`,
                  animation: `waveBar ${0.6 + (i % 4) * 0.15}s ease-in-out infinite alternate`,
                  animationDelay: `${(i * 0.08) % 0.5}s`,
                }}
              />
            ))}
          </div>

          <style>{`
            @keyframes waveBar {
              from { transform: scaleY(0.4); }
              to { transform: scaleY(1); }
            }
          `}</style>

          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-xs text-red-500 font-medium">REC</span>
          </div>

          <button
            onClick={stopRecording}
            className="w-[72px] h-[72px] rounded-full bg-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            aria-label="Stop recording"
            data-testid="button-stop-recording"
          >
            <Square className="w-7 h-7 text-background fill-background" />
          </button>
        </div>
      )}

      {state === "processing" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
          <p className="text-sm font-medium text-foreground">Transcribing your debrief...</p>
          <p className="text-xs text-muted-foreground">This usually takes a few seconds</p>
        </div>
      )}
    </div>
  );
}
