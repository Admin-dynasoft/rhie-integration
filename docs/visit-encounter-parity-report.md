# Visit Encounter Upload — PHP-to-Node Parity Report

Audit comparing the PHP reference implementation to the TypeScript `@rhie/service-visit-encounter` service.

**Audit date:** 2026-06-29  
**PHP source of truth:** `upload_visit_encounters_batch.php`, `UploadVisitEncounterController.php`, `UploadEncounterModel.php`, `GetEncounterModel.php`  
**Node implementation:** `services/visit-encounter/`

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Batch selection SQL | ✅ Parity | Exact match |
| Payload fetch SQL | ✅ Parity | Exact match |
| Mark uploaded SQL | ✅ Parity | Exact match |
| FHIR payload structure | ✅ Parity | All fields mapped |
| HIE endpoint | ✅ Parity | POST `/shr/Encounter` |
| HTTP headers | ✅ Parity | `application/fhir+json` |
| Authentication | ✅ Parity | HTTP Basic |
| Success codes | ✅ Parity | 200, 201 |
| Retry logic | ✅ Parity | None (single attempt) |
| Status transition | ✅ Parity | Always mark 2→1 after send |
| UPID filter | ✅ Parity | `@rhie/shared` |
| Error handling | ✅ Parity | Per-record catch, continue |
| Shadow mode | ➕ Node extension | Safe rollout; PHP N/A |
| SSL verify disabled | ⚠️ Intentional diff | Node uses platform TLS defaults |
| Batch lock/rotation | ✅ Delegated | Worker framework (unchanged) |

**Overall:** Production behavior matches PHP for VISIT_ENCOUNTER upload scope.

---

## File Mapping

| PHP | TypeScript | Parity |
|-----|------------|--------|
| `upload_visit_encounters_batch.php` | `VisitEncounterWorker.processBatch()` | ✅ |
| `UploadVisitEncounterController` | `VisitEncounterProcessor` | ✅ |
| `UploadEncounterModel::getVisitEncounterData` | `VisitEncounterRepository.getVisitEncounterData` | ✅ |
| `UploadEncounterModel::markVisitUploaded` | `VisitEncounterRepository.markVisitUploaded` | ✅ |
| `GetEncounterModel::getVisitEncounterData` | `SQL_GET_VISIT_ENCOUNTER_DATA` | ✅ |
| `buildFHIRPayload()` | `VisitPayloadBuilder.build()` | ✅ |
| `sendToHIE()` | `uploadVisitEncounterOnce()` | ✅ |
| `rhieSanitizeUpid` / `rhieUpidIsExcluded` | `@rhie/shared` | ✅ |

---

## SQL Parity

Verified by `services/visit-encounter/src/repository/sql.parity.test.ts`.

### Batch selection

| Check | PHP | Node | Match |
|-------|-----|------|-------|
| Tables | encounter_main, upid_patients, patients | Same | ✅ |
| type filter | `VISIT_ENCOUNTER` | Same | ✅ |
| rhie_status | `em.rhie_status = 2 AND up.status = 2` | Same | ✅ |
| UPID exclude | `NOT LIKE 'UP%'` | Same | ✅ |
| document_number | `(IS NOT NULL OR NOT LIKE 'TP-%')` | Same (verbatim) | ✅ |
| age validation | NOT NULL + REGEXP | Same | ✅ |
| ORDER BY | `date ASC` | Same | ✅ |
| LIMIT | `rhieBatchRecordLimit()` | Worker `batchSize` | ✅ Equivalent |

### Payload fetch

| Check | PHP | Node | Match |
|-------|-----|------|-------|
| Joins | clientts, patients, users, address | Same | ✅ |
| Filters | rhie_status=2, deleted=0, type, date, client_id | Same | ✅ |
| Hardcoded practitioner | MS-PRAC-0025-001 | Same | ✅ |

### Mark uploaded

| Check | PHP | Node | Match |
|-------|-----|------|-------|
| Table | encounter_main | Same | ✅ |
| SET | rhie_status=1, rhie_uploaded_at=NOW() | Same | ✅ |
| WHERE | encount_id = ? | Same | ✅ |

---

## FHIR Payload Parity

Verified by `services/visit-encounter/src/domain/visit-payload.builder.test.ts`.

| Field | PHP | Node | Match |
|-------|-----|------|-------|
| resourceType | Encounter | Encounter | ✅ |
| id | resource_encount_id | resource_encount_id | ✅ |
| meta.tag | openmrs encounter-tag | Same | ✅ |
| status | finished | finished | ✅ |
| class | AMB / Ambulatory | Same | ✅ |
| type.display | VISIT_ENCOUNTER | Same | ✅ |
| serviceType.display | Outpatients | Same | ✅ |
| subject.reference | Patient/{upid} | Same | ✅ |
| subject.identifier | UPID coding | Same | ✅ |
| participant | Practitioner/MS-PRAC-0025-001 | Same | ✅ |
| period.start | date('c', strtotime(order_time)) | phpDateC(+02:00) | ✅ |
| location.reference | Location/{fosaid} | Same | ✅ |
| location.display | {hc} HC | Same | ✅ |

---

## RHIE API Parity

| Property | PHP | Node | Match |
|----------|-----|------|-------|
| Method | POST | POST | ✅ |
| Path | `/shr/Encounter` | `rhie.visitEncounterPath` → `/shr/Encounter` | ✅ |
| Content-Type | application/fhir+json | Same | ✅ |
| Accept | application/fhir+json | Same | ✅ |
| Auth | Basic (USERPWD) | Basic (Axios auth) | ✅ |
| Retry | None | None (`uploadVisitEncounterOnce`) | ✅ |
| Success | 200, 201 | 200, 201 | ✅ |
| Response shape | endpoint, kind, encounter_id, upid, http_code, response | Same fields | ✅ |

---

## Database Update Parity

| Behavior | PHP | Node (production) | Match |
|----------|-----|-------------------|-------|
| Trigger | After every sendToHIE call | After every uploadVisitEncounterOnce | ✅ |
| Gated on HTTP success | **No** | **No** | ✅ |
| rhie_status | 2 → 1 | 2 → 1 | ✅ |
| rhie_uploaded_at | NOW() | NOW() | ✅ |

---

## Error Handling Parity

| Scenario | PHP | Node | Match |
|----------|-----|-------------------|-------|
| Per-row exception | catch, log, continue | catch, log, failed++, continue | ✅ |
| UPID excluded | continue (skip) | continue (skip) | ✅ |
| Empty visit data | return [] | return [], count skipped | ✅ |
| HTTP failure | mark uploaded anyway | mark uploaded anyway (production) | ✅ |
| Unsupported type | throw Exception | throw Error | ✅ |
| Retry on failure | No | No | ✅ |

---

## Business Rules Parity

| Rule | PHP | Node | Match |
|------|-----|------|-------|
| VISIT_ENCOUNTER only in batch | Yes | Yes (worker scope) | ✅ |
| UPID sanitize before upload | Yes | Yes | ✅ |
| Skip UP% UPIDs | Yes | Yes | ✅ |
| Require upid_patients.status=2 | Batch SQL | Batch SQL | ✅ |
| Require age YYYY-MM-DD | Batch SQL | Batch SQL | ✅ |
| Practitioner hardcoded | MS-PRAC-0025-001 | Same | ✅ |

---

## Known Intentional Differences

| Item | PHP | Node | Rationale |
|------|-----|------|-----------|
| Shadow mode | N/A | `visitEncounter.executionMode: shadow` | Safe rollout; skips upload + DB update |
| SSL verify | Disabled | Platform default (enabled) | Security; configure if HIE cert issues |
| Logging | echo / stdout | Structured JSON logs | Platform standard |
| Batch lock | PHP file lock | Worker framework | Platform architecture (unchanged) |
| facilityId in getVisitEncounterData | Accepted, unused | Not passed to SQL | Same effective behavior |

---

## Out of Scope (Not in Visit Encounter Worker)

These exist in PHP `UploadVisitEncounterController` but are handled by other batches/services:

| Type | PHP Batch | Node Service |
|------|-----------|--------------|
| E_TRANSFER | upload_visit_ref_encounters_batch.php | `visit-encounter` (same worker, second pass) |
| CONSULTATION_ENCOUNTER | upload_consult_encounters_batch.php | Not implemented |
| Observations | UploadEncounterController | observation (stub) |

---

## Test Coverage

| Test file | Coverage |
|-----------|----------|
| `sql.parity.test.ts` | All 3 SQL statements vs PHP |
| `visit-payload.builder.test.ts` | Full FHIR payload + date formatting |
| `visit-encounter.processor.test.ts` | UPID skip, shadow mode, unsupported type, batch counting |
| `visit-encounter.processor.production.test.ts` | Unconditional mark-after-send, visit-before-transfer order |
| `visit-encounter.rhie.test.ts` | Endpoint selection `/shr/Encounter` vs `/transfer` |

**Result:** 25/25 tests passing (VISIT_ENCOUNTER + E_TRANSFER).

---

## Config Parity

| PHP | TypeScript |
|-----|------------|
| `$hie_url`, `$hie_username`, `$hie_password` | `rhie.baseUrl`, `rhie.auth` |
| Hardcoded batch (no shadow) | `visitEncounter.executionMode` |
| `/shr/Encounter` | `rhie.visitEncounterPath: /shr/Encounter` |

---

## Cutover Checklist

1. ✅ Implement service in `services/visit-encounter/`
2. ✅ Register worker factory (already in `services/registry`)
3. Run shadow mode: compare logged payloads to PHP echo output
4. Set `visitEncounter.executionMode: production`
5. Disable PHP cron for `upload_visit_encounters_batch.php`
6. Monitor `visit-encounter-host` metrics (port 9093)

### Rollback

1. Set `executionMode: shadow` or stop TS worker
2. Re-enable PHP batch
3. Records with `rhie_status = 2` will be picked up by PHP

---

## Verdict

The TypeScript Visit Encounter Upload service achieves **full behavioral parity** with the PHP reference for the VISIT_ENCOUNTER batch scope. All SQL, payload fields, API contract, status transitions, and error-handling semantics are preserved. Shadow mode is the only additive capability for safe deployment.
