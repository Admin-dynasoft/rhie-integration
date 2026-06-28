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

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PLATFORM_CONFIG` | Absolute or repo-root-relative path to platform config file |
| `CONFIG_PATH` | Legacy path override (absolute, repo-root-relative, or cwd-relative) |
| `LOG_LEVEL` | Override log level (`info`, `debug`, etc.) |
| `RHIE_BASE_URL` | Override RHIE API base URL |
| `LOCAL_DB_HOST` | Override local database host (default in YAML: `127.0.0.1`) |
| `LOCAL_DB_PORT` | Override local database port (default in YAML: `3306`) |
| `LOCAL_DB_USER` | Override local database username (default in YAML: `root`) |
| `LOCAL_DB_PASSWORD` | **Required** local database password |
| `LOCAL_DB_DATABASE` | Override local database name (default in YAML: `medisoft_testing`) |
| `RHIE_API_TOKEN` | RHIE bearer token (referenced in YAML as `${RHIE_API_TOKEN}`) |
| `HC_A_DB_PASSWORD` | Health Center A database password |
| `HC_B_DB_PASSWORD` | Health Center B database password |

YAML supports `${ENV_VAR}` substitution for string values. Unset variables become empty strings; the local database is validated at startup and must have host, port, user, password, and database set before any MySQL connection is attempted.

Copy `.env.example` to `.env` at the repository root and set at least `LOCAL_DB_PASSWORD` for local development.

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

Single local Medisoft database connection. **Required** for coordinator and worker services.

Default development values in `configs/platform.yaml`:

| Field | Value |
|-------|-------|
| `host` | `127.0.0.1` |
| `port` | `3306` |
| `user` | `root` |
| `password` | `${LOCAL_DB_PASSWORD}` |
| `database` | `medisoft_testing` |

At startup, the coordinator logs the resolved config path and local database connection summary (without the password value). The database layer logs the same fields again immediately before connecting.

### `onlineDatabases`

Array of online facility databases. Each entry requires:

| Key | Description |
|-----|-------------|
| `id` | Unique identifier |
| `facilityCode` | Used for coordinator state and logging |
| `enabled` | Set `false` to disable without removing |
| `host`, `port`, `user`, `password`, `database` | MySQL connection |

## Validation

Configuration is validated at startup using Zod. The local database block is additionally checked for empty or unresolved fields; invalid config causes immediate exit with a `ConfigurationError` before MySQL connections are opened.
