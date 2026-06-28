# Project Playbook

Architectural decisions and rationale for the Medisoft RHIE Integration Platform.

## ADR-001: Monorepo with npm Workspaces

**Decision:** Use a single repository with `packages/` for shared libraries and `apps/` for services.

**Rationale:** Shared code (database, logging, RHIE client) must not be duplicated across six services. npm workspaces provide simple dependency linking without publishing.

## ADR-002: Database as Inter-Service Communication

**Decision:** Services communicate exclusively through Medisoft MySQL status fields. No inter-service HTTP or message queues.

**Rationale:** Matches the existing PHP batch script model. Allows independent service restarts. Local and online databases share the same schema, enabling seamless failover.

## ADR-003: Coordinator State File

**Decision:** The coordinator writes processing mode to a JSON file; workers read it with a 2-second cache.

**Rationale:** Avoids adding infrastructure (Redis, etc.). File-based state is sufficient for single-host deployment. PM2 runs all services on one machine per facility server.

**Alternative considered:** Shared database table for coordinator state — rejected for Phase 1 to avoid schema changes to Medisoft.

## ADR-004: Primary/Secondary via Processing Mode

**Decision:** Each facility has a mode (`online`, `local`, `standby`). Workers check mode before processing.

**Rationale:** Prevents duplicate RHIE uploads when both local and online databases are available. Local workers automatically activate when online databases fail health checks.

## ADR-005: Continuous Polling Workers

**Decision:** No cron jobs. Each service runs an infinite loop with configurable sleep intervals.

**Rationale:** User requirement. Provides immediate processing when records appear. Sleep interval prevents database overload during idle periods.

## ADR-006: One Worker Per Online Facility

**Decision:** Online services spawn independent workers per `onlineDatabases` entry.

**Rationale:** Facilities must be processed concurrently without blocking each other. Adding a facility requires only a config entry.

## ADR-007: Pino for Structured Logging

**Decision:** Use Pino over Winston.

**Rationale:** Lower overhead, native JSON output for production log aggregation, optional pretty-print for development.

## ADR-008: Zod for Configuration Validation

**Decision:** Validate all configuration at startup with Zod schemas.

**Rationale:** Fail fast on misconfiguration. Type-safe config throughout the codebase.

## ADR-009: Stub Business Logic in Phase 1

**Decision:** Service `processBatch` methods return zero records until Medisoft schema mapping is defined.

**Rationale:** User instruction to complete architecture before business logic. Prevents incorrect assumptions about table/column names.

## ADR-010: PM2 Process Management

**Decision:** Provide `ecosystem.config.js` for PM2 deployment.

**Rationale:** User requirement. PM2 handles auto-restart, logging, and process supervision in production.

## ADR-011: Strict TypeScript

**Decision:** Enable `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitAny`.

**Rationale:** Healthcare integration requires reliability. Strict typing catches errors at compile time.

## ADR-012: Dependency Injection via Constructor

**Decision:** Pass dependencies (logger, database, RHIE client) through constructors and context objects rather than a DI container.

**Rationale:** Keeps the codebase simple. A full DI framework adds complexity without benefit at this scale.

## Future Decisions (Phase 2+)

- **F-001:** ~~Map exact Medisoft table/column names for RHIE status fields~~ → **Done** — see `docs/client-registry-database-analysis.md`
- **F-002:** ~~Define RHIE API payload schemas per endpoint~~ → **Done** — see `docs/client-registry-payload-mapping.md`
- **F-003:** Implement duplicate upload prevention via database locking or status transitions
- **F-004:** Add integration tests against Medisoft schema fixtures
- **F-005:** Evaluate coordinator state in shared DB table for multi-host deployment

---

## ADR-013: Client Registry Uses HTTP Basic Auth (Phase 2 Finding)

**Finding:** Production PHP code uses `CURLOPT_USERPWD` (HTTP Basic Auth), not Bearer or OAuth2.

**Impact:** `@rhie/rhie-client` must support `auth.type: basic` before Client Registry implementation.

**Source:** `ClientRegistryController.sendToHIE()`, credentials in `config/hie.php`.

---

## ADR-014: Preserve Exact FHIR Payload Quirks (Phase 2 Finding)

**Decision:** TypeScript payload builder must reproduce all production quirks exactly:

- `deceasedBoolean: true` (hardcoded)
- Name fields swapped (`given_name` → FHIR `family`, `family_name` → FHIR `given`)
- Phone prefix `+25` (not `+250`)
- Empty `extension: [{}]` object
- `id` field set to UPID (non-standard FHIR)

**Rationale:** HIE registry accepts this exact format. Changing any field risks rejection.

---

## ADR-015: upid_patients.status Is the Sole Tracking Field (Phase 2 Finding)

**Finding:** Client Registry reads/writes only `upid_patients.status` (values 0–3). No separate `rhie_status` column, no response ID storage, no upload timestamps.

**Impact:** TypeScript repository updates only this column. Status `2` excludes records from all selection queries.

---

## ADR-016: Referral Filter Is Active in Production Batch (Phase 2 Finding)

**Finding:** `client_registry_batch.php` INNER JOINs `referral` with comment "TESTING MODE." This filter is active in the committed code.

**Decision:** Make referral requirement configurable in TypeScript service. Default to `true` to match current PHP behavior until stakeholders confirm removal.

**Open question:** Confirm with operations team whether referral filter is intentional for production.

---

## ADR-017: patient_id vs client_id Ambiguity (Phase 2 Finding)

**Finding:** Batch selects by `upid_patients.patient_id` but Model queries by `upid_patients.client_id`. Both are passed as `$clientID`.

**Decision:** Verify against live Medisoft schema before implementation. Document both column names; use the same column the PHP code uses in each query context.

---

## ADR-018: Central DB vs Config File for Facilities (Phase 2 Finding)

**Finding:** PHP reads facility list from central `medisoft_hie.health_facilities`. Phase 1 platform uses YAML `onlineDatabases`.

**Decision:** TypeScript service uses YAML config (Phase 1 approach). Facility entries must be kept in sync with central DB. Optional future enhancement: config loader that reads from central DB at startup.

