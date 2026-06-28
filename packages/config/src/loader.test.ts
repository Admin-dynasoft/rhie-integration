import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { loadConfig, resetConfigCache } from './loader.js';
import { ConfigurationError } from './errors.js';
import { resolveRepositoryRoot } from './paths.js';

describe('config loader', () => {
  const fixturePath = resolve(
    resolveRepositoryRoot(),
    'packages/config/test-fixtures/minimal-platform.yaml',
  );

  const originalEnv = {
    LOCAL_DB_PASSWORD: process.env.LOCAL_DB_PASSWORD,
    LOCAL_DB_USER: process.env.LOCAL_DB_USER,
    LOCAL_DB_HOST: process.env.LOCAL_DB_HOST,
    LOCAL_DB_PORT: process.env.LOCAL_DB_PORT,
    LOCAL_DB_DATABASE: process.env.LOCAL_DB_DATABASE,
    PLATFORM_CONFIG: process.env.PLATFORM_CONFIG,
  };

  beforeEach(() => {
    resetConfigCache();
    delete process.env.PLATFORM_CONFIG;
  });

  afterEach(() => {
    resetConfigCache();

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('loads minimal fixture and resolves localDatabase credentials', () => {
    process.env.PLATFORM_CONFIG = fixturePath;
    process.env.LOCAL_DB_PASSWORD = 'raymond1';

    const config = loadConfig();

    assert.equal(config.localDatabase.host, '127.0.0.1');
    assert.equal(config.localDatabase.port, 3306);
    assert.equal(config.localDatabase.user, 'root');
    assert.equal(config.localDatabase.password, 'raymond1');
    assert.equal(config.localDatabase.database, 'medisoft_testing');
  });

  it('substitutes ${LOCAL_DB_PASSWORD} from the environment', () => {
    process.env.PLATFORM_CONFIG = fixturePath;
    process.env.LOCAL_DB_PASSWORD = 'secret-from-env';

    const config = loadConfig();

    assert.equal(config.localDatabase.password, 'secret-from-env');
  });

  it('applies LOCAL_DB_USER override after yaml load', () => {
    process.env.PLATFORM_CONFIG = fixturePath;
    process.env.LOCAL_DB_PASSWORD = 'raymond1';
    process.env.LOCAL_DB_USER = 'custom-user';

    const config = loadConfig();

    assert.equal(config.localDatabase.user, 'custom-user');
  });

  it('ignores empty LOCAL_DB_USER override to avoid blank usernames', () => {
    process.env.PLATFORM_CONFIG = fixturePath;
    process.env.LOCAL_DB_PASSWORD = 'raymond1';
    process.env.LOCAL_DB_USER = '';

    const config = loadConfig();

    assert.equal(config.localDatabase.user, 'root');
  });

  it('fails fast when LOCAL_DB_PASSWORD is missing', () => {
    process.env.PLATFORM_CONFIG = fixturePath;
    delete process.env.LOCAL_DB_PASSWORD;

    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        assert.ok(error instanceof ConfigurationError);
        assert.match(
          (error as ConfigurationError).message,
          /password is required/i,
        );
        return true;
      },
    );
  });

  it('fails fast when user would be empty after substitution', () => {
    process.env.LOCAL_DB_PASSWORD = 'raymond1';

    const original = readFileSync(fixturePath, 'utf-8');
    const parsed = parseYaml(original) as Record<string, unknown>;
    (parsed.localDatabase as Record<string, unknown>).user = '${LOCAL_DB_USER}';
    const tempPath = resolve(
      resolveRepositoryRoot(),
      'packages/config/test-fixtures/temp-empty-user.yaml',
    );
    writeFileSync(tempPath, stringifyYaml(parsed));

    try {
      process.env.PLATFORM_CONFIG = tempPath;
      delete process.env.LOCAL_DB_USER;

      assert.throws(
        () => loadConfig(),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          assert.match(message, /user/i);
          return true;
        },
      );
    } finally {
      unlinkSync(tempPath);
    }
  });
});
