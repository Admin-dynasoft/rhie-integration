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
| `LOCAL_DB_HOST` | Override local database host |
| `LOCAL_DB_PASSWORD` | Local database password |
| `RHIE_API_TOKEN` | RHIE bearer token (referenced in YAML as `${RHIE_API_TOKEN}`) |
| `HC_A_DB_PASSWORD` | Health Center A database password |
| `HC_B_DB_PASSWORD` | Health Center B database password |

YAML supports `${ENV_VAR}` substitution for any string value.

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

Single local Medisoft database connection. Required.

### `onlineDatabases`

Array of online facility databases. Each entry requires:

| Key | Description |
|-----|-------------|
| `id` | Unique identifier |
| `facilityCode` | Used for coordinator state and logging |
| `enabled` | Set `false` to disable without removing |
| `host`, `port`, `user`, `password`, `database` | MySQL connection |

## Validation

Configuration is validated at startup using Zod. Invalid config causes immediate exit with descriptive errors.
