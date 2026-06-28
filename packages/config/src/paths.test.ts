import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  resolveRepositoryRoot,
  resolvePlatformConfigPath,
  getDefaultPlatformConfigPath,
  resetRepositoryRootCache,
} from './paths.js';
import { loadConfig, resetConfigCache } from './loader.js';

describe('repository config path resolution', () => {
  const originalCwd = process.cwd();
  const originalPlatformConfig = process.env.PLATFORM_CONFIG;
  const originalConfigPath = process.env.CONFIG_PATH;

  const originalLocalDbPassword = process.env.LOCAL_DB_PASSWORD;

  beforeEach(() => {
    resetRepositoryRootCache();
    resetConfigCache();
    delete process.env.PLATFORM_CONFIG;
    delete process.env.CONFIG_PATH;
    process.env.LOCAL_DB_PASSWORD = 'test-password';
  });

  afterEach(() => {
    process.chdir(originalCwd);
    resetRepositoryRootCache();
    resetConfigCache();

    if (originalLocalDbPassword === undefined) {
      delete process.env.LOCAL_DB_PASSWORD;
    } else {
      process.env.LOCAL_DB_PASSWORD = originalLocalDbPassword;
    }

    if (originalPlatformConfig === undefined) {
      delete process.env.PLATFORM_CONFIG;
    } else {
      process.env.PLATFORM_CONFIG = originalPlatformConfig;
    }

    if (originalConfigPath === undefined) {
      delete process.env.CONFIG_PATH;
    } else {
      process.env.CONFIG_PATH = originalConfigPath;
    }
  });

  it('finds repository root from the config package location', () => {
    const root = resolveRepositoryRoot();
    assert.equal(existsSync(join(root, 'configs', 'platform.yaml')), true);
    assert.equal(existsSync(join(root, 'package.json')), true);
  });

  it('defaults to configs/platform.yaml in the repository root', () => {
    const configPath = resolvePlatformConfigPath();
    const root = resolveRepositoryRoot();

    assert.equal(configPath, resolve(root, 'configs', 'platform.yaml'));
    assert.equal(getDefaultPlatformConfigPath(), configPath);
    assert.equal(existsSync(configPath), true);
  });

  it('finds config when process cwd is apps/coordinator', () => {
    process.chdir(resolve(resolveRepositoryRoot(), 'apps', 'coordinator'));

    const configPath = resolvePlatformConfigPath();
    const root = resolveRepositoryRoot();

    assert.equal(configPath, resolve(root, 'configs', 'platform.yaml'));
    assert.equal(existsSync(configPath), true);
  });

  it('honors PLATFORM_CONFIG override with absolute path', () => {
    const root = resolveRepositoryRoot();
    const absolutePath = resolve(root, 'configs', 'platform.yaml');
    process.env.PLATFORM_CONFIG = absolutePath;

    assert.equal(resolvePlatformConfigPath(), absolutePath);
  });

  it('honors PLATFORM_CONFIG override relative to repository root', () => {
    process.env.PLATFORM_CONFIG = 'configs/platform.yaml';

    const root = resolveRepositoryRoot();
    assert.equal(
      resolvePlatformConfigPath(),
      resolve(root, 'configs', 'platform.yaml'),
    );
  });

  it('loads config successfully when started from apps/coordinator cwd', () => {
    process.env.LOCAL_DB_PASSWORD = 'test-password';
    process.chdir(resolve(resolveRepositoryRoot(), 'apps', 'coordinator'));

    const config = loadConfig();

    assert.equal(config.environment, 'development');
    assert.equal(config.localDatabase.user, 'root');
    assert.equal(config.localDatabase.password, 'test-password');
    assert.ok(config.rhie.baseUrl);
  });
});
