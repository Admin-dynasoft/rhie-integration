# Platform Foundation Overview (Phase 2.5)

Phase 2.5 builds the reusable infrastructure that all RHIE services share.

## Package Map

| Package | Purpose |
|---------|---------|
| `@rhie/worker-framework` | AbstractWorker, WorkerHost, execution modes, graceful shutdown |
| `@rhie/health` | Health checks (healthy/degraded/offline), HTTP health server |
| `@rhie/metrics` | Worker metrics collection, metrics HTTP server |
| `@rhie/database` | Connection pooling, reconnect, transactions |
| `@rhie/rhie-client` | RHIE API client with Basic Auth, FHIR support, retries |
| `@rhie/config` | Centralized YAML config with Zod validation |
| `@rhie/logger` | Structured logging with correlation IDs, file output |
| `@rhie/retry` | Exponential backoff, permanent vs temporary failures |
| `@rhie/shared` | Legacy Phase 1 compatibility layer |
| `@rhie/monitoring` | Phase 1 health monitor (still used by legacy apps) |

## App Map

| App | Purpose |
|-----|---------|
| `apps/coordinator` | Platform orchestration — mode decisions, health polling |
| `apps/worker-host` | Generic worker runner — loads service workers from registry |
| `apps/*-service` | Legacy Phase 1 stubs (deprecated — use worker-host) |

## Service Map

| Service | Worker Type | Status |
|---------|-------------|--------|
| `services/client-registry` | `client-registry` | **Implemented** (shadow + production) |
| `services/encounter-id` | `encounter-id` | Stub |
| `services/visit-encounter` | `visit-encounter` | Stub |
| `services/transfer-encounter` | `transfer-encounter` | Stub |
| `services/observation` | `observation` | Stub |
| `services/registry` | — | Aggregates all worker factories |

## Running the Platform

```bash
# Build
npm run build

# Start coordinator
npm run dev:coordinator

# Start individual worker hosts
npm run dev:client-host
npm run dev:encounter-host

# Or all via PM2
./scripts/start-all.sh
```

## Adding a New Service

1. Create `services/my-service/` with a worker extending `ModeAwareWorker`
2. Export a `WorkerFactory` from `services/my-service/src/index.ts`
3. Register in `services/registry/src/index.ts`
4. Add PM2 entry in `ecosystem.config.js`
5. Add health endpoint in `configs/platform.yaml` coordinator section
6. Implement business logic in `processBatch()` (Phase 3+)

No changes to worker-framework, worker-host, or coordinator required.

## Documentation Index

- [Worker Framework](./worker-framework.md)
- [Coordinator](./coordinator.md)
- [Architecture](./architecture.md)
- [Configuration](./configuration.md)
- [Project Playbook](./playbook.md)

## Client Registry (Phase 2 Analysis — not yet implemented)

- [Analysis](./client-registry-analysis.md)
- [Business Rules](./client-registry-business-rules.md)
- [Database Analysis](./client-registry-database-analysis.md)
- [RHIE API Analysis](./client-registry-rhie-api-analysis.md)
- [Payload Mapping](./client-registry-payload-mapping.md)
- [Migration Strategy](./client-registry-migration-strategy.md)
- [Service Design](./client-registry-service-design.md)
