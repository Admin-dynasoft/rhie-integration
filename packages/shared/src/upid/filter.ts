/**
 * UPID sanitization and exclusion — port of rhie/config/upid_filter.php
 */

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;
const NON_PRINTABLE = /[^\x20-\x7E]/g;

export function rhieSanitizeUpid(upid: string | null | undefined): string | null {
  if (upid === null || upid === undefined) {
    return null;
  }

  let clean = upid.trim();
  clean = clean.replace(/\s+/g, '');
  clean = clean.replace(NON_PRINTABLE, '');
  clean = clean.replace(ZERO_WIDTH_CHARS, '');

  return clean === '' ? null : clean;
}

export function rhieUpidIsExcluded(upid: string | null | undefined): boolean {
  const sanitized = rhieSanitizeUpid(upid);
  if (sanitized === null) {
    return false;
  }
  return sanitized.toUpperCase().startsWith('UP');
}

export function rhieUpidSqlExclude(column: string): string {
  return `AND ${column} NOT LIKE 'UP%'`;
}
