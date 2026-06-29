# Medication Encounter Upload — PHP-to-Node Parity Report

**Audit date:** 2026-06-29  
**Worker type:** `observation` (observation-host, port 9095)

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Payload fetch SQL | ✅ Parity | Exact match with GetEncounterModel::getMedicationEncounterData |
| Mark uploaded SQL | ✅ Parity | markObservationUploaded (shared) |
| FHIR MedicationRequest payload | ✅ Parity | buildMedicationRequestObservation including PHP quirks |
| HIE endpoint | ✅ Parity | POST `/shr/MedicationRequest` |
| Inject exclusion | ✅ Parity | `NOT LIKE '%inject%'` |
| Success-only mark | ✅ Parity | Same as complaint/diagnosis |
| Display match | ✅ Parity | `'Medication_Request'` — PHP typo `Medication_Requestt` is dead code |
| Batch selection SQL | ➕ Node-derived | No dedicated PHP medication batch |
| Shadow mode | ➕ Node extension | Safe rollout |

**Overall:** Full parity with intended PHP behavior for non-injection MedicationRequest upload.

---

## Architecture Mapping

| Layer | PHP | Node |
|-------|-----|------|
| Batch | uploadObservations (traches) | `MedicationEncounterProcessor.processPendingMedicationEncounters()` |
| Repository | UploadEncounterModel + GetEncounterModel | `MedicationEncounterRepository` |
| Payload | buildMedicationRequestObservation() | `MedicationPayloadBuilder` |
| RHIE Client | send('MedicationRequest', 'observ', ...) | `uploadShrResourceOnce('MedicationRequest', ...)` |

---

## SQL Parity

Verified by `services/observation/src/repository/sql.parity.test.ts`.

| Query | PHP Source | Match |
|-------|------------|-------|
| `SQL_GET_MEDICATION_ENCOUNTER_DATA` | getMedicationEncounterData | ✅ Exact |
| `SQL_MARK_OBSERVATION_UPLOADED` | markObservationUploaded | ✅ Exact |
| `SQL_FIND_PENDING_MEDICATION_ENCOUNTERS` | Node-derived | ➕ New |

---

## Payload Parity

| Aspect | Match | Notes |
|--------|-------|-------|
| Resource type | ✅ | MedicationRequest |
| SNOMED coding | ✅ | code from pr.code |
| Hardcoded groupIdentifier/insurance | ✅ | Preserved |
| dosageInstruction structure | ✅ | frequency from duration, value from quantity |
| Duplicate extension key | ✅ | Final extension uses System fallback |
| Numeric "0" contactpoint key | ✅ | PHP malformed array preserved |
| authoredOn UTC conversion | ✅ | phpEffectiveDateTimeUtc |

---

## Legacy PHP Bug — `Medication_Requestt`

PHP traches controller: `$o['display'] === 'Medication_Requestt'`  
SQL produces: `'Medication_Request'`

Node matches SQL output. Dead code — same pattern as `Chief Complaintt`, `Diagnosticc`.

---

## Out of Scope

| PHP component | Reason |
|---------------|--------|
| getMedicationAdminEncounterData | Injection meds — separate display `Medication_Admit` |
| buildMedicationAdministration | Different FHIR resource |
| markMedicationUploaded on orders | Not used by observation upload loop |

---

## Test Coverage

| File | Scope |
|------|-------|
| medication-payload.builder.test.ts | FHIR mapping, PHP quirks, display constant |
| medication-encounter.processor.test.ts | UPID, shadow, display filter, batch |
| medication-encounter.processor.production.test.ts | Success-only mark |
| medication-encounter.rhie.test.ts | Endpoint + HTTP status |
| sql.parity.test.ts | SQL exact match |

**Total:** 48/48 tests passing (complaint + diagnosis + medication).

---

## Verdict

Medication Encounter Upload achieves **full behavioral parity** with PHP for non-injection MedicationRequest uploads.
