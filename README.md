# Medisoft RHIE Integration Platform

Autonomous background services that synchronize data between Medisoft MySQL databases and the Rwanda Health Information Exchange (RHIE).

## Current Status

| Phase | Status |
|-------|--------|
| Phase 1 | Complete — project structure, shared libraries, stub services |
| Phase 2a | Complete — Client Registry PHP reverse-engineering |
| Phase 2.5 | Complete — reusable platform foundation |
| **Phase 3** | **Complete — Client Registry service (shadow + production modes)** |
| Phase 4 | Next — Encounter ID service |

## Quick Start

```bash
cp .env.example .env
# Edit configs/platform.yaml

npm install
npm run build

# Start platform
npm run dev:coordinator          # Orchestrator (port 9090)
npm run dev:client-host          # Client Registry workers (port 9091)
npm run dev:encounter-host       # Encounter ID workers (port 9092)
```

Or via PM2: `./scripts/start-all.sh`

## Architecture

```
Coordinator (mode decisions)
    ↓ state file
Worker Hosts (generic runners)
    ↓ extends
AbstractWorker → ModeAwareWorker → Service Workers
    ↓ uses
Database | RHIE Client | Retry | Logger | Health | Metrics
```

See [Platform Foundation](./docs/platform-foundation.md) for full documentation.

## Project Structure

```
rhie-integration/
├── apps/
│   ├── coordinator/          # Platform orchestrator
│   └── worker-host/          # Generic worker runner
├── services/                 # Worker implementations (stubs)
│   ├── client-registry/
│   ├── encounter-id/
│   ├── visit-encounter/
│   ├── transfer-encounter/
│   ├── observation/
│   └── registry/             # Worker factory aggregator
├── packages/
│   ├── worker-framework/     # AbstractWorker, WorkerHost
│   ├── health/               # Health checks
│   ├── metrics/              # Worker metrics
│   ├── database/             # MySQL abstraction
│   ├── rhie-client/          # RHIE API client
│   ├── config/               # Configuration system
│   ├── logger/               # Structured logging
│   ├── retry/                # Retry framework
│   ├── monitoring/           # Legacy health (Phase 1)
│   └── shared/               # Legacy compatibility
├── configs/                  # platform.yaml
├── docs/                     # Documentation
└── rhie/                     # Legacy PHP (reference only)
```

## Documentation

- [Platform Foundation](./docs/platform-foundation.md)
- [Worker Framework](./docs/worker-framework.md)
- [Coordinator](./docs/coordinator.md)
- [Architecture](./docs/architecture.md)
- [Configuration](./docs/configuration.md)
- [Project Playbook](./docs/playbook.md)
