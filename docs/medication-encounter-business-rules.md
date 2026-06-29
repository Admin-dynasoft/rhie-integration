# Medication Encounter Upload — Business Rules

Every business rule extracted from the PHP Medication Encounter Upload implementation.

**PHP sources:** `GetEncounterModel::getMedicationEncounterData`, `UploadEncounterModel::getMedicationData`, `UploadEncounterController::buildMedicationRequestObservation()`, `uploadObservations()` (traches), `upid_filter.php`

**Scope:** Non-injection oral medication requests (`Medication_Request` display). Injection medications (`Medication_Admit`, `pr.full_desc LIKE '%inject%'`) are a separate PHP data path and are **out of scope** for this migration slice.

---

## Eligibility — Batch Selection

A medication encounter is selected for upload when **all** of the following are true:

| # | Rule | Source |
|---|------|--------|
| 1 | `encounter_patients.type = 'MEDICINE_ENCOUNTER'` | Batch SQL |
| 2 | `encounter_patients.rhie_status = 2` | Batch SQL + payload SQL |
| 3 | Parent `encounter_main.type = 'VISIT_ENCOUNTER'` | Batch SQL |
| 4 | `orders.type = 'med'` and `orders.deleted = 0` | Batch SQL |
| 5 | `products.full_desc NOT LIKE '%inject%'` | Batch SQL + payload SQL |
| 6 | `upid_patients.status = 2` | Batch SQL |
| 7 | `upid_patients.upid NOT LIKE 'UP%'` | Batch SQL + controller filter |
| 8 | Document number / age eligibility rules | Batch SQL (same as complaint) |
| 9 | `encounter_main.upid NOT LIKE 'UP%'` | Batch SQL + payload SQL |
| 10 | Ordered by `ep.date ASC`, limited by batch size | Batch SQL |

---

## Eligibility — Payload Fetch

When building the upload payload for a specific `(client_id, date)`:

| # | Rule | Source |
|---|------|--------|
| 1 | `encounter_patients.type = 'MEDICINE_ENCOUNTER'` | GetEncounterModel |
| 2 | `encounter_patients.rhie_status = 2` | GetEncounterModel |
| 3 | `orders` joined via `ep.source_id = o.order_id` | GetEncounterModel |
| 4 | `posologies` and `products` joined for description | GetEncounterModel |
| 5 | `pr.full_desc NOT LIKE '%inject%'` | GetEncounterModel |
| 6 | UPID re-sanitized and excluded if starts with `UP` | Controller |

---

## Display Matching

| Rule | PHP (traches) | Node | Notes |
|------|---------------|------|-------|
| Row `display` from SQL | `'Medication_Request'` | Same | GetEncounterModel literal |
| Upload branch condition | `$o['display'] === 'Medication_Requestt'` | `display === 'Medication_Request'` | PHP typo is dead code |
| `Medication_Admit` rows | Merged into loop but no matching branch | Skipped via display filter | Injection path — out of scope |

---

## UPID Rules

| Rule | Function | Behavior |
|------|----------|----------|
| Sanitize | `rhieSanitizeUpid()` | Trim, remove whitespace/non-printable chars |
| Exclude | `rhieUpidIsExcluded()` | Skip if UPID starts with `UP` |

---

## FHIR Payload Rules

| Field | Rule |
|-------|------|
| `resourceType` | `"MedicationRequest"` |
| `id` | `observation_encount_id` |
| `status` | `"active"` |
| `intent` | `"order"` |
| `medicationCodeableConcept.coding` | SNOMED system, `pr.code` or `'unknown'`, display = `full_description` |
| `subject.reference` | `"Patient/{upid}"` |
| `encounter.reference` | `"Encounter/{reference_encount_id}"` |
| `authoredOn` | UTC from `o.time` |
| `requester` | Hardcoded Practitioner UUID + practitioner name |
| `groupIdentifier` | Hardcoded `PR-2025-11-20-001` |
| `insurance` | Hardcoded Mituelle coverage reference |
| `dosageInstruction` | Hardcoded text/route/method; frequency from `duration`; quantity from `o.quantity` |
| `extension` | Duplicate PHP key — final value uses `practitioner_name ?? 'System'` |
| Numeric key `"0"` | Orphaned contactpoint extension from PHP malformed array literal |

---

## Upload Rules

| # | Rule |
|---|------|
| 1 | POST to `/shr/MedicationRequest` |
| 2 | Content-Type and Accept: `application/fhir+json` |
| 3 | HTTP Basic authentication |
| 4 | Single attempt — no retry |
| 5 | Success = HTTP 200 or 201 |
| 6 | **Mark uploaded only on success** |

---

## Status Transitions

```
encounter_patients.rhie_status: 2 (ready) → 1 (uploaded)
encounter_patients.rhie_uploaded_at: set to NOW()
```

Triggered by: `markObservationUploaded($observation_encount_id)` on HTTP 200/201 only.

---

## Error Handling

| Scenario | PHP | Node |
|----------|-----|------|
| HTTP 4xx/5xx | Log; no mark | Same |
| UPID excluded | Skip silently | Same |
| Non-Medication_Request display | Skip (dead branch) | Skip via filter |
| Shadow mode | N/A | Build + log; no HTTP; no mark |

---

## Upstream Dependencies

| Dependency | Requirement |
|------------|-------------|
| Client registry | `upid_patients.status = 2` |
| Encounter ID generation | `encounter_patients` with `type = 'MEDICINE_ENCOUNTER'`, `rhie_status = 2` |
| Visit encounter | Parent VISIT_ENCOUNTER exists |
| Source data | `orders` (med) + `posologies` + `products` via `ep.source_id` |

---

## Out of Scope

- `getMedicationAdminEncounterData()` / `Medication_Admit` (injections)
- `buildMedicationAdministration()` / MedicationAdministration resource
- `markMedicationUploaded()` on `orders` table (different code path)
