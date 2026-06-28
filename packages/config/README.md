# @rhie/config

## Purpose

Centralized configuration loading and validation for the integration platform.

## Responsibilities

- Load YAML/JSON configuration files
- Substitute `${ENV_VAR}` placeholders
- Apply environment variable overrides
- Validate config with Zod schemas at startup
- Provide typed accessors for database and RHIE settings

## Workflow

1. Resolve repository root automatically (from the config package location or `process.cwd()`)
2. Read config from `PLATFORM_CONFIG`, legacy `CONFIG_PATH`, or `configs/platform.yaml` at the repository root
3. Parse YAML/JSON
4. Substitute environment variables
5. Validate against `PlatformConfigSchema`
6. Cache validated config for runtime access

## Configuration

See [Configuration Guide](../../docs/configuration.md).

## Dependencies

- `dotenv` — load `.env` files
- `yaml` — YAML parsing
- `zod` — schema validation
