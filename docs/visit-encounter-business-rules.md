# Visit Encounter Upload — Business Rules

Every business rule extracted from the PHP Visit Encounter Upload implementation.

---

## Eligibility — Batch Selection

A visit encounter is selected for upload when **all** of the following are true:

| # | Rule | Source |
|---|------|--------|
| 1 | `encounter_main.type = 'VISIT_ENCOUNTER'` | Batch SQL |
| 2 | `encounter_main.rhie_status = 2` (ready for upload) | Batch SQL |
| 3 | `upid_patients.status = 2` (UPID registered in HIE) | Batch SQL |
| 4 | `upid_patients.upid NOT LIKE 'UP%'` | Batch SQL + controller filter |
| 5 | `document_number IS NOT NULL OR document_number NOT LIKE 'TP-%'` | Batch SQL (preserved verbatim) |
| 6 | `patients.age IS NOT NULL` | Batch SQL |
| 7 | `patients.age` matches `YYYY-MM-DD` regex | Batch SQL |
| 8 | Ordered by `date ASC` | Batch SQL |
| 9 | Limited by batch record limit | Batch SQL |

---

## Eligibility — Payload Fetch

When building the upload payload for a specific `(client_id, date)`:

| # | Rule | Source |
|---|------|--------|
| 1 | `encounter_main.rhie_status = 2` | GetEncounterModel |
| 2 | `encounter_main.type = 'VISIT_ENCOUNTER'` | GetEncounterModel |
| 3 | Matching `clientts` row with `deleted = 0` | GetEncounterModel |
| 4 | `encounter_main.upid NOT LIKE 'UP%'` | GetEncounterModel |
| 5 | UPID re-sanitized and excluded if starts with `UP` | Controller |

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
| `resourceType` | Always `"Encounter"` |
| `id` | `resource_encount_id` from DB |
| `status` | `"finished"` |
| `class.code` | `"AMB"` (Ambulatory) |
| `type.coding.display` | `"VISIT_ENCOUNTER"` |
| `serviceType.coding.display` | `"Outpatients"` |
| `subject.reference` | `"Patient/{upid}"` |
| `subject.identifier` | UPID coding |
| `participant.individual.reference` | `"Practitioner/MS-PRAC-0025-001"` (hardcoded) |
| `period.start` | `date('c', strtotime(order_time))` |
| `location.location.reference` | `"Location/{fosaid}"` |
| `location.location.display` | `"{facility_name} HC"` |

---

## Upload Rules

| # | Rule |
|---|------|
| 1 | POST to `/shr/Encounter` (not `/shr/Encounter/visit`) |
| 2 | Content-Type and Accept: `application/fhir+json` |
| 3 | HTTP Basic authentication |
| 4 | Single attempt — no retry |
| 5 | Success = HTTP 200 or 201 |
| 6 | **Mark uploaded regardless of HTTP success** |

---

## Status Transitions

```
encounter_main.rhie_status: 2 (ready) → 1 (uploaded)
encounter_main.rhie_uploaded_at: set to NOW()
```

Triggered by: `markVisitUploaded($encount_id)` after every upload attempt.

---

## Error Handling Rules

| Scenario | PHP behavior | Node behavior |
|----------|--------------|---------------|
| Upload exception in batch | Log, continue next row | Log, increment failed, continue |
| Facility connection failure | Log, continue next facility | Worker framework handles |
| UPID excluded | Skip silently | Skip silently |
| No visit rows for client/date | Return `[]` | Return `[]`, count as skipped |
| HTTP 4xx/5xx | Log response, mark uploaded | Same (production mode) |
| Unsupported type | throw Exception | throw Error |

---

## Out of Scope (Other Batches)

These types are handled by `UploadVisitEncounterController` but **not** by `upload_visit_encounters_batch.php`:

- `E_TRANSFER` → `upload_visit_ref_encounters_batch.php`
- `CONSULTATION_ENCOUNTER` → `upload_consult_encounters_batch.php`
- Observations → `UploadEncounterController` (separate service)

The Node `visit-encounter` worker implements **VISIT_ENCOUNTER only**, matching the batch file in scope.
