# Replication Monitor

Dedicated service for MySQL replication health between Local (master) and Online (replica) databases.

## App

`apps/replication-monitor` — PM2 name `rhie-replication-monitor`

## Package

`@rhie/replication-monitor` — probe logic and snapshot types (used by app and coordinator)

## Responsibilities

- Ping Local and Online databases
- Run `SHOW REPLICA STATUS` / `SHOW SLAVE STATUS` on Online connections
- Detect IO/SQL thread state and replication lag
- Publish `ReplicationMonitorSnapshot` via HTTP
- Expose health to Coordinator (Coordinator does **not** query replication SQL directly)

## Endpoints

| URL | Description |
|-----|-------------|
| `GET /health` | Aggregated health + embedded `replication` snapshot |
| `GET /replication/status` | Full replication snapshot JSON |
| `GET /ready` | Readiness probe |

Default port: **9088**

## Snapshot Shape

```json
{
  "updatedAt": "2026-06-28T12:00:00.000Z",
  "globalHealthy": true,
  "globalStatus": "healthy",
  "maxLagSeconds": 30,
  "facilities": {
    "HC-A": {
      "facilityCode": "HC-A",
      "localReachable": true,
      "onlineReachable": true,
      "healthy": true,
      "lagSeconds": 2,
      "ioRunning": "yes",
      "sqlRunning": "yes",
      "status": "healthy"
    }
  }
}
```

## Configuration

```yaml
replicationMonitor:
  pollIntervalMs: 10000
  maxLagSeconds: 30
  healthPort: 9088
  treatNonReplicaAsHealthy: true   # dev environments without replication
  preferLocalOnLag: true           # coordinator switches to local on lag

coordinator:
  replicationMonitorStatusUrl: http://127.0.0.1:9088/replication/status
  replicationMonitorTimeoutMs: 5000
```

## Coordinator Integration

Mode decision per facility:

| Local | Online | Replication | Mode |
|-------|--------|-------------|------|
| OK | OK | Healthy | `online` |
| OK | OK | Unhealthy/lag | `local` (if `preferLocalOnLag`) |
| OK | Down | — | `local` |
| Down | OK | — | `standby` |
| Down | Down | — | `standby` |

If replication monitor is unreachable, coordinator falls back to connectivity-only decisions and logs a warning.

## Run

```bash
npm run dev:replication-monitor
npm run dev:coordinator   # consumes replication status
```
