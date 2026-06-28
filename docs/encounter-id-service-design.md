# Encounter ID — Service Design

TypeScript architecture for the Encounter ID service, aligned with the Client Registry reference implementation.

---

## Folder Structure

```
services/encounter-id/
├── src/
│   ├── index.ts
│   ├── worker/
│   │   └── encounter-id.worker.ts
│   ├── domain/
│   │   ├── encounter.processor.ts
│   │   ├── encounter-payload.builder.ts
│   │   ├── uuid.ts
│   │   └── types.ts
│   └── repository/
│       ├── encounter.repository.ts
│       └── sql.ts
├── package.json
└── tsconfig.json
```

---

## Architecture Diagram

```mermaid
flowchart TB
    subgraph App["services/encounter-id"]
        WRK[EncounterIdWorker]
        PROC[EncounterProcessor]
        BUILD[EncounterPayloadBuilder]
        REPO[EncounterRepository]
        UUID[generateEncounterUuid]
    end

    subgraph Packages["packages/"]
        WF[@rhie/worker-framework]
        DB[@rhie/database]
        LOG[@rhie/logger]
        CFG[@rhie/config]
        SHARED[@rhie/shared]
    end

    WRK --> PROC
    PROC --> REPO
    PROC --> BUILD
    BUILD --> UUID
    PROC --> SHARED
    REPO --> DB
    WRK --> WF
    WRK --> LOG
    WRK --> CFG
```

**Note:** No `@rhie/rhie-client` dependency — this service is database-only.

---

## Class Design

### `EncounterIdWorker` (extends `ModeAwareWorker`)

**Responsibilities:**

- Lazy-init processor on first batch
- Delegate to `EncounterProcessor.processAllGenerators()`
- Log batch start with execution mode and facility context

```typescript
protected async processBatch(ctx: WorkerExecutionContext): Promise<BatchResult>
```

---

### `EncounterProcessor`

**Responsibilities:**

- Run all 13 generators in PHP batch order
- Per-generator try/catch (failure isolated)
- Shadow vs production gating on writes
- Aggregate `{ processed, failed, skipped }` counts

**Dependencies:**

```typescript
interface EncounterProcessorDeps {
  repository: EncounterRepository;
  payloadBuilder: EncounterPayloadBuilder;
  logger: Logger;
  config: EncounterIdConfig;
  uuidFactory?: () => string;  // injectable for tests
}
```

**Generator methods** (private, mirror PHP controller):

- `generateVisitEncounters(startDate)`
- `generateTransferEncounters(startDate)`
- `generateOrdersEncounters(startDate, type, typeDisplay)`
- `generateComplaintEncounters(startDate)`
- `generateVitalSignEncounters(startDate)`
- `generateLabRequestEncounters(startDate)`
- `generateLabEncounters(startDate)`
- `generateDiagEncounters(startDate)`
- `generateVitalNCDsEncounters(startDate)`
- `generatePlaintesNCDsEncounters(startDate)`
- `generateDiagnosticNCDsEncounters(startDate)`
- `generateReferralEncounters(startDate)`

**Grouping helper:**

```typescript
private groupByClientDate<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]>
```

---

### `EncounterPayloadBuilder`

**Responsibilities:**

- Build `MainEncounterPayload` and `PatientEncounterPayload`
- Set `rhieStatus: 2` and timestamp
- No business logic beyond field mapping

```typescript
buildMainEncounter(input: MainEncounterInput): MainEncounterPayload
buildPatientEncounter(input: PatientEncounterInput): PatientEncounterPayload
serialize(payload): string
```

---

### `EncounterRepository`

**Responsibilities:**

- Execute exact SQL from `sql.ts`
- Insert/update methods for production mode
- Read-only queries for shadow mode

**Key methods:**

| Method | SQL |
|--------|-----|
| `fetchVisitEncounters(date)` | SQL_VISIT_ENCOUNTERS |
| `fetchTransferEncounters(date)` | SQL_TRANSFER_ENCOUNTERS |
| `insertMainEncounter(payload)` | SQL_INSERT_MAIN_ENCOUNTER |
| `insertPatientEncounter(payload)` | SQL_INSERT_PATIENT_ENCOUNTER |
| `mainEncounterExists(...)` | SQL_CHECK_MAIN_ENCOUNTER |
| `markVisitAsUploaded(clientId)` | SQL_MARK_VISIT |
| … | … |

Uses `DatabaseConnection` from worker context (same as Client Registry).

---

## Configuration

```typescript
// packages/config/src/encounter-id.ts
export const EncounterIdConfigSchema = z.object({
  executionMode: z.enum(['shadow', 'production']).default('shadow'),
  generateFromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default('2026-06-24'),
  transferGenerateFromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default('2026-06-20'),
});
```

```yaml
# configs/platform.yaml
encounterId:
  executionMode: shadow
  generateFromDate: "2026-06-24"
  transferGenerateFromDate: "2026-06-20"
```

---

## Shadow vs Production

```typescript
if (config.executionMode === 'shadow') {
  logger.info({ event: 'shadow_payload_built', generator, payload }, 'Shadow — insert skipped');
  processed += 1;
  continue;
}

await repository.insertPatientEncounter(payload);
await repository.markOrderAsUploaded(orderId);
```

---

## Worker Registration

Already in `services/registry/src/index.ts`:

```typescript
import { encounterIdWorkerFactory } from '@rhie/service-encounter-id';
```

Run:

```bash
npm run dev:encounter-host
# WORKER_TYPES=encounter-id, HEALTH_PORT=9092
```

---

## Metrics and Logging

Structured log events:

| Event | When |
|-------|------|
| `batch_start` | Worker cycle begins |
| `generator_start` | Each generator begins |
| `generator_complete` | Generator finished with counts |
| `generator_error` | Generator exception |
| `shadow_payload_built` | Shadow mode payload logged |
| `encounter_inserted` | Production insert success |
| `source_marked` | Source rhie_status updated |

---

## Comparison with Client Registry

| Aspect | Client Registry | Encounter ID |
|--------|-----------------|--------------|
| PayloadBuilder output | FHIR Patient JSON | DB insert tuple |
| External API | Yes (single POST) | No |
| Batch unit | One client at a time | All generators per cycle |
| Repository writes | upid_patients.status | encounter_* + source tables |
| rhie-client | Required | Not used |

---

## Future Extensions (Out of Phase 4)

- `ensureVisitEncounterForClient()` — expose via API for upload service on-demand
- `ensureReferralEncounterForClient()` — same
- `enabledGenerators` config filter
- Per-generator metrics in `@rhie/metrics`
