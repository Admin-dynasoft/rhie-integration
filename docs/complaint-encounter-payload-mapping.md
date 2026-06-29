# Complaint Encounter Upload — Payload Mapping

Field-by-field mapping from Medisoft DB rows to FHIR Observation payload.

**Source:** `UploadEncounterController::buildComplaintObservation()` (traches)

---

## Input Row (`GetEncounterModel::getComplaintEncounterData`)

| DB Column / Alias | Type | Used in Payload |
|-------------------|------|-----------------|
| `reference_encount_id` | string (UUID) | `encounter.reference` |
| `upid` | string | `subject.reference` |
| `client_id` | int | Not in payload (query filter) |
| `main_date` | date | Not in payload (query filter) |
| `observation_encount_id` | string (UUID) | `id` |
| `source_id` | int | Not in payload (vital_sign FK) |
| `main_display` | literal `'Consultation Encounter'` | Not in payload |
| `display` | literal `'Chief Complaint'` | Upload branch filter only |
| `div_display` | literal `'Chief Complaint'` | Not in payload |
| `full_description` | string (`plaintes.plainte`) | `valueString` |
| `order_time` | datetime (`vital_sign.created_at`) | `effectiveDateTime` |
| `practitioner_name` | string (`users.fullname`) | `performer[0].display` |
| `code` | literal `'Complaint-001'` | Not in payload |

---

## FHIR Observation Output

```json
{
  "resourceType": "Observation",
  "id": "<observation_encount_id>",
  "status": "final",
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "33747-0",
      "display": "Chief Complaints"
    }]
  },
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "survey",
      "display": "survey"
    }]
  }],
  "subject": {
    "reference": "Patient/<upid>"
  },
  "encounter": {
    "reference": "Encounter/<reference_encount_id>"
  },
  "performer": [{
    "reference": "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
    "display": "<practitioner_name or 'System'>"
  }],
  "valueString": "<plainte or 'No complaint details'>",
  "effectiveDateTime": "<UTC ISO8601 from order_time>"
}
```

---

## Date Conversion

| PHP | Node |
|-----|------|
| `new DateTime($order_time)` → `setTimezone(UTC)` → `format('Y-m-d\TH:i:sP')` | `phpEffectiveDateTimeUtc(order_time)` |

`order_time` is stored in facility local time (Africa/Kigali, UTC+2). Example:

| Input (`vs.created_at`) | Output (`effectiveDateTime`) |
|-------------------------|------------------------------|
| `2026-06-24 14:30:00` | `2026-06-24T12:30:00+00:00` |

---

## Fallback Values

| Field | When null/empty | Fallback |
|-------|-----------------|----------|
| `valueString` | `full_description` null | `"No complaint details"` |
| `performer[0].display` | `practitioner_name` null | `"System"` |

---

## Fields Not in Payload

These SQL columns are fetched but not included in the FHIR resource:

- `client_id`, `main_date`, `source_id`
- `main_display`, `display`, `div_display`, `code`

---

## Node Implementation

| Component | File |
|-----------|------|
| Builder | `services/observation/src/domain/complaint-payload.builder.ts` |
| Types | `services/observation/src/domain/types.ts` |
| Tests | `services/observation/src/domain/complaint-payload.builder.test.ts` |
