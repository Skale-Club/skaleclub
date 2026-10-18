/**
 * Timezone helpers for Skale Hub lives. The admin types wall-clock times that mean
 * "in the live's timezone", never in the browser's timezone. The API carries UTC ISO.
 */

const LOCAL_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock fields of an instant in the given zone. Throws RangeError for an invalid zone. */
function getZonedFields(date: Date, timeZone: string) {
  const fields: Record<string, number> = {};
  for (const part of getPartsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') {
      fields[part.type] = Number(part.value);
    }
  }
  // Some engines report midnight as hour 24 even with h23.
  if (fields.hour === 24) fields.hour = 0;
  return fields;
}

/** Offset (zone wall time minus UTC) in ms for the given instant. */
function getZoneOffsetMs(date: Date, timeZone: string): number {
  const f = getZonedFields(date, timeZone);
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  // Ignore sub-second precision of the instant itself.
  const instantSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - instantSeconds;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0');
}

/** UTC instant -> "YYYY-MM-DDTHH:mm" wall time in `timeZone` (for datetime-local inputs). */
export function utcToZonedInput(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const f = getZonedFields(date, timeZone);
    return `${pad(f.year, 4)}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}`;
  } catch {
    return '';
  }
}

/** "YYYY-MM-DDTHH:mm" wall time in `timeZone` -> UTC ISO string, or null if invalid/empty. */
export function zonedInputToUtcIso(local: string, timeZone: string): string | null {
  const match = LOCAL_INPUT_RE.exec((local || '').trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const wallAsUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  if (Number.isNaN(wallAsUtc)) return null;

  try {
    // Start with the offset at the wall time read as UTC, then refine twice so a
    // result that lands across a DST boundary settles on the correct offset.
    let guess = wallAsUtc - getZoneOffsetMs(new Date(wallAsUtc), timeZone);
    guess = wallAsUtc - getZoneOffsetMs(new Date(guess), timeZone);
    guess = wallAsUtc - getZoneOffsetMs(new Date(guess), timeZone);
    const result = new Date(guess);
    if (Number.isNaN(result.getTime())) return null;
    return result.toISOString();
  } catch {
    return null;
  }
}

/** Human-readable date/time of an instant in the given zone, e.g. "Nov 10, 2026, 8:00 PM EST". */
export function formatInZone(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
