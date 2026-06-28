export const MYSQL_SYSTEM_DATABASES = new Set([
  'information_schema',
  'mysql',
  'performance_schema',
  'sys',
]);

/** Central registry schemas — not facility EMR databases. */
export const CENTRAL_REGISTRY_DATABASES = new Set([
  'medisoft_hie',
]);

/** Tables that must exist for a database to be treated as Medisoft EMR. */
export const REQUIRED_MEDISOFT_TABLES = [
  'patients',
  'upid_patients',
  'address',
] as const;

export type RequiredMedisoftTable = (typeof REQUIRED_MEDISOFT_TABLES)[number];
