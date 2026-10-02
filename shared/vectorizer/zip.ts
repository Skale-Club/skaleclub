// Minimal ZIP writer (stored entries, no compression). Enough for 3MF packages
// and "download every layer" bundles without pulling in a zip library.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array | string;
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const files = entries.map((e) => ({
    name: enc.encode(e.name),
    data: typeof e.data === 'string' ? enc.encode(e.data) : e.data,
  }));
  // Fixed DOS timestamp (1 Jan 2024) keeps output deterministic.
  const dosTime = 0;
  const dosDate = ((2024 - 1980) << 9) | (1 << 5) | 1;

  let size = 22;
  for (const f of files) size += 30 + f.name.length + f.data.length + 46 + f.name.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let p = 0;
  const offsets: number[] = [];
  const crcs: number[] = [];

  for (const f of files) {
    const crc = crc32(f.data);
    crcs.push(crc);
    offsets.push(p);
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 0x0800, true); // UTF-8 names
    view.setUint16(p + 8, 0, true);
    view.setUint16(p + 10, dosTime, true);
    view.setUint16(p + 12, dosDate, true);
    view.setUint32(p + 14, crc, true);
    view.setUint32(p + 18, f.data.length, true);
    view.setUint32(p + 22, f.data.length, true);
    view.setUint16(p + 26, f.name.length, true);
    view.setUint16(p + 28, 0, true);
    p += 30;
    out.set(f.name, p);
    p += f.name.length;
    out.set(f.data, p);
    p += f.data.length;
  }

  const cdStart = p;
  files.forEach((f, i) => {
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 20, true);
    view.setUint16(p + 8, 0x0800, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, dosTime, true);
    view.setUint16(p + 14, dosDate, true);
    view.setUint32(p + 16, crcs[i], true);
    view.setUint32(p + 20, f.data.length, true);
    view.setUint32(p + 24, f.data.length, true);
    view.setUint16(p + 28, f.name.length, true);
    view.setUint16(p + 30, 0, true);
    view.setUint16(p + 32, 0, true);
    view.setUint16(p + 34, 0, true);
    view.setUint16(p + 36, 0, true);
    view.setUint32(p + 38, 0, true);
    view.setUint32(p + 42, offsets[i], true);
    p += 46;
    out.set(f.name, p);
    p += f.name.length;
  });

  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 4, 0, true);
  view.setUint16(p + 6, 0, true);
  view.setUint16(p + 8, files.length, true);
  view.setUint16(p + 10, files.length, true);
  view.setUint32(p + 12, p - cdStart, true);
  view.setUint32(p + 16, cdStart, true);
  view.setUint16(p + 20, 0, true);
  return out;
}
