# Complaint Encounter Upload — RHIE API Analysis

Documentation of external API usage in the Complaint Encounter Upload module.

---

## Summary

The PHP Complaint Encounter Upload module makes **one HTTP call per chief-complaint observation**: a FHIR `Observation` POST to the SHR endpoint.

**PHP source:** `UploadEncounterController::send('Observation', 'observ', $payload)` (traches)

---

## API Request

| Property | PHP Value | Node Value |
|----------|-----------|------------|
| Method | POST | POST |
| URL | `{hie_url}/shr/Observation` | `{baseUrl}/shr/Observation` via `uploadShrResourceOnce` |
| Content-Type | `application/fhir+json` | `application/fhir+json` |
| Accept | `application/fhir+json` | `application/fhir+json` |
| Authentication | HTTP Basic (`CURLOPT_USERPWD`) | Axios `auth` + `RhieAuthProvider` |
| SSL verification | Disabled (`CURLOPT_SSL_VERIFYPEER => false`) | Node default (platform TLS) |
| Body | JSON-encoded FHIR Observation | JSON-encoded FHIR Observation |
| Retry | None | None (`uploadShrResourceOnce`) |

### PHP send() routing

```php
if ($type === 'observ') {
    $ch = curl_init("{$this->hie_url}/shr/$resource");
}
```

For complaints: `$resource = 'Observation'`, `$type = 'observ'`.

---

## Success Criteria

```php
in_array($code, [200, 201])
```

Node mirrors: `response.status === 200 || response.status === 201`.

---

## Response Handling

PHP returns:

```php
['success' => in_array($code, [200, 201]), 'response' => $res]
```

On success, PHP calls:

```php
$this->model->markObservationUploaded($o['observation_encount_id']);
```

On failure, PHP logs the response and **does not** update `rhie_status`.

**Contrast with visit encounter:** Visit marks uploaded unconditionally after every send attempt. Complaint marks **only on HTTP success**.

---

## Authentication

| PHP | Node |
|-----|------|
| `$hie_username`, `$hie_password` from credentials array | `rhie.auth.username`, `rhie.auth.password` from `platform.yaml` |
| Basic auth on every request | Basic auth via Axios + `RhieAuthProvider.getAuthHeaders()` |

---

## Error Handling

| Error type | PHP | Node |
|------------|-----|------|
| HTTP non-2xx | Log response; no mark | Log via `shr_resource_upload_failed`; no mark |
| cURL/network error | Empty response, http_code 0; no mark | Caught in `uploadShrResourceOnce`; no mark |
| Retry | None | None (single-attempt function) |

Platform `@rhie/rhie-client` `RhieClient.request()` uses `RetryManager` — **not used** by Complaint Encounter service. The service uses `uploadShrResourceOnce()` matching PHP single-attempt semantics.

---

## Shadow Mode (Node Extension)

When `observation.executionMode: shadow`:

1. Payload is built identically to production
2. Full FHIR JSON logged at `info` level (`event: shadow_payload_built`)
3. **No HTTP POST** to HIE
4. **No** `markObservationUploaded` DB update
5. Batch counts row as `processed`

PHP has no equivalent shadow mode — this is a safe rollout extension.

---

## Config

```yaml
observation:
  executionMode: shadow   # or production

rhie:
  baseUrl: https://devhie.moh.gov.rw:5000
  observationPath: /shr/Observation
  auth:
    type: basic
    username: ...
    password: ...
```

---

## Node Implementation

| Component | File |
|-----------|------|
| HTTP client | `packages/rhie-client/src/shr-resource-upload.ts` |
| Processor wiring | `services/observation/src/domain/complaint-encounter.processor.ts` |
| RHIE tests | `services/observation/src/domain/complaint-encounter.rhie.test.ts` |
