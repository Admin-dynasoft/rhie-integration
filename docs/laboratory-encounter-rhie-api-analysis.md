# Laboratory Encounter Upload — RHIE API Analysis

---

## Summary

Laboratory uploads make **two distinct HTTP calls** depending on record type:

| Type | FHIR Resource | Endpoint |
|------|---------------|----------|
| Lab result | Observation | `POST /shr/Observation` |
| Lab request | ServiceRequest | `POST /shr/ServiceRequest` |

**PHP source:** `UploadEncounterController::send($resource, 'observ', $payload)`

---

## API Request

| Property | PHP | Node |
|----------|-----|------|
| Method | POST | POST |
| Lab result URL | `/shr/Observation` | Same via `uploadShrResourceOnce('Observation', ...)` |
| Lab request URL | `/shr/ServiceRequest` | Same via `uploadShrResourceOnce('ServiceRequest', ...)` |
| Content-Type | `application/fhir+json` | Same |
| Auth | HTTP Basic | Axios + RhieAuthProvider |
| Retry | None | None |

---

## Success Criteria

HTTP 200 or 201 → `markObservationUploaded()`. Failure → log, no status update.

---

## Shadow Mode

Both lab result and lab request paths:
- Build full FHIR payload
- Log at `info` (`event: shadow_payload_built`, includes `resourceType`)
- No HTTP, no DB update
- Count as `processed`

---

## Worker Flow

```
ObservationWorker.processBatch()
  1. ComplaintEncounterProcessor
  2. LaboratoryEncounterProcessor.processPendingLabResultEncounters()
  3. DiagnosisEncounterProcessor
  4. LaboratoryEncounterProcessor.processPendingLabRequestEncounters()
  5. MedicationEncounterProcessor
```

Matches PHP `array_merge` order for implemented observation types.

---

## Config

```yaml
observation:
  executionMode: shadow
```
