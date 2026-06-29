# Laboratory Encounter Upload — Business Rules

Every business rule extracted from the PHP Laboratory Encounter Upload implementation.

**PHP sources:** `GetEncounterModel::getLaboEncounterData`, `GetEncounterModel::getLabRequestEncounterData`, `UploadEncounterModel`, `UploadEncounterController::buildLabObservation()`, `buildLabRequestObservation()`, `uploadObservations()` (traches)

**Scope:** Two laboratory upload types:
1. **Lab results** (`ep.type = 'lab'`, display `'Laboratory'`) → FHIR Observation → `POST /shr/Observation`
2. **Lab requests** (`ep.type = 'lab_request'`, display `'Lab Request'`) → FHIR ServiceRequest → `POST /shr/ServiceRequest`

---

## Eligibility — Batch Selection

### Lab Results (`lab`)

| # | Rule |
|---|------|
| 1 | `encounter_patients.type = 'lab'` |
| 2 | `encounter_patients.rhie_status = 2` |
| 3 | Parent VISIT_ENCOUNTER exists |
| 4 | `lab_results` joined, `deleted = 0` |
| 5 | Standard UPID/age eligibility (same as complaint batch) |

### Lab Requests (`lab_request`)

| # | Rule |
|---|------|
| 1 | `encounter_patients.type = 'lab_request'` |
| 2 | `encounter_patients.rhie_status = 2` |
| 3 | `orders.deleted = 0` |
| 4 | Standard UPID/age eligibility |

---

## Payload Fetch SQL

Both queries include `ep.rhie_status = 2` and `em.upid NOT LIKE 'UP%'`.

### Lab Result Row Fields

| Field | Source |
|-------|--------|
| `full_description` | `acts.act` (exam name) |
| `result` | CASE on `pos_neg_result`: `'1'`→Positif, `'3'`→Negatif, else `comment` |
| `order_time` | `lab_results.time` |
| `practitioner_name` | `users.fullname` via `lab_tech` |

### Lab Request Row Fields

| Field | Source |
|-------|--------|
| `full_description` | `acts.act` (ordered test) |
| `order_time` | `orders.time` |
| `main_display` | `'Laboratory procedure'` |

---

## Display Matching

| SQL display | PHP branch check | Node filter |
|-------------|------------------|-------------|
| `'Laboratory'` | `'Laboratoryy'` (typo — dead code) | `'Laboratory'` |
| `'Lab Request'` | `'Lab Requestt'` (typo — dead code) | `'Lab Request'` |

---

## FHIR Payload Rules — Lab Result (Observation)

| Field | Rule |
|-------|------|
| `code` | LOINC `33747-0`, display = exam name |
| `category` | `laboratory`, display = row `display` |
| `valueQuantity.value` | Always `null` |
| `valueQuantity.unit` | `result` field (Positif/Negatif/comment) |
| `effectiveDateTime` | UTC from `lr.time` |

---

## FHIR Payload Rules — Lab Request (ServiceRequest)

| Field | Rule |
|-------|------|
| `category` | SNOMED `108252007`, display = `main_display` |
| `code` | LOINC `unknown`, display = act name |
| `occurrenceDateTime` | UTC from `o.time` |
| `locationReference` | `Location/1` |

---

## Upload Rules

| # | Rule |
|---|------|
| 1 | Lab results → `POST /shr/Observation` |
| 2 | Lab requests → `POST /shr/ServiceRequest` |
| 3 | Single attempt, no retry |
| 4 | Success = HTTP 200 or 201 |
| 5 | Mark uploaded only on success |

---

## PHP Upload Order (array_merge)

```
complaint → vital → lab results → diagnosis → lab requests → medication → ...
```

Node worker order among implemented services:

```
complaint → lab results → diagnosis → lab requests → medication
```

Vital signs, referral, and E_TRANSFER are not in observation worker scope.

---

## Status Transitions

```
encounter_patients.rhie_status: 2 → 1
encounter_patients.rhie_uploaded_at: NOW()
```

On HTTP 200/201 only via `markObservationUploaded()`.

---

## Out of Scope

- Vital sign uploads (`getVitalEncounterData`)
- Referral / E_TRANSFER in observation worker
- NCDs laboratory flows
