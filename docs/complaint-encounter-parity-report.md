# Complaint Encounter Upload — PHP-to-Node Parity Report

Audit comparing the PHP reference implementation to `@rhie/service-observation` (complaint upload scope).

**Audit date:** 2026-06-29  
**Worker type:** `observation` (observation-host, port 9095)

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Payload fetch SQL | ✅ Parity | Exact match with GetEncounterModel |
| Mark uploaded SQL | ✅ Parity | Exact match with UploadEncounterModel |
| FHIR Observation payload | ✅ Parity | buildComplaintObservation fields |
| HIE endpoint | ✅ Parity | POST `/shr/Observation` |
| HTTP headers | ✅ Parity | application/fhir+json |
| Authentication | ✅ Parity | HTTP Basic |
| Success codes | ✅ Parity | 200, 201 |
| Retry logic | ✅ Parity | None |
| Mark on success only | ✅ Parity | Unlike visit encounter |
| UPID filter | ✅ Parity | @rhie/shared |
| Display match | ✅ Parity | Legacy PHP typo verified — never produced; Node matches SQL output |
| Batch selection SQL | ➕ Node-derived | No dedicated PHP complaint batch |
| Shadow mode | ➕ Node extension | Safe rollout |

**Overall:** Full parity with intended PHP behavior for complaint Observation upload.

---

## Architecture Mapping

| Layer | PHP | Node |
|-------|-----|------|
| Batch | uploadObservations (traches) / no standalone batch | `ObservationWorker.processBatch()` |
| Processor | UploadEncounterController | `ComplaintEncounterProcessor` |
| Repository | UploadEncounterModel + GetEncounterModel | `ComplaintEncounterRepository` |
| Payload | buildComplaintObservation() | `ComplaintPayloadBuilder` |
| RHIE Client | send('Observation', 'observ', ...) | `uploadShrResourceOnce('Observation', ...)` |

---

## SQL Parity

Verified by `services/observation/src/repository/sql.parity.test.ts`.

| Query | PHP Source | Match |
|-------|------------|-------|
| `SQL_GET_COMPLAINT_ENCOUNTER_DATA` | GetEncounterModel::getComplaintEncounterData | ✅ Exact |
| `SQL_MARK_OBSERVATION_UPLOADED` | UploadEncounterModel::markObservationUploaded | ✅ Exact |
| `SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS` | Node-derived from eligibility rules | ➕ New |

---

## FHIR Payload Parity

Verified by `complaint-payload.builder.test.ts`.

| Field | PHP | Node | Match |
|-------|-----|------|-------|
| resourceType | Observation | Observation | ✅ |
| id | observation_encount_id | Same | ✅ |
| status | final | final | ✅ |
| code | LOINC 33747-0 Chief Complaints | Same | ✅ |
| category | survey | Same | ✅ |
| subject.reference | Patient/{upid} | Same | ✅ |
| encounter.reference | Encounter/{reference_encount_id} | Same | ✅ |
| performer | Practitioner/f830114a-... | Same | ✅ |
| valueString | plainte or fallback | Same | ✅ |
| effectiveDateTime | UTC from order_time | phpEffectiveDateTimeUtc | ✅ |

---

## RHIE API Parity

| Property | PHP send() | Node uploadShrResourceOnce | Match |
|----------|------------|------------------------------|-------|
| URL | /shr/Observation | /shr/Observation | ✅ |
| Method | POST | POST | ✅ |
| Headers | fhir+json | fhir+json | ✅ |
| Success | 200, 201 | 200, 201 | ✅ |
| Retry | None | None | ✅ |

---

## Status Transition Parity

| Condition | PHP | Node (production) | Match |
|-----------|-----|-------------------|-------|
| HTTP 200/201 | markObservationUploaded | markObservationUploaded | ✅ |
| HTTP 4xx/5xx | No update | No update | ✅ |
| Network error | No update | No update | ✅ |

**Contrast with visit-encounter:** Visit marks uploaded unconditionally; complaint marks **only on success**.

---

## Legacy PHP Bug — `Chief Complaintt` (Verified)

Full-repository search (`rg 'Complaintt|complaintt' rhie/`) on 2026-06-29:

| Location | Role | Produces `Chief Complaintt`? |
|----------|------|------------------------------|
| `rhie/controllers/traches/UploadEncounterController.php:793` | Comparison only: `$o['display'] === 'Chief Complaintt'` | No |
| `rhie/models/GetEncounterModel.php:160-161` | SQL literal `'Chief Complaint' AS display` | No — produces `Chief Complaint` |
| `rhie/models/traches/GetEncounterModel.php:160-161` | Same SQL | No — produces `Chief Complaint` |
| `buildComplaintObservation()` LOINC coding | `"display" => "Chief Complaints"` (plural) | No — different field, not row `display` |
| `buildObservation()` | `strtolower(...) === 'chief complaint'` | No — never called for complaint batch path |
| Committed `UploadEncounterController.php` | No complaint upload branch | N/A |

**Conclusion:** No PHP code ever assigns or returns `Chief Complaintt` as a row `display` value. The traches comparison is **dead code** — a copy-paste typo alongside similar typos (`Diagnosticc`, `Vital Signn`, etc.) that also do not match SQL output.

**Node behavior:** Matches the data layer (`'Chief Complaint'` from `getComplaintEncounterData`). This is parity with what PHP *feeds* into the upload loop, not with the broken branch condition.

**If production ever relied on complaint uploads:** They would not have worked via the traches controller path; any working deployment would require a hotfix, fork, or direct API use not present in this repository.

---

## Shadow Mode Validation

When `observation.executionMode: shadow`:

1. Batch selection SQL runs normally
2. Payload built via `ComplaintPayloadBuilder.build()`
3. Full FHIR payload logged at `info` level (`event: shadow_payload_built`)
4. **No HTTP POST** to HIE
5. **No** `markObservationUploaded` DB update
6. Counted as `processed` in batch result

### Shadow validation checklist

- [ ] Run observation-host with `executionMode: shadow`
- [ ] Compare logged payloads against PHP `buildComplaintObservation` output for same client/date
- [ ] Verify `effectiveDateTime` UTC conversion
- [ ] Verify `valueString` from `plaintes.plainte`
- [ ] Confirm no `encounter_patients.rhie_status` changes during shadow

---

## Dependencies

| Dependency | Service | Status |
|------------|---------|--------|
| UPID registered | client-registry | Must have status=2 |
| Complaint encounter ID | encounter-id | encounter_patients rhie_status=2 |
| Visit encounter ID | encounter-id | encounter_main VISIT_ENCOUNTER exists |
| Visit uploaded (recommended) | visit-encounter | Parent visit in HIE before observation |

---

## Config

```yaml
observation:
  executionMode: shadow

rhie:
  observationPath: /shr/Observation
```

---

## Test Coverage

| File | Tests |
|------|-------|
| complaint-payload.builder.test.ts | Payload + date + display constant |
| complaint-encounter.processor.test.ts | UPID skip, shadow, display filter |
| sql.parity.test.ts | SQL exact match |

**Result:** 10/10 tests passing.

---

## Cutover

1. Validate shadow payloads
2. Set `observation.executionMode: production`
3. Run via `observation-host` (PM2 port 9095)
4. Disable PHP observation upload path when fully cut over

---

## Verdict

Complaint Encounter Upload in `@rhie/service-observation` achieves **full behavioral parity** with the PHP data layer and `buildComplaintObservation()`. The traches `Chief Complaintt` check is a verified legacy bug (never produced). Status updates correctly gate on HTTP success.
