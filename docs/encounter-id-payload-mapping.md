# Encounter ID — Payload Mapping

Mapping from Medisoft source rows to encounter insert records.

Unlike Client Registry (FHIR JSON), Encounter ID "payloads" are **database insert tuples** for `encounter_main` and `encounter_patients`.

---

## Payload Types

### MainEncounterPayload

Used for parent encounters in `encounter_main`.

```typescript
interface MainEncounterPayload {
  encountId: string;      // UUID from generateUuid()
  type: string;           // e.g. 'VISIT_ENCOUNTER'
  upid: string;           // rhieSanitizeUpid applied
  clientId: number;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM:SS or full datetime
  rhieStatus: 2;          // always 2
  rhieUploadedAt: string; // ISO-like 'Y-m-d H:i:s'
}
```

### PatientEncounterPayload

Used for child encounters in `encounter_patients`.

```typescript
interface PatientEncounterPayload {
  encountId: string;
  type: string;           // e.g. 'lab', 'MEDICINE_ENCOUNTER'
  upid: string;
  clientId: number;
  sourceId: number;
  sourceTable: string;    // 'orders', 'lab_results', etc.
  date: string;
  time: string;
  rhieStatus: 2;
  rhieUploadedAt: string;
}
```

---

## Builder Methods

`EncounterPayloadBuilder` mirrors PHP insert arrays:

| Method | PHP equivalent |
|--------|----------------|
| `buildMainEncounter(params)` | `insertMainEncounter([...])` array |
| `buildPatientEncounter(params)` | `insertEncounter([...])` array |

### Main encounter example — Visit

**Source row:**

```json
{
  "date": "2026-06-25",
  "time": "09:30:00",
  "client_id": 12345,
  "upid": "602645-3179-7909",
  "referral": true
}
```

**Payload (UUID mocked as `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`):**

```json
{
  "encountId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "type": "VISIT_ENCOUNTER",
  "upid": "602645-3179-7909",
  "clientId": 12345,
  "date": "2026-06-25",
  "time": "09:30:00",
  "rhieStatus": 2,
  "rhieUploadedAt": "2026-06-28 14:00:00"
}
```

### Patient encounter example — Lab result

**Source row:**

```json
{
  "test_id": 9876,
  "date": "2026-06-25",
  "time": "11:00:00",
  "client_id": 12345,
  "upid": "602645-3179-7909"
}
```

**Payload:**

```json
{
  "encountId": "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  "type": "lab",
  "upid": "602645-3179-7909",
  "clientId": 12345,
  "sourceId": 9876,
  "sourceTable": "lab_results",
  "date": "2026-06-25",
  "time": "11:00:00",
  "rhieStatus": 2,
  "rhieUploadedAt": "2026-06-28 14:00:00"
}
```

---

## Type Mapping by Generator

| Generator | Table | type value | source_table |
|-----------|-------|------------|--------------|
| Visit | encounter_main | `VISIT_ENCOUNTER` | — |
| E-transfer | encounter_main | `E_TRANSFER` | — |
| Consultation | encounter_patients | `CONSULTATION_ENCOUNTER` | `orders` |
| Medicine | encounter_patients | `MEDICINE_ENCOUNTER` | `orders` |
| Complaint | encounter_patients | `complaint` | `vital_sign` |
| Vitals (main) | encounter_main | `encounter_vital` | — |
| Vitals (child) | encounter_patients | `vital_sign` | `vital_sign` |
| Lab request | encounter_patients | `lab_request` | `orders` |
| Lab result | encounter_patients | `lab` | `lab_results` |
| Diag (main) | encounter_main | `consultation` | — |
| Diag (child) | encounter_patients | `diagnostic` | `diag_client` |
| NCD vital (main) | encounter_main | `encounterNCDsvital` | — |
| NCD vital (child) | encounter_patients | `vital_ncds` | `ncds` |
| NCD plainte (main) | encounter_main | `encounterNCDsPlaintes` | — |
| NCD plainte (child) | encounter_patients | `plainte_ncds` | `ncds` |
| NCD diag (main) | encounter_main | `encounterNCDsDiagnostic` | — |
| NCD diag (child) | encounter_patients | `diagnostic_ncds` | `ncds` |
| Referral | encounter_patients | `referral` | `diag_client` |

---

## Time Field Rules

| Generator | time value |
|-----------|------------|
| Visit, E-transfer, Orders, Lab | Source `time` column |
| Diag, Complaint, Vitals, NCD, Referral (patient) | `date('Y-m-d H:i:s')` at generation |
| Diag, Vitals, NCD (main) | Source time or current datetime per PHP |

---

## UPID Sanitization

Applied in processor before calling builder:

```typescript
const upid = rhieSanitizeUpid(row.upid) ?? '';
if (upid === '' || rhieUpidIsExcluded(upid)) skip;
```

Matches PHP: SQL excludes `UP%`, controller sanitizes before insert.

---

## Serialization for Shadow Logs

```typescript
function serializeEncounterPayload(
  payload: MainEncounterPayload | PatientEncounterPayload
): string {
  return JSON.stringify(payload, null, 2);
}
```

Shadow mode logs full serialized payload per would-be insert.

---

## UUID Generation

PHP algorithm (preserve in `generateEncounterUuid()`):

```php
sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
  mt_rand(0, 0xffff), mt_rand(0, 0xffff),
  mt_rand(0, 0xffff),
  mt_rand(0, 0x0fff) | 0x4000,
  mt_rand(0, 0x3fff) | 0x8000,
  mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
);
```

Tests inject a fixed UUID factory; production uses the ported algorithm or `crypto.randomUUID()` only if ADR approves deviation. **Default: port PHP algorithm exactly.**

---

## Fields NOT in Payload

The following are selected but unused in inserts:

- `referral` boolean from LEFT JOIN
- `diagnosis` text from diag CTE
- `act` from lab request join

Preserved in row types for SQL parity; not mapped to encounter columns.
