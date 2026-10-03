import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Zap, ZapOff } from 'lucide-react';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
}

type TorchTrack = MediaStreamTrack & {
  getCapabilities?: () => unknown;
};

export default function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<TorchTrack | null>(null);
  const doneRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    let detector: BarcodeDetectorLike | null = null;
    try {
      detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
    } catch {
      detector = null;
    }

    const finish = (text: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      navigator.vibrate?.(40);
      onResultRef.current(text);
    };

    const tick = async () => {
      if (cancelled || doneRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) return finish(found[0].rawValue);
          } else {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { willReadFrequently: true });
            if (canvas && ctx) {
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (code?.data) return finish(code.data);
            }
          }
        } catch {
          // A failed frame is not fatal; try the next one.
        }
      }
      raf = window.requestAnimationFrame(() => void tick());
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador não dá acesso à câmera.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getVideoTracks()[0] as TorchTrack | undefined;
        trackRef.current = track ?? null;
        try {
          const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
          if (caps?.torch) setTorchAvailable(true);
        } catch {
          // no torch info
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        raf = window.requestAnimationFrame(() => void tick());
      } catch (err) {
        const name = (err as { name?: string }).name;
        setError(
          name === 'NotAllowedError'
            ? 'Permissão da câmera negada. Libere a câmera nos ajustes do navegador.'
            : 'Não consegui abrir a câmera.',
        );
      }
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black" role="dialog" aria-label="Escanear QR">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 bg-navy-950/40" />

      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white active:bg-black/70"
        >
          <X className="h-6 w-6" />
        </button>
        {torchAvailable && (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-label="Lanterna"
            className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${
              torchOn ? 'bg-cta' : 'bg-black/50 active:bg-black/70'
            }`}
          >
            {torchOn ? <Zap className="h-6 w-6" /> : <ZapOff className="h-6 w-6" />}
          </button>
        )}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        {error ? (
          <div className="max-w-sm rounded-none border border-white/10 bg-navy-800 p-5 text-center text-fog-50">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 min-h-[48px] rounded-full bg-cta px-6 font-bold text-white hover:bg-cta-hover active:bg-cta-hover"
            >
              Voltar
            </button>
          </div>
        ) : (
          <>
            <div className="relative aspect-square w-[68vw] max-w-[320px]">
              {(['left-0 top-0 border-l-4 border-t-4', 'right-0 top-0 border-r-4 border-t-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'] as const).map((c) => (
                <span key={c} className={`absolute h-10 w-10 border-cta ${c}`} />
              ))}
            </div>
            <p className="mt-6 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white">
              Aponte para o QR da plaquinha
            </p>
          </>
        )}
      </div>
    </div>
  );
}
