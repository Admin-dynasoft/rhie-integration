# Medication Encounter Upload — Payload Mapping

Field-by-field mapping from Medisoft DB rows to FHIR MedicationRequest payload.

**Source:** `UploadEncounterController::buildMedicationRequestObservation()` (traches)

---

## Input Row (`GetEncounterModel::getMedicationEncounterData`)

| DB Column / Alias | Type | Used in Payload |
|-------------------|------|-----------------|
| `reference_encount_id` | UUID | `encounter.reference` |
| `upid` | string | `subject.reference` |
| `client_id` | int | Query filter only |
| `main_date` | date | Query filter only |
| `observation_encount_id` | UUID | `id` |
| `source_id` | int | `orders.order_id` FK (not in payload) |
| `main_display` | `'Medication Encounter'` | Not in payload |
| `display` | `'Medication_Request'` | Upload branch filter |
| `div_display` | `'Medication'` | Not in payload |
| `duration` | int/null | `dosageInstruction[0].timing.repeat.frequency` |
| `posologie` | string/null | Part of `full_description` CONCAT |
| `quantity` | number/null | `dosageInstruction[0].doseQuantity.value` |
| `item` | product id | Not in payload |
| `order_time` | datetime | `authoredOn` |
| `practitioner_name` | string | `requester.display`, final `extension` display |
| `full_description` | CONCAT string | `medicationCodeableConcept.coding[0].display` |
| `code` | `products.code` | `medicationCodeableConcept.coding[0].code` |

---

## FHIR MedicationRequest Output (key fields)

```json
{
  "resourceType": "MedicationRequest",
  "id": "<observation_encount_id>",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "<pr.code or 'unknown'>",
      "display": "<full_description or 'No description'>"
    }]
  },
  "subject": { "reference": "Patient/<upid>" },
  "encounter": { "reference": "Encounter/<reference_encount_id>" },
  "authoredOn": "<UTC ISO8601 from order_time>",
  "requester": {
    "reference": "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
    "display": "<practitioner_name or 'System'>"
  },
  "0": {
    "url": "http://hl7.org/fhir/StructureDefinition/contactpoint",
    "valueContactPoint": { "system": "phone", "value": "null", "use": "work" }
  },
  "groupIdentifier": {
    "system": "http://moh.gov.rw/prescription-code",
    "value": "PR-2025-11-20-001"
  },
  "insurance": [{
    "reference": "Coverage/cov-mituelle-230321",
    "display": "Mituelle de Santé - Community Based Health Insurance"
  }],
  "dosageInstruction": [{ "...": "..." }],
  "extension": [{
    "url": "http://hl7.org/fhir/StructureDefinition/location",
    "valueReference": {
      "reference": "Location/1",
      "display": "<practitioner_name or 'System'>"
    }
  }]
}
```

---

## PHP Payload Quirks (preserved)

1. **Duplicate `extension` key:** PHP assigns `extension` twice; the second assignment (System fallback) is the final value.
2. **Numeric key `"0"`:** Contactpoint extension sits at a top-level numeric key due to malformed PHP array literal — preserved in Node output.
3. **Hardcoded values:** `groupIdentifier`, `insurance`, dosage text/route/method, practitioner UUID, ICD not used (SNOMED code from product).
4. **`practitioner_phone`:** Referenced in PHP payload but **not** in SQL — always falls back to `'null'`.

---

## full_description CONCAT

PHP builds display string:

```sql
CONCAT(
  pr.full_desc, ' || ',
  COALESCE(p.posologie, ''), ' || ',
  IF(p.duration IS NOT NULL, CONCAT(p.duration, ' days'), ''), ' || ',
  o.quantity
) AS full_description
```

Example: `Paracetamol 500mg || 2x daily || 7 days || 10`

---

## Node Implementation

| Component | File |
|-----------|------|
| Builder | `services/observation/src/domain/medication-payload.builder.ts` |
| Types | `services/observation/src/domain/types.ts` |
| Tests | `services/observation/src/domain/medication-payload.builder.test.ts` |
