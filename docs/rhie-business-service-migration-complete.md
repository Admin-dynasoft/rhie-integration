# RHIE Business Service Migration — Complete

**Migration completed:** 2026-06-29  
**Status:** All business services migrated with verified PHP parity

---

## Services Completed

| # | Service | Package / Worker | FHIR Resource(s) | RHIE Endpoint(s) |
|---|---------|------------------|------------------|------------------|
| 1 | Client Registry | `@rhie/service-client-registry` | Patient | `/clientregistry/Patient` |
| 2 | Encounter ID | `@rhie/service-encounter-id` | (ID generation) | `/encounters/id` |
| 3 | Visit Encounter Upload | `@rhie/service-visit-encounter` | Encounter | `/shr/Encounter` |
| 4 | E_TRANSFER Upload | (within visit-encounter) | Encounter | `/shr/Encounter/transfer` |
| 5 | Complaint Encounter Upload | `@rhie/service-observation` | Observation | `/shr/Observation` |
| 6 | Diagnosis Encounter Upload | `@rhie/service-observation` | Condition | `/shr/Condition` |
| 7 | Medication Encounter Upload | `@rhie/service-observation` | MedicationRequest | `/shr/MedicationRequest` |
| 8 | Laboratory Encounter Upload | `@rhie/service-observation` | Observation + ServiceRequest | `/shr/Observation`, `/shr/ServiceRequest` |

---

## Observation Worker Execution Order

Matches PHP `uploadObservations()` merge order for implemented types:

```
1. Complaint Encounter Upload
2. Laboratory — Lab Results (Observation)
3. Diagnosis Encounter Upload
4. Laboratory — Lab Requests (ServiceRequest)
5. Medication Encounter Upload
```

Worker type: `observation` (PM2: observation-host, port 9095)

---

## PHP Files Analyzed (Laboratory)

| File | Role |
|------|------|
| `GetEncounterModel::getLaboEncounterData()` | Lab result payload SQL |
| `GetEncounterModel::getLabRequestEncounterData()` | Lab request payload SQL |
| `UploadEncounterModel::getLaboEncounterData()` / `getLabRequestEncounterData()` | Fetch wrappers |
| `buildLabObservation()` / `buildLabRequestObservation()` | FHIR builders |
| `uploadObservations()` | Upload loop and mark logic |
| `get_labo_encounter_api.php` / `get_lab_request_encounter_api.php` | HTTP APIs |

---

## Laboratory Components Implemented

| Component | Path |
|-----------|------|
| Processor | `services/observation/src/domain/laboratory-encounter.processor.ts` |
| Payload builder | `services/observation/src/domain/laboratory-payload.builder.ts` |
| Repository | `services/observation/src/repository/laboratory-encounter.repository.ts` |
| SQL | `SQL_GET_LAB_RESULT_ENCOUNTER_DATA`, `SQL_GET_LAB_REQUEST_ENCOUNTER_DATA`, batch queries |
| Worker | Split lab results / lab requests phases in `observation.worker.ts` |

---

## Parity Summary

| Area | Status |
|------|--------|
| SQL | ✅ Exact match (both lab types) |
| Lab result Observation payload | ✅ Including null value + result in unit |
| Lab request ServiceRequest payload | ✅ Including SNOMED category |
| RHIE endpoints | ✅ Observation + ServiceRequest |
| Status updates | ✅ Success-only markObservationUploaded |
| Retry | ✅ None |
| UPID filtering | ✅ @rhie/shared |
| Shadow mode | ✅ Default (`observation.executionMode: shadow`) |

---

## Dead-Code Findings (All Services)

Consistent pattern in PHP traches controller — display typos never match SQL:

| PHP check | SQL display |
|-----------|-------------|
| `Chief Complaintt` | `Chief Complaint` |
| `Diagnosticc` | `Diagnostic` |
| `Laboratoryy` | `Laboratory` |
| `Lab Requestt` | `Lab Request` |
| `Medication_Requestt` | `Medication_Request` |
| `Vital Signn` | `Vital Sign` |

Node implementations match SQL output (intended behavior).

---

## Documentation Created

### Per-service docs (observation family)
- Complaint, Diagnosis, Medication, Laboratory — each with business-rules, payload-mapping, rhie-api-analysis, parity-report

### Migration completion
- `docs/rhie-business-service-migration-complete.md` (this file)

---

## Test Results

| Metric | Value |
|--------|-------|
| Total unit tests | **66** |
| Passing | **66** |
| Failing | **0** |
| Test suites | 20 |

Run: `cd services/observation && npm test`

---

## Shadow Mode Status

All observation uploads default to **shadow mode** in `platform.yaml`:

```yaml
observation:
  executionMode: shadow
```

Shadow mode: builds payloads, logs at info, no HTTP, no DB updates.

---

## Production Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Business logic parity | ✅ Complete | All 8 services |
| Unit test coverage | ✅ Strong | 66 tests, SQL + payload + processor + RHIE |
| Shadow validation | ⏳ Pending ops | Requires facility shadow run + payload comparison |
| Production cutover | ⏳ Pending ops | Set `executionMode: production` per service |
| PHP batch decommission | ⏳ Stabilization phase | Do not disable PHP until shadow validated |
| Platform infrastructure | ✅ Stable | Unchanged during migration |

**Business-service migration is complete.** The project is ready to enter the **dedicated stabilization phase**, which will address:

- Build and deployment validation
- Shadow-mode payload verification against live PHP output
- Production cutover sequencing
- Phased replacement of PHP batch scripts
- Logging and monitoring improvements
- End-to-end integration testing

Do **not** begin stabilization work until explicitly scheduled — this document marks the handoff point only.
