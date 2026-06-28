# Client Registry — Service Design

TypeScript architecture for the Client Registry service, aligned with the Phase 1 Integration Platform structure.

---

## Folder Structure

```
apps/client-service/
├── src/
│   ├── index.ts                      # Entry point — bootstrapService()
│   ├── worker/
│   │   └── client-registry.worker.ts # WorkerDefinition implementation
│   ├── domain/
│   │   ├── client-registry.processor.ts
│   │   ├── patient-payload.builder.ts
│   │   └── types.ts
│   ├── repository/
│   │   └── client-registry.repository.ts
│   └── config/
│       └── client-registry.config.ts # Service-specific config extensions
├── package.json
└── tsconfig.json

packages/shared/src/
└── upid/
    ├── sanitize.ts                   # rhieSanitizeUpid port
    └── exclude.ts                    # rhieUpidIsExcluded port
```

Shared libraries (already exist from Phase 1):

```
packages/
├── config/          # Platform + service config loading
├── database/        # MySQL connection pools
├── logger/          # Structured Pino logging
├── rhie-client/     # HTTP client (needs Basic Auth update)
├── retry/           # Retry manager (optional for HIE calls)
├── monitoring/      # Health + heartbeat
└── shared/          # Worker framework + service lifecycle
```

---

## Architecture Diagram

```mermaid
flowchart TB
    subgraph App["apps/client-service"]
        IDX[index.ts]
        WRK[ClientRegistryWorker]
        PROC[ClientRegistryProcessor]
        BUILD[PatientPayloadBuilder]
        REPO[ClientRegistryRepository]
    end

    subgraph Packages["packages/"]
        SHARED[@rhie/shared]
        DB[@rhie/database]
        RHIE[@rhie/rhie-client]
        LOG[@rhie/logger]
        MON[@rhie/monitoring]
        CFG[@rhie/config]
        UPID[upid filter utils]
    end

    IDX --> SHARED
    WRK --> PROC
    PROC --> REPO
    PROC --> BUILD
    PROC --> RHIE
    PROC --> UPID
    REPO --> DB
    WRK --> LOG
    WRK --> MON
    SHARED --> CFG
```

---

## Class and Interface Design

### `ClientRegistryWorker` (WorkerDefinition)

Implements the Phase 1 `WorkerDefinition` interface. Entry point for each poll cycle.

```typescript
interface WorkerDefinition {
  readonly name: string;
  readonly databaseRole: 'local' | 'online';
  processBatch(context: WorkerContext): Promise<WorkerProcessResult>;
}
```

**Responsibilities:**

- Called by `ContinuousWorker` on each poll cycle
- Delegates to `ClientRegistryProcessor.processPendingClients()`
- Returns `{ processed, failed, skipped }` counts
- Respects coordinator mode (handled by framework)

---

### `ClientRegistryProcessor`

**Responsibilities:**

- Orchestrate the per-client workflow (mirrors `ClientRegistryController.processClient`)
- For each pending client: load UPIDs, process each UPID
- Handle errors: mark client failed on unhandled exception
- Increment health monitor metrics

```typescript
interface ClientRegistryProcessorDeps {
  repository: ClientRegistryRepository;
  payloadBuilder: PatientPayloadBuilder;
  rhieClient: RhieClient;
  logger: Logger;
  config: ClientRegistryServiceConfig;
}

class ClientRegistryProcessor {
  async processPendingClients(
    database: DatabaseConnection,
    batchSize: number,
  ): Promise<WorkerProcessResult>;

  private async processClient(
    clientId: number,
  ): Promise<{ processed: number; failed: number; skipped: number }>;

  private async processUpid(
    upid: string,
    clientId: number,
  ): Promise<'processed' | 'failed' | 'skipped'>;
}
```

**Workflow (identical to PHP):**

```
processPendingClients()
  → repository.findPendingClientIds(batchSize)
  → for each clientId:
      processClient(clientId)
        → repository.getUpidsByClient(clientId)
        → for each upid:
            sanitize + exclude check
            → repository.getClientDataByUpid(upid)
            → if no data: updateStatus(upid, 3), continue
            → payloadBuilder.build(data)
            → rhieClient.uploadClientRegistry(payload)
            → if success: updateStatus(upid, 2)
              else: updateStatus(upid, 3)
        → on exception: repository.markClientAsFailed(clientId)
```

---

### `PatientPayloadBuilder`

**Responsibilities:**

- Pure function class — builds FHIR Patient JSON from DB row
- Exact port of `ClientRegistryController.buildPatientPayload()`
- No side effects, no I/O

```typescript
interface PatientDataRow {
  UPID: string;
  nida: string;
  full_names: string;
  last_name: string;    // maps to given
  first_name: string;   // maps to family
  gender: string;
  marital_status: string;
  phone: string;
  birthdate: string;
  state: string;
  district: string;
  line: string;
}

interface FhirPatientPayload {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{ system: string; value: string }>;
  active: boolean;
  name: Array<{ family: string; given: string[] }>;
  gender: 'male' | 'female';
  birthDate: string;
  deceasedBoolean: boolean;
  telecom: Array<{ system: string; value: string; use: string }>;
  address: Array<{ type: string; country: string; state: string; district: string; line: string; city: string; postalCode: string }>;
  maritalStatus: { coding: Array<{ system: string; code: string; display: string }> };
  extension: Array<Record<string, never>>;
}

class PatientPayloadBuilder {
  build(data: PatientDataRow): FhirPatientPayload;
  private mapGender(sex: string): 'male' | 'female';
  private mapMaritalStatus(code: string): { code: string; display: string };
}
```

---

### `ClientRegistryRepository`

**Responsibilities:**

- All SQL queries — exact ports from `ClientRegistryModel` + batch selection SQL
- Parameterized queries via `@rhie/database`
- No business logic

```typescript
class ClientRegistryRepository {
  constructor(private db: DatabaseConnection, private config: ClientRegistryServiceConfig);

  findPendingClientIds(limit: number): Promise<number[]>;
  getUpidsByClient(clientId: number): Promise<string[]>;
  getClientDataByUpid(upid: string): Promise<PatientDataRow | null>;
  updateUpidStatus(upid: string, status: UpidStatus): Promise<void>;
  markClientAsFailed(clientId: number): Promise<void>;
}

type UpidStatus = 0 | 1 | 2 | 3;
```

**SQL methods map 1:1 to PHP:**

| Method | PHP source |
|--------|------------|
| `findPendingClientIds` | Batch inline SQL |
| `getUpidsByClient` | `ClientRegistryModel.getUpidsByClient` |
| `getClientDataByUpid` | `ClientRegistryModel.getClientDataByUpid` |
| `updateUpidStatus` | `ClientRegistryModel.updateUpidStatus` |
| `markClientAsFailed` | `ClientRegistryModel.markClientAsFailed` |

---

### `ClientRegistryServiceConfig`

Service-specific configuration extending platform config.

```typescript
interface ClientRegistryServiceConfig {
  /** Match PHP referral filter — default true to preserve current behavior */
  requireReferral: boolean;
  /** Max clients per poll cycle — matches max_clients_registry_per_run */
  batchSize: number;
  /** Exclude TP- document numbers — default true */
  excludeTemporaryDocuments: boolean;
}
```

---

## Shared Library Usage

| Concern | Library | Usage in Client Registry |
|---------|---------|--------------------------|
| Config | `@rhie/config` | RHIE URL, auth, worker sleep interval |
| Database | `@rhie/database` | Facility connection pools |
| Logger | `@rhie/logger` | Structured events: poll, upload, failure |
| RHIE Client | `@rhie/rhie-client` | `uploadClientRegistry(payload)` — needs Basic Auth |
| Retry | `@rhie/retry` | Optional — PHP does not retry HIE calls; preserve single-attempt default |
| Monitoring | `@rhie/monitoring` | Heartbeat, processed/failed counts |
| Worker framework | `@rhie/shared` | ContinuousWorker, ServiceLifecycle |
| UPID filter | `@rhie/shared/upid` | Sanitize and exclude — shared across all future services |

---

## Logging Events

Structured log events matching PHP stdout patterns:

| Event | Level | Fields |
|-------|-------|--------|
| `service_start` | info | service, databaseId, facilityId |
| `poll_records` | debug | pendingCount |
| `client_processing_start` | info | clientId, facilityId |
| `upid_processing_start` | debug | upid, clientId |
| `fetch_local_data` | debug | upid, success |
| `build_patient_payload` | debug | upid |
| `upload_success` | info | upid, httpStatus |
| `upload_failed` | error | upid, httpStatus, error |
| `status_updated` | debug | upid, status |
| `client_marked_failed` | warn | clientId |
| `records_processed` | info | processed, failed, skipped |

---

## RHIE Client Update Required

Phase 1 `@rhie/rhie-client` must be extended:

```typescript
// packages/rhie-client/src/auth.ts — add Basic Auth
case 'basic': {
  return {}; // credentials via axios auth option
}

// packages/rhie-client/src/client.ts
this.http = axios.create({
  baseURL: options.config.baseUrl,
  timeout: options.config.timeoutMs,
  auth: config.auth.type === 'basic'
    ? { username: config.auth.username!, password: config.auth.password! }
    : undefined,
});
```

Headers for Client Registry upload:

```
Content-Type: application/fhir+json
Accept: application/fhir+json
```

---

## Entry Point

```typescript
// apps/client-service/src/index.ts
import { bootstrapService } from '@rhie/shared';
import { createClientRegistryWorker } from './worker/client-registry.worker.js';

async function main(): Promise<void> {
  await bootstrapService({
    serviceName: 'client-service',
    workerDefinitions: [
      createClientRegistryWorker('online'),
      createClientRegistryWorker('local'),
    ],
    healthPortOffset: 1,
  });
}

main().catch((error) => {
  console.error('client-service failed to start:', error);
  process.exit(1);
});
```

---

## Testing Strategy

| Test type | Scope |
|-----------|-------|
| Unit | `PatientPayloadBuilder` — verify exact JSON output for known DB rows |
| Unit | UPID sanitize/exclude — port of upid_filter.php test cases |
| Integration | Repository SQL against Medisoft schema fixture DB |
| Integration | Full processor flow with mocked RHIE client |
| Shadow | Production DB, log payloads without HIE call or status update |
| Parity | Compare TypeScript vs PHP payload for same UPID |

---

## Duplicated Code Identified in PHP → Shared Library Recommendations

| PHP duplication | Recommended shared module | Used by |
|-----------------|---------------------------|---------|
| `getCentralPDOConnection` / `getFacilityPDOConnection` | `@rhie/database` DatabaseManager | All services |
| `rhieSanitizeUpid` / `rhieUpidIsExcluded` | `@rhie/shared/upid` | Client Registry, Encounter ID, all UPID services |
| `sendToHIE` cURL pattern | `@rhie/rhie-client` | All RHIE upload services |
| `batch_helpers` locking/logging | `@rhie/shared` worker + `@rhie/monitoring` | All services |
| `config/hie.php` credentials | `@rhie/config` | All services |
| Gender/marital status mapping | `@rhie/shared/fhir-mappers` (future) | Client Registry, possibly others |
| JSON step logging | `@rhie/logger` structured events | All services |

---

## Implementation Order

1. `@rhie/shared/upid` — sanitize and exclude utilities
2. `@rhie/rhie-client` — Basic Auth support
3. `ClientRegistryRepository` — SQL ports with tests
4. `PatientPayloadBuilder` — payload port with unit tests
5. `ClientRegistryProcessor` — orchestration
6. `ClientRegistryWorker` — wire into ContinuousWorker
7. Configuration — referral filter, batch size
8. Shadow mode validation
9. Production cutover
