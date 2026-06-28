# Integration State Layer

Phase 4.5 introduces `@rhie/integration-state` — independent RHIE synchronization metadata, separate from Medisoft business tables.

## Purpose

Track upload status, retries, RHIE identifiers, timestamps, errors, history, dead letters, and idempotency keys without modifying Medisoft clinical schema or removing existing `rhie_status` columns.

## Package

`@rhie/integration-state`

| Component | Role |
|-----------|------|
| `IntegrationStateStore` | High-level API for future services |
| `IntegrationStateRepository` | SQL access |
| `buildIdempotencyKey()` | Deterministic idempotency keys |
| `schema/sql.ts` | DDL for integration tables |

## Tables (Local database)

- `rhie_integration_state` — primary sync record per entity
- `rhie_integration_history` — processing event log
- `rhie_integration_dead_letter` — exhausted retry records

Tables are created automatically when `integrationState.autoMigrate: true`.

## Status Values

`pending` → `processing` → `success` | `failed` → `dead_letter`

## Idempotency Key Format

```
{facilityCode}:{pipelineStage}:{entityType}:{entityKey}
```

Example: `HC-A:client_registry:upid:602645-3179-7909`

## Migration Path

| Phase | Behaviour |
|-------|-----------|
| 4.5 (now) | Package available; Client Registry and Encounter ID unchanged |
| 5+ | Visit, Transfer, Observation services adopt IntegrationStateStore |
| Future | Dual-write or replace `rhie_status` reads/writes |

## Configuration

```yaml
integrationState:
  autoMigrate: true
  maxRetries: 3
  deadLetterAfterRetries: 5
```

Optional `databaseId` defaults to `localDatabase.id` (replication master).

## Usage (future services)

```typescript
const store = new IntegrationStateStore({ db, config, logger });
await store.ensureReady();

const key = store.buildIdempotencyKey({
  facilityCode: 'HC-A',
  pipelineStage: 'visit_encounter',
  entityType: 'encounter_main',
  entityKey: encountId,
});

if (!(await store.shouldProcess(key))) return;

await store.beginProcessing(key);
// ... RHIE upload ...
await store.recordSuccess(key, rhieResourceId);
```

Existing services continue using `rhie_status` until explicitly migrated.
