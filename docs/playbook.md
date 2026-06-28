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

- **F-001:** Map exact Medisoft table/column names for RHIE status fields
- **F-002:** Define RHIE API payload schemas per endpoint
- **F-003:** Implement duplicate upload prevention via database locking or status transitions
- **F-004:** Add integration tests against Medisoft schema fixtures
- **F-005:** Evaluate coordinator state in shared DB table for multi-host deployment
