/**
 * Date helpers. The app displays and accepts dates as DD-MM-YYYY, while the
 * database stores plain dates as ISO 'YYYY-MM-DD'. These convert between them.
 */

function isValidISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function parseLocalISO(iso: string): Date | null {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** ISO 'YYYY-MM-DD' (or null) -> 'DD-MM-YYYY' (or ''). */
export function isoToDMY(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : '';
}

/** 'DD-MM-YYYY' -> ISO 'YYYY-MM-DD', or null when invalid. */
export function dmyToISO(dmy: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  return isValidISO(iso) ? iso : null;
}

export function isValidDMY(dmy: string): boolean {
  return dmyToISO(dmy) !== null;
}

/** A Date (or ISO string) -> 'DD-MM-YYYY'. */
export function formatDMY(input: Date | string | null): string {
  if (!input) return '';
  const d = typeof input === 'string' ? parseLocalISO(input) : input;
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** 'DD-MM-YYYY' -> Date (local midnight), or null when invalid. */
export function parseDMYtoDate(dmy: string): Date | null {
  const iso = dmyToISO(dmy);
  return iso ? parseLocalISO(iso) : null;
}
