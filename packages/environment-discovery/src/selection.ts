import type { ValidatedMedisoftDatabase } from './types.js';
import { EnvironmentDiscoveryError } from './errors.js';
import { formatCandidateList } from './validate-database.js';

export function selectLocalDatabase(
  candidates: ValidatedMedisoftDatabase[],
  options: {
    selectedDatabase?: string;
    cachedDatabase?: string;
  },
): ValidatedMedisoftDatabase {
  if (candidates.length === 0) {
    throw new EnvironmentDiscoveryError(
      'No Medisoft facility databases were found on the MySQL server. ' +
        'Expected schemas containing patients, upid_patients, and address tables.',
    );
  }

  const byName = new Map(candidates.map((candidate) => [candidate.database, candidate]));

  if (options.selectedDatabase) {
    const selected = byName.get(options.selectedDatabase);
    if (!selected) {
      throw new EnvironmentDiscoveryError(
        `MEDISOFT_DATABASE="${options.selectedDatabase}" is not a valid Medisoft database.\n` +
          `Available candidates:\n${formatCandidateList(candidates)}`,
      );
    }
    return selected;
  }

  if (options.cachedDatabase) {
    const cached = byName.get(options.cachedDatabase);
    if (cached) {
      return cached;
    }
  }

  if (candidates.length === 1) {
    return candidates[0]!;
  }

  throw new EnvironmentDiscoveryError(
    'Multiple Medisoft databases were found. Set MEDISOFT_DATABASE to one of:\n' +
      `${formatCandidateList(candidates)}\n` +
      'The selected database is cached in data/discovered-environment.json for future runs.',
  );
}
