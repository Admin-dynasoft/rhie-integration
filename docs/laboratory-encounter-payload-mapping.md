# Laboratory Encounter Upload — Payload Mapping

Field-by-field mapping for both laboratory FHIR resources.

---

## Lab Result — Input Row (`getLaboEncounterData`)

| Alias | Payload field |
|-------|---------------|
| `observation_encount_id` | `id` |
| `upid` | `subject.reference` |
| `reference_encount_id` | `encounter.reference` |
| `full_description` | `code.coding[0].display` |
| `display` | `category[0].coding[0].display` |
| `result` | `valueQuantity.unit` |
| `order_time` | `effectiveDateTime` |
| `practitioner_name` | `performer[0].display` |

## Lab Result — FHIR Observation Output

```json
{
  "resourceType": "Observation",
  "id": "<observation_encount_id>",
  "status": "final",
  "code": { "coding": [{ "system": "http://loinc.org", "code": "33747-0", "display": "<act>" }] },
  "category": [{ "coding": [{ "code": "laboratory", "display": "Laboratory" }] }],
  "valueQuantity": { "value": null, "unit": "<Positif|Negatif|comment>", "system": "http://unitsofmeasure.org" },
  "effectiveDateTime": "<UTC>"
}
```

---

## Lab Request — Input Row (`getLabRequestEncounterData`)

| Alias | Payload field |
|-------|---------------|
| `observation_encount_id` | `id` |
| `main_display` | `category.coding.display` |
| `full_description` | `code.coding[0].display` |
| `order_time` | `occurrenceDateTime` |
| `practitioner_name` | `requester.display`, `performer`, `locationReference.display` |

## Lab Request — FHIR ServiceRequest Output

```json
{
  "resourceType": "ServiceRequest",
  "id": "<observation_encount_id>",
  "status": "active",
  "intent": "order",
  "category": { "coding": { "system": "http://snomed.info/sct", "code": "108252007", "display": "Laboratory procedure" } },
  "code": { "coding": [{ "system": "http://loinc.org", "code": "unknown", "display": "<act>" }] },
  "occurrenceDateTime": "<UTC>",
  "locationReference": { "reference": "Location/1", "display": "<practitioner>" }
}
```

---

## result CASE Expression (PHP parity)

```sql
CASE WHEN lr.pos_neg_result = '1' THEN 'Positif'
     WHEN lr.pos_neg_result = '3' THEN 'Negatif'
     ELSE lr.comment END AS result
```

---

## Node Implementation

| Component | File |
|-----------|------|
| Builder | `services/observation/src/domain/laboratory-payload.builder.ts` |
| Processor | `services/observation/src/domain/laboratory-encounter.processor.ts` |
