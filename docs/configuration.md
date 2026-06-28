# Configuration Guide

## Config File Location

Default: `configs/platform.yaml` at the repository root (resolved automatically).

Override with environment variable:

```bash
export PLATFORM_CONFIG=/path/to/custom-config.yaml
# or repo-root-relative:
export PLATFORM_CONFIG=configs/platform.staging.yaml
```

Legacy override (still supported):

```bash
export CONFIG_PATH=configs/platform.yaml
```

## Required Manual Configuration

Only these values need to be configured manually:

| Setting | Environment variable | YAML section |
|---------|---------------------|--------------|
| MySQL host | `LOCAL_DB_HOST` | `localDatabase.host` |
| MySQL port | `LOCAL_DB_PORT` | `localDatabase.port` |
| MySQL username | `LOCAL_DB_USER` | `localDatabase.user` |
| MySQL password | `LOCAL_DB_PASSWORD` | `localDatabase.password` |
| RHIE credentials | `RHIE_PASSWORD` | `rhie.auth` |

Database names, facility codes, and online facility connections are **discovered automatically** at startup.

Copy `.env.example` to `.env` at the repository root and set at least `LOCAL_DB_PASSWORD` and `RHIE_PASSWORD`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PLATFORM_CONFIG` | Absolute or repo-root-relative path to platform config file |
| `CONFIG_PATH` | Legacy path override (absolute, repo-root-relative, or cwd-relative) |
| `LOG_LEVEL` | Override log level (`info`, `debug`, etc.) |
| `RHIE_BASE_URL` | Override RHIE API base URL |
| `LOCAL_DB_HOST` | MySQL host (default: `127.0.0.1`) |
| `LOCAL_DB_PORT` | MySQL port (default: `3306`) |
| `LOCAL_DB_USER` | MySQL username (default: `root`) |
| `LOCAL_DB_PASSWORD` | **Required** MySQL password |
| `LOCAL_DB_DATABASE` | Skip discovery and use this database name directly |
| `MEDISOFT_DATABASE` | Select a specific Medisoft database when multiple candidates exist |
| `DISCOVERY_MODE` | `auto`, `local`, or `online` discovery mode override |
| `FORCE_REDISCOVER` | Set to `1` to ignore cached discovery results |
| `MEDISOFT_SKIP_DISCOVERY` | Set to `1` to disable discovery (tests/manual config) |
| `RHIE_PASSWORD` | RHIE API password |

YAML supports `${ENV_VAR}` substitution for string values.

## Automatic Environment Discovery

When `environmentDiscovery.enabled` is `true` (default), the platform:

1. Connects to MySQL using host, port, username, and password only
2. Lists non-system databases (`information_schema`, `mysql`, `performance_schema`, `sys` are ignored)
3. Validates each candidate for required Medisoft tables: `patients`, `upid_patients`, `address`
4. Reads facility identity from `address` row `address_id = 1` (`hc`, `fosaid`)
5. On online servers, reads `medisoft_hie.health_facilities` and validates each facility database
6. Saves results to `./data/discovered-environment.json` for future runs

### Local development

If exactly one valid Medisoft database exists, it is selected automatically. If multiple exist, startup fails with a list of candidates unless `MEDISOFT_DATABASE` is set.

### Online production

All facilities listed in `health_facilities` with valid Medisoft schemas become `onlineDatabases` entries. Worker hosts spawn one worker per discovered facility automatically.

### `environmentDiscovery` section

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` | Enable automatic discovery |
| `mode` | `auto` | `auto`, `local`, or `online` |
| `cachePath` | `./data/discovered-environment.json` | Cached discovery output |
| `centralDatabase` | `medisoft_hie` | Central registry schema name |
| `excludeDatabases` | `[]` | Additional schemas to ignore |

## Sections

### `logging`

| Key | Default | Description |
|-----|---------|-------------|
| `level` | `info` | Log level |
| `prettyPrint` | `false` | Human-readable logs (dev) |

### `retry`

| Key | Default | Description |
|-----|---------|-------------|
| `maxAttempts` | `3` | Max retry attempts |
| `initialDelayMs` | `1000` | First retry delay |
| `maxDelayMs` | `30000` | Max retry delay cap |
| `backoffMultiplier` | `2` | Exponential backoff factor |

### `worker`

| Key | Default | Description |
|-----|---------|-------------|
| `sleepIntervalMs` | `5000` | Idle sleep between polls |
| `batchSize` | `50` | Records per batch |
| `heartbeatIntervalMs` | `10000` | Heartbeat emission interval |

### `coordinator`

| Key | Default | Description |
|-----|---------|-------------|
| `syncHealthCheckIntervalMs` | `15000` | How often to evaluate mode |
| `serviceHeartbeatTimeoutMs` | `45000` | Stale service threshold |
| `stateFilePath` | `./data/coordinator-state.json` | Mode state output |

### `rhie`

| Key | Description |
|-----|-------------|
| `baseUrl` | RHIE API base URL |
| `auth.type` | `bearer`, `basic`, or `oauth2` |
| `timeoutMs` | HTTP request timeout |
| `*Path` | API endpoint paths |

### `localDatabase`

MySQL connection template for discovery and local-mode processing. Only connection credentials are required in YAML; the `database` name is discovered automatically.

At startup, services log the resolved config path, discovered database name, facility code, and connection summary (without the password value).

### `onlineDatabases`

Usually empty in YAML — populated automatically from `health_facilities` on online servers. Each discovered entry includes `facilityCode`, connection details, and `enabled: true`.

## Validation

Configuration is validated at startup using Zod. Environment discovery runs before database connections are opened. Invalid or ambiguous discovery results cause immediate exit with a descriptive `ConfigurationError`.
