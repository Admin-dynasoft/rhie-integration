# Medication Encounter Upload — RHIE API Analysis

Documentation of external API usage in the Medication Encounter Upload module.

---

## Summary

The PHP Medication Encounter Upload module makes **one HTTP call per medication request**: a FHIR `MedicationRequest` POST to the SHR endpoint.

**PHP source:** `UploadEncounterController::send('MedicationRequest', 'observ', $payload)` (traches)

---

## API Request

| Property | PHP Value | Node Value |
|----------|-----------|------------|
| Method | POST | POST |
| URL | `{hie_url}/shr/MedicationRequest` | `{baseUrl}/shr/MedicationRequest` via `uploadShrResourceOnce` |
| Content-Type | `application/fhir+json` | `application/fhir+json` |
| Accept | `application/fhir+json` | `application/fhir+json` |
| Authentication | HTTP Basic | Axios `auth` + `RhieAuthProvider` |
| SSL verification | Disabled | Node default (platform TLS) |
| Body | JSON-encoded FHIR MedicationRequest | Same |
| Retry | None | None |

---

## Success Criteria

```php
in_array($code, [200, 201])
```

Node: `response.status === 200 || response.status === 201`.

---

## Response Handling

On success, PHP calls:

```php
$this->model->markObservationUploaded($o['observation_encount_id']);
```

On failure: log response, **no** `rhie_status` update. Row remains at status 2 for next batch cycle.

---

## Authentication

| PHP | Node |
|-----|------|
| Credentials from HIE config array | `rhie.auth.username/password` from `platform.yaml` |
| Basic auth per request | Axios + `RhieAuthProvider.getAuthHeaders()` |

---

## Error Handling

| Error type | PHP | Node |
|------------|-----|------|
| HTTP non-2xx | Log; no mark | Log via `shr_resource_upload_failed`; no mark |
| Network error | No mark | Caught in `uploadShrResourceOnce`; no mark |
| Retry | None | None |

---

## Shadow Mode (Node Extension)

When `observation.executionMode: shadow`:

1. Payload built identically to production
2. Logged at `info` (`event: shadow_payload_built`)
3. No HTTP POST
4. No `markObservationUploaded`
5. Batch counts as `processed`

---

## Worker Flow

```
ObservationWorker.processBatch()
  ├── ComplaintEncounterProcessor.processPendingComplaintEncounters()
  ├── DiagnosisEncounterProcessor.processPendingDiagnosisEncounters()
  └── MedicationEncounterProcessor.processPendingMedicationEncounters()
```

Order matches PHP `uploadObservations()` array_merge sequence (complaint → … → medication).

---

## Config

```yaml
observation:
  executionMode: shadow

rhie:
  baseUrl: https://devhie.moh.gov.rw:5000
  auth:
    type: basic
```

---

## Node Implementation

| Component | File |
|-----------|------|
| HTTP client | `packages/rhie-client/src/shr-resource-upload.ts` |
| Processor | `services/observation/src/domain/medication-encounter.processor.ts` |
| RHIE tests | `services/observation/src/domain/medication-encounter.rhie.test.ts` |
