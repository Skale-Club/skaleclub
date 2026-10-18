export type CsvCell = string | number | null | undefined;

const PHONE_LIKE_RE = /^\+?[\d\s().-]+$/;

function escapeCell(value: CsvCell): string {
  if (value == null) return '';
  let text = String(value);
  // Neutralise spreadsheet formula injection, but keep phone numbers like "+1 555..." intact.
  if (/^[=+\-@\t\r]/.test(text) && !PHONE_LIKE_RE.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Client-side download of a CSV file (UTF-8 with BOM so Excel reads accents correctly). */
export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const blob = new Blob(['﻿', buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ISO string for a date-ish value (API dates arrive as strings), or ''. */
export function toIsoCell(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function csvFilenameSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
}
