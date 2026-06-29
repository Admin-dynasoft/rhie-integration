# Complaint Encounter Upload — Business Rules

Every business rule extracted from the PHP Complaint Encounter Upload implementation.

**PHP sources:** `GetEncounterModel::getComplaintEncounterData`, `UploadEncounterModel::markObservationUploaded`, `UploadEncounterController::buildComplaintObservation()` / `uploadObservations()` (traches), `upid_filter.php`

---

## Eligibility — Batch Selection

A complaint encounter is selected for upload when **all** of the following are true:

| # | Rule | Source |
|---|------|--------|
| 1 | `encounter_patients.type = 'complaint'` | Node batch SQL (derived) |
| 2 | `encounter_patients.rhie_status = 2` (ready for upload) | Batch SQL + payload SQL |
| 3 | Parent `encounter_main.type = 'VISIT_ENCOUNTER'` exists for same `(client_id, date)` | Batch SQL |
| 4 | `upid_patients.status = 2` (UPID registered in HIE) | Batch SQL |
| 5 | `upid_patients.upid NOT LIKE 'UP%'` | Batch SQL + controller filter |
| 6 | `document_number IS NOT NULL OR document_number NOT LIKE 'TP-%'` | Batch SQL (preserved verbatim) |
| 7 | `patients.age IS NOT NULL` | Batch SQL |
| 8 | `patients.age` matches `YYYY-MM-DD` regex | Batch SQL |
| 9 | `encounter_main.upid NOT LIKE 'UP%'` | Batch SQL + payload SQL |
| 10 | Ordered by `ep.date ASC` | Batch SQL |
| 11 | Limited by batch record limit | Batch SQL |

**Note:** PHP has no dedicated complaint upload batch. Node batch SQL combines complaint payload filters with visit-batch patient eligibility rules.

---

## Eligibility — Payload Fetch

When building the upload payload for a specific `(client_id, date)`:

| # | Rule | Source |
|---|------|--------|
| 1 | `encounter_patients.type = 'complaint'` | GetEncounterModel |
| 2 | `encounter_patients.rhie_status = 2` | GetEncounterModel |
| 3 | Parent `encounter_main.type = 'VISIT_ENCOUNTER'` | GetEncounterModel |
| 4 | `vital_sign` joined via `ep.source_id = vs.vital_sign_id` | GetEncounterModel |
| 5 | `plaintes.plainte` joined via `pl.id = vs.value` | GetEncounterModel |
| 6 | `encounter_main.upid NOT LIKE 'UP%'` | GetEncounterModel |
| 7 | UPID re-sanitized and excluded if starts with `UP` | Controller |

---

## Display Matching

| Rule | PHP (traches) | Node | Notes |
|------|---------------|------|-------|
| Row `display` from SQL | `'Chief Complaint'` | Same | GetEncounterModel literal |
| Upload branch condition | `$o['display'] === 'Chief Complaintt'` | `display === 'Chief Complaint'` | PHP typo is dead code — never matches SQL output |
| Non-matching display | Falls through to skip branch | `continue` | No upload, no mark |

---

## UPID Rules

| Rule | Function | Behavior |
|------|----------|----------|
| Sanitize | `rhieSanitizeUpid()` | Trim, remove whitespace/non-printable/zero-width chars |
| Exclude | `rhieUpidIsExcluded()` | Skip if UPID starts with `UP` (case-insensitive) |

---

## FHIR Payload Rules

| Field | Rule |
|-------|------|
| `resourceType` | Always `"Observation"` |
| `id` | `observation_encount_id` from DB |
| `status` | `"final"` |
| `code.coding` | LOINC `33747-0`, display `"Chief Complaints"` |
| `category.coding` | `"survey"` |
| `subject.reference` | `"Patient/{upid}"` |
| `encounter.reference` | `"Encounter/{reference_encount_id}"` (parent VISIT_ENCOUNTER) |
| `performer[0].reference` | `"Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653"` (hardcoded) |
| `performer[0].display` | `practitioner_name ?? 'System'` |
| `valueString` | `plainte` from `plaintes` table, fallback `"No complaint details"` |
| `effectiveDateTime` | `order_time` (`vs.created_at`) converted to UTC atom format |

---

## Upload Rules

| # | Rule |
|---|------|
| 1 | POST to `/shr/Observation` |
| 2 | Content-Type and Accept: `application/fhir+json` |
| 3 | HTTP Basic authentication |
| 4 | Single attempt — no retry |
| 5 | Success = HTTP 200 or 201 |
| 6 | **Mark uploaded only on success** (unlike visit encounter) |

---

## Status Transitions

```
encounter_patients.rhie_status: 2 (ready) → 1 (uploaded)
encounter_patients.rhie_uploaded_at: set to NOW()
```

Triggered by: `markObservationUploaded($observation_encount_id)` **only when HTTP 200/201**.

---

## Retry Behavior

| Scenario | PHP | Node |
|----------|-----|------|
| HTTP 4xx/5xx | No retry; no mark | Same |
| Network error | No retry; no mark | Same |
| Next batch cycle | Row remains `rhie_status=2` | Same |

---

## Error Handling Rules

| Scenario | PHP behavior | Node behavior |
|----------|--------------|---------------|
| Upload exception in batch | Log, continue next observation | Log, increment failed, continue |
| UPID excluded | Skip silently | Skip silently |
| No complaint rows for client/date | Empty loop | Return `{ uploaded: 0, attempted: 0 }` |
| HTTP 4xx/5xx | Log response, **no mark** | Same (production mode) |
| Non-Chief Complaint display | Skip (dead branch in PHP) | Skip via display filter |
| Shadow mode | N/A (PHP has no shadow) | Build payload, log, no HTTP, no mark |

---

## Upstream Dependencies

| Dependency | Requirement |
|------------|-------------|
| Client registry | `upid_patients.status = 2` |
| Encounter ID generation | `encounter_patients` row with `type = 'complaint'`, `rhie_status = 2` |
| Visit encounter ID | Parent `encounter_main` VISIT_ENCOUNTER exists |
| Source data | `vital_sign` (chief complaint vital) linked via `ep.source_id` |

---

## Out of Scope

These observation types share the traches `uploadObservations()` loop but are **separate migration tasks**:

- Diagnostic (`type = 'diagnostic'`)
- Vital Sign (`type = 'vital_sign'`)
- Lab Request / Laboratory
- Medication Request / Medication Admin
- Referral / E_TRANSFER

The Node `observation` worker currently implements **complaint upload only**.
