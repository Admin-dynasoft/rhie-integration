/**
 * Port of PHP EncounterController::generateUuid() using mt_rand semantics.
 * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12)
 */
export function generateEncounterUuid(): string {
  const randomU16 = (): number => Math.floor(Math.random() * 0x10000);

  const hex4 = (value: number): string => (value & 0xffff).toString(16).padStart(4, '0');

  const a = randomU16();
  const b = randomU16();
  const c = randomU16();
  const d = (randomU16() & 0x0fff) | 0x4000;
  const e = (randomU16() & 0x3fff) | 0x8000;
  const f = randomU16();
  const g = randomU16();
  const h = randomU16();

  return `${hex4(a)}${hex4(b)}-${hex4(c)}-${hex4(d)}-${hex4(e)}-${hex4(f)}${hex4(g)}${hex4(h)}`;
}

/** PHP date('Y-m-d H:i:s') format for parity logging and inserts */
export function phpTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-') +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
