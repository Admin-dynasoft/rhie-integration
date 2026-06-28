import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const REPO_PACKAGE_NAME = 'rhie-integration-platform';
const DEFAULT_CONFIG_RELATIVE_PATH = join('configs', 'platform.yaml');

let cachedRepositoryRoot: string | null = null;

function getModuleDirectory(): string {
  return dirname(__filename);
}

function isRepositoryRoot(directory: string): boolean {
  const configPath = join(directory, DEFAULT_CONFIG_RELATIVE_PATH);
  if (existsSync(configPath)) {
    return true;
  }

  const packageJsonPath = join(directory, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      name?: string;
      workspaces?: unknown;
    };
    return pkg.name === REPO_PACKAGE_NAME && Array.isArray(pkg.workspaces);
  } catch {
    return false;
  }
}

function findRepositoryRootFrom(startDirectory: string): string | null {
  let current = resolve(startDirectory);
  const filesystemRoot = resolve(current, '/');

  while (true) {
    if (isRepositoryRoot(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current || current === filesystemRoot) {
      return null;
    }
    current = parent;
  }
}

/**
 * Walks upward from the config package location and process cwd to find the monorepo root.
 */
export function resolveRepositoryRoot(): string {
  if (cachedRepositoryRoot) {
    return cachedRepositoryRoot;
  }

  const searchStarts = [getModuleDirectory(), process.cwd()];

  for (const startDirectory of searchStarts) {
    const root = findRepositoryRootFrom(startDirectory);
    if (root) {
      cachedRepositoryRoot = root;
      return root;
    }
  }

  throw new Error(
    'Could not resolve repository root. Set PLATFORM_CONFIG to an absolute path to the platform config file.',
  );
}

function resolveEnvConfigPath(envPath: string, repositoryRoot: string): string {
  if (isAbsolute(envPath)) {
    return envPath;
  }

  const fromRepositoryRoot = resolve(repositoryRoot, envPath);
  if (existsSync(fromRepositoryRoot)) {
    return fromRepositoryRoot;
  }

  const fromWorkingDirectory = resolve(process.cwd(), envPath);
  if (existsSync(fromWorkingDirectory)) {
    return fromWorkingDirectory;
  }

  return fromRepositoryRoot;
}

/**
 * Resolves the platform config file path.
 *
 * Priority:
 * 1. Explicit argument
 * 2. PLATFORM_CONFIG environment variable
 * 3. CONFIG_PATH environment variable (legacy)
 * 4. configs/platform.yaml under the repository root
 */
export function resolvePlatformConfigPath(explicitPath?: string): string {
  const repositoryRoot = resolveRepositoryRoot();
  const envPath =
    explicitPath ?? process.env.PLATFORM_CONFIG ?? process.env.CONFIG_PATH;

  if (envPath) {
    return resolveEnvConfigPath(envPath, repositoryRoot);
  }

  return resolve(repositoryRoot, DEFAULT_CONFIG_RELATIVE_PATH);
}

export function resetRepositoryRootCache(): void {
  cachedRepositoryRoot = null;
}

export function getDefaultPlatformConfigPath(): string {
  return resolve(resolveRepositoryRoot(), DEFAULT_CONFIG_RELATIVE_PATH);
}
