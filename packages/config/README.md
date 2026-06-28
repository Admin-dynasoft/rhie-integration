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

1. Read config file from `CONFIG_PATH` or default `./configs/platform.yaml`
2. Parse YAML/JSON
3. Substitute environment variables
4. Validate against `PlatformConfigSchema`
5. Cache validated config for runtime access

## Configuration

See [Configuration Guide](../../docs/configuration.md).

## Dependencies

- `dotenv` — load `.env` files
- `yaml` — YAML parsing
- `zod` — schema validation
