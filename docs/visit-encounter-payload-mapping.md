# Visit Encounter Upload — Payload Mapping

Field-by-field mapping from Medisoft DB rows to FHIR Encounter payload.

**Source:** `UploadVisitEncounterController::buildFHIRPayload()`

---

## Input Row (`GetEncounterModel::getVisitEncounterData`)

| DB Column / Alias | Type | Used in Payload |
|-------------------|------|-----------------|
| `resource_encount_id` | string (UUID) | `id` |
| `upid` | string | `subject.reference`, `subject.identifier.value` |
| `client_id` | int | Not in payload |
| `visit_date` | date | Not in payload (filtered by query) |
| `patient_name` | string | `subject.display` |
| `type_display` | literal `'VISIT_ENCOUNTER'` | `type.coding.display` |
| `display` | literal `'Visit'` | Not in payload |
| `div_display` | literal `'Visit Encounter'` | Not in payload |
| `order_time` | datetime | `period.start` (via `date('c', strtotime())`) |
| `practitioner_name` | string | `participant.individual.display` |
| `practitioner_id` | literal `'MS-PRAC-0025-001'` | `participant.individual.reference`, `identifier.value` |
| `facility_name` | string (address.hc) | `location.location.identifier.value`, display suffix |
| `location_id` | string (address.fosaid) | `location.location.reference` |

---

## FHIR Encounter Output

```json
{
  "resourceType": "Encounter",
  "id": "<resource_encount_id>",
  "meta": {
    "tag": [{
      "system": "http://fhir.openmrs.org/ext/encounter-tag",
      "code": "encounter",
      "display": "Encounter"
    }]
  },
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "Ambulatory"
  },
  "type": [{ "coding": [{ "display": "VISIT_ENCOUNTER" }] }],
  "serviceType": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/service-type",
      "display": "Outpatients"
    }]
  },
  "subject": {
    "reference": "Patient/<upid>",
    "type": "Patient",
    "identifier": {
      "type": { "coding": [{ "code": "UPID", "display": "UPID" }] },
      "value": "<upid>"
    },
    "display": "<patient_name>"
  },
  "participant": [{
    "individual": {
      "reference": "Practitioner/MS-PRAC-0025-001",
      "type": "Practitioner",
      "identifier": { "value": "MS-PRAC-0025-001" },
      "display": "<practitioner_name>"
    }
  }],
  "period": { "start": "<ISO8601 from order_time>" },
  "location": [{
    "location": {
      "reference": "Location/<location_id>",
      "type": "Location",
      "identifier": { "value": "<facility_name>" },
      "display": "<facility_name> HC"
    }
  }]
}
```

---

## Date Formatting

PHP: `date('c', strtotime($visit['order_time']))`

Node: `phpDateC(order_time)` — formats as `{date}T{time}+02:00` (Africa/Kigali, no DST).

Example: `2026-06-24 14:30:00` → `2026-06-24T14:30:00+02:00`

---

## Hardcoded Values (Preserved)

| Field | Value |
|-------|-------|
| Practitioner ID | `MS-PRAC-0025-001` |
| Encounter class | `AMB` / Ambulatory |
| Service type display | Outpatients |
| Meta tag system | `http://fhir.openmrs.org/ext/encounter-tag` |
