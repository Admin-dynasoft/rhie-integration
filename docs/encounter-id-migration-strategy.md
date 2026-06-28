# Encounter ID — Migration Strategy

Strategy for migrating from PHP `generate_encounters_batch.php` to the TypeScript Integration Platform service.

---

## Migration Principles

1. **PHP is source of truth** — preserve SQL, grouping, type strings, and status transitions exactly
2. **No HIE API** — this module is database-only; do not add RHIE calls
3. **Reuse platform infrastructure** — WorkerHost, ModeAwareWorker, config, logging, health
4. **Shadow first** — validate payloads before enabling production writes
5. **Parallel run optional** — shadow TS + production PHP during cutover window

---

## Phase 4 Deliverables

| Deliverable | Location |
|-------------|----------|
| Service package | `services/encounter-id/` |
| Config schema | `packages/config/src/encounter-id.ts` |
| Worker registration | `services/registry/src/index.ts` (already stubbed) |
| PM2 entry | `dev:encounter-host` (port 9092, already configured) |
| Documentation | `docs/encounter-id-*.md` |
| Tests | Payload builder + processor shadow mode |

---

## Cutover Steps

### Step 1: Shadow deployment

```bash
# platform.yaml
encounterId:
  executionMode: shadow
  generateFromDate: "2026-06-24"
  transferGenerateFromDate: "2026-06-20"
```

Run TS worker alongside PHP batch. Compare shadow logs against PHP inserts for same date range.

### Step 2: Payload validation

For each generator type, capture:

- Row count from selection SQL
- Grouping keys
- Payload field values (with mocked UUID)

Compare TS shadow output to PHP DB audit query:

```sql
SELECT type, client_id, date, source_id, source_table
FROM encounter_patients
WHERE rhie_uploaded_at >= ?
ORDER BY type, client_id, date;
```

### Step 3: Production cutover

1. Disable PHP cron for `generate_encounters_batch.php`
2. Set `executionMode: production`
3. Restart `encounter-id-host` PM2 process
4. Monitor metrics: processed/failed counts per generator

### Step 4: Rollback

If issues detected:

1. Set `executionMode: shadow` or stop TS worker
2. Re-enable PHP batch
3. Source `rhie_status = 0` records will be picked up by PHP

No data loss: TS production uses same INSERT/UPDATE semantics as PHP.

---

## Config Migration

| PHP (hardcoded) | TypeScript config |
|-----------------|-------------------|
| `"2026-06-24" ?? date('Y-m-d')` | `encounterId.generateFromDate` |
| `$start_from = '2026-06-20'` | `encounterId.transferGenerateFromDate` |
| Facility list from central DB | `onlineDatabases` / `localDatabase` |
| Memory 500M, no time limit | Worker framework sleep interval |

---

## Generator Rollout

All 13 generators ship in Phase 4 as a single worker (matches PHP batch order). No phased generator rollout — partial deployment would leave encounter types unprocessed.

Optional future enhancement: `enabledGenerators: string[]` config to disable specific types without code change.

---

## Testing Strategy

### Unit tests

- `EncounterPayloadBuilder` — all type mappings, status=2, UPID passthrough
- `generateEncounterUuid` — format validation (8-4-4-4-12 hex)

### Integration tests (future — F-004)

- Medisoft schema fixtures
- Full generator cycle with in-memory or test MySQL

### Shadow comparison

Run both systems against same facility DB snapshot:

1. Export `encounter_main` / `encounter_patients` counts before
2. Run PHP batch
3. Restore snapshot
4. Run TS shadow (log payloads)
5. Diff payload count and field values

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| patient_id vs client_id join mismatch | Exact SQL port per generator |
| Vital type check mismatch (`encountervital` vs `encounter_vital`) | Preserve PHP behaviour |
| Large date ranges process all history | Configurable start date; monitor batch duration |
| Duplicate inserts on patient encounters | Plain INSERT like PHP — upload dedup is separate |
| PHP batch has no return values | TS returns structured GeneratorResult for logging |

---

## Dependencies on Other Services

| Prerequisite | Service | Status field |
|--------------|---------|--------------|
| Patient registered in HIE | Client Registry | `upid_patients.status = 2` (implicit via UPID availability) |
| Visit before transfer | Encounter ID (internal) | `clientts.rhie_status` 0 → 1 → transfer at 1 |

Encounter ID does not depend on Client Registry TS service at runtime — only on Medisoft data state.

---

## Success Criteria

- [ ] All 13 generators produce identical insert tuples to PHP (modulo UUID)
- [ ] Source status updates match PHP mark* methods
- [ ] Shadow mode produces zero DB writes
- [ ] Production mode runs via worker-host on port 9092
- [ ] Build and tests pass in CI
- [ ] Playbook ADRs updated
