# Medisoft RHIE Integration Platform

Autonomous background services that synchronize data between Medisoft MySQL databases and the Rwanda Health Information Exchange (RHIE).

This platform is **fully independent** from Medisoft source code. It depends only on:

- Medisoft MySQL databases (local and online)
- Rwanda HIE APIs
- Configuration files

## Architecture Overview

```
Local Database ──► Sync ──► Online Database(s) ──► RHIE
                                ▲
                                │ (primary)
                                │
                     Coordinator decides mode
                                │
              Local services (secondary/fallback)
```

### Services (execution order)

1. **Client Registry Service** — upload clients to Client Registry
2. **Encounter ID Service** — generate RHIE Encounter IDs
3. **Visit Encounter Service** — upload visit encounters
4. **Transfer Encounter Service** — upload transfer encounters
5. **Observation Service** — upload observations
6. **Synchronization Coordinator** — manages online/local processing mode

Each service polls the database independently. The database is the communication mechanism between services.

## Project Structure

```
rhie-integration/
├── apps/                    # Runnable background services
│   ├── coordinator/
│   ├── client-service/
│   ├── encounter-id-service/
│   ├── visit-service/
│   ├── transfer-service/
│   └── observation-service/
├── packages/                # Shared libraries
│   ├── config/
│   ├── database/
│   ├── logger/
│   ├── rhie-client/
│   ├── retry/
│   ├── monitoring/
│   └── shared/
├── configs/                 # Platform configuration
├── scripts/                 # Build and deployment scripts
├── docs/                    # Documentation and playbook
└── tests/
```

## Quick Start

### Prerequisites

- Node.js >= 20
- MySQL access to Medisoft databases
- RHIE API credentials

### Setup

```bash
cp .env.example .env
# Edit configs/platform.yaml with your database and RHIE settings

npm install
npm run build
```

### Run with PM2 (production)

```bash
chmod +x scripts/*.sh
./scripts/start-all.sh
```

### Run individual services (development)

```bash
npm run dev:coordinator
npm run dev:client
npm run dev:encounter-id
npm run dev:visit
npm run dev:transfer
npm run dev:observation
```

### Health Endpoints

| Service | Port |
|---------|------|
| Coordinator | 9090 |
| Client Service | 9091 |
| Encounter ID Service | 9092 |
| Visit Service | 9093 |
| Transfer Service | 9094 |
| Observation Service | 9095 |

- `GET /health` — service health snapshot
- `GET /metrics` — worker metrics

## Adding a New Facility

Add an entry to `onlineDatabases` in `configs/platform.yaml`. No code changes required.

```yaml
onlineDatabases:
  - id: online-hc-d
    name: Health Center D
    role: online
    facilityCode: HC-D
    host: db-hcd.example.com
    port: 3306
    user: medisoft
    password: ${HC_D_DB_PASSWORD}
    database: medisoft_hcd
    enabled: true
```

Restart services to pick up the new worker.

## Documentation

- [Architecture](docs/architecture.md)
- [Project Playbook](docs/playbook.md)
- [Configuration Guide](docs/configuration.md)

## Current Status

**Phase 1 (complete):** Project structure, shared libraries, worker framework, coordinator, service lifecycle, configuration system, health monitoring.

**Phase 2 (next):** Business logic — database queries, RHIE payload mapping, status field updates per Medisoft schema.

## Technology Stack

- Node.js + TypeScript (strict)
- MySQL (mysql2)
- Axios
- Pino (structured logging)
- Zod (config validation)
- PM2 (process management)
