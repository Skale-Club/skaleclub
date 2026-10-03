// Thin wrapper around the Web NFC API (Chrome for Android only).
// Every operation takes an AbortSignal so the UI can cancel a pending tap.

interface NdefRecordLike {
  recordType: string;
  data?: DataView;
  encoding?: string;
}
interface NdefReadingEventLike extends Event {
  serialNumber: string;
  message: { records: NdefRecordLike[] };
}
interface NdefReaderLike {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: unknown, options?: { overwrite?: boolean; signal?: AbortSignal }): Promise<void>;
  onreading: ((ev: NdefReadingEventLike) => void) | null;
  onreadingerror: ((ev: Event) => void) | null;
}
type NdefReaderCtor = new () => NdefReaderLike;

export type NfcReading =
  | { kind: 'url'; url: string; serialNumber: string }
  | { kind: 'text'; text: string; serialNumber: string }
  | { kind: 'empty'; serialNumber: string };

export class NfcError extends Error {
  silent: boolean;
  constructor(message: string, silent = false) {
    super(message);
    this.name = 'NfcError';
    this.silent = silent;
  }
}

function getCtor(): NdefReaderCtor | null {
  const ctor = (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader;
  return ctor ?? null;
}

export function isWebNfcSupported(): boolean {
  return getCtor() !== null;
}

export function mapNfcError(err: unknown): NfcError {
  if (err instanceof NfcError) return err;
  const name = (err as { name?: string } | null)?.name;
  switch (name) {
    case 'AbortError':
      return new NfcError('Cancelado', true);
    case 'NotAllowedError':
      return new NfcError('Permissão negada ou NFC desligado. Ative o NFC nos ajustes do celular e permita o acesso ao Chrome.');
    case 'NotSupportedError':
      return new NfcError('Este aparelho ou navegador não suporta NFC pelo app.');
    case 'NotReadableError':
      return new NfcError('Não foi possível ler o chip. Tente encostar de novo.');
    case 'NetworkError':
      return new NfcError('Chip retirado cedo demais ou protegido contra gravação. Encoste de novo e segure por um segundo.');
    case 'SecurityError':
      return new NfcError('O NFC só funciona em conexão segura (https).');
    case 'InvalidStateError':
      return new NfcError('O NFC está ocupado. Feche outros apps que usam NFC e tente de novo.');
    default:
      return new NfcError(err instanceof Error && err.message ? err.message : 'Falha de NFC. Tente de novo.');
  }
}

function decode(record: NdefRecordLike): string | null {
  if (!record.data) return null;
  try {
    const encoding = record.encoding || (record.recordType === 'text' ? 'utf-8' : 'utf-8');
    return new TextDecoder(encoding).decode(record.data);
  } catch {
    return null;
  }
}

function readingFrom(ev: NdefReadingEventLike): NfcReading {
  for (const record of ev.message.records) {
    if (record.recordType === 'url' || record.recordType === 'absolute-url') {
      const url = decode(record);
      if (url) return { kind: 'url', url, serialNumber: ev.serialNumber };
    }
  }
  for (const record of ev.message.records) {
    if (record.recordType === 'text') {
      const text = decode(record);
      if (text) return { kind: 'text', text, serialNumber: ev.serialNumber };
    }
  }
  return { kind: 'empty', serialNumber: ev.serialNumber };
}

const REPEAT_WINDOW_MS = 2000;

/** Resolves with the first reading; repeated reads of the same serial within ~2s are ignored. */
function readNext(signal: AbortSignal, ignoreSerial?: { serial: string; at: number }): Promise<NfcReading> {
  const Ctor = getCtor();
  if (!Ctor) return Promise.reject(new NfcError('Este navegador não lê NFC. Use o Chrome no Android.'));
  const reader = new Ctor();
  let lastSerial = ignoreSerial?.serial ?? '';
  let lastAt = ignoreSerial?.at ?? 0;
  // Own controller: the scan session ends as soon as this read settles, so a
  // finished read never keeps the radio busy (or swallows the next tap).
  const session = new AbortController();
  return new Promise<NfcReading>((resolve, reject) => {
    const cleanup = () => {
      reader.onreading = null;
      reader.onreadingerror = null;
      signal.removeEventListener('abort', onAbort);
      session.abort();
    };
    const onAbort = () => {
      cleanup();
      reject(new NfcError('Cancelado', true));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort);
    reader.onreading = (ev) => {
      const now = Date.now();
      if (ev.serialNumber && ev.serialNumber === lastSerial && now - lastAt < REPEAT_WINDOW_MS) {
        lastAt = now;
        return;
      }
      lastSerial = ev.serialNumber;
      lastAt = now;
      cleanup();
      resolve(readingFrom(ev));
    };
    reader.onreadingerror = () => {
      cleanup();
      reject(new NfcError('Não consegui ler esse chip. Tente encostar de novo.'));
    };
    reader.scan({ signal: session.signal }).catch((err) => {
      if (session.signal.aborted) return; // settled already, or cancelled via onAbort
      cleanup();
      reject(mapNfcError(err));
    });
  });
}

/** Waits for the next tap and returns what the chip holds. */
export async function scanOnce(signal: AbortSignal): Promise<NfcReading> {
  try {
    return await readNext(signal);
  } catch (err) {
    throw mapNfcError(err);
  }
}

/** Writes one URL record on the next tap. Resolves with the chip serial when known. */
export async function writeUrl(url: string, signal: AbortSignal): Promise<void> {
  const Ctor = getCtor();
  if (!Ctor) throw new NfcError('Este navegador não grava NFC. Use o Chrome no Android.');
  try {
    await new Ctor().write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true, signal });
  } catch (err) {
    throw mapNfcError(err);
  }
}

/** Reads the next tap (after the write) and returns the URL stored, or null if it holds no URL. */
export async function verify(_expected: string, signal: AbortSignal): Promise<string | null> {
  try {
    // The chip was just written, so its repeated read right after the write must not be skipped
    // by the dedupe window: a fresh reader instance has no history.
    const reading = await readNext(signal);
    return reading.kind === 'url' ? reading.url : reading.kind === 'text' ? reading.text : null;
  } catch (err) {
    throw mapNfcError(err);
  }
}
