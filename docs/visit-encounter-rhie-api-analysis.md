# Visit Encounter Upload — RHIE API Analysis

Documentation of external API usage in the Visit Encounter Upload module.

---

## Summary

The PHP Visit Encounter Upload module makes **one HTTP call per visit encounter**: a FHIR `Encounter` POST to the SHR endpoint.

---

## API Request

| Property | PHP Value | Node Value |
|----------|-----------|------------|
| Method | POST | POST |
| URL | `{hie_url}/shr/Encounter` | `{baseUrl}/shr/Encounter` via `rhie.visitEncounterPath` |
| Content-Type | `application/fhir+json` | `application/fhir+json` |
| Accept | `application/fhir+json` | `application/fhir+json` |
| Authentication | HTTP Basic (`CURLOPT_USERPWD`) | Axios `auth` + `RhieAuthProvider` |
| SSL verification | Disabled | Node default (platform TLS) |
| Body | JSON-encoded FHIR Encounter | JSON-encoded FHIR Encounter |
| Retry | None | None (`uploadVisitEncounterOnce`) |

### E-transfer variant (out of scope)

When `kind === 'referral'`, PHP uses `POST {hie_url}/shr/Encounter/transfer`. Not used by `upload_visit_encounters_batch.php`.

---

## Success Criteria

```php
in_array($code, [200, 201])
```

Node mirrors: `response.status === 200 || response.status === 201`.

---

## Response Handling

PHP returns metadata regardless of success:

```php
[
  "endpoint" => "/shr/Encounter",
  "kind" => $kind,
  "encounter_id" => $payload['id'],
  "upid" => $payload['subject']['identifier']['value'],
  "http_code" => $httpCode,
  "response" => json_decode($response, true)
]
```

**Critical parity note:** PHP does **not** gate `markVisitUploaded()` on HTTP success. Failed uploads still transition `rhie_status` from 2 → 1.

---

## Authentication

| PHP | Node |
|-----|------|
| `$hie_username`, `$hie_password` from `config/hie.php` | `rhie.auth.username`, `rhie.auth.password` from `platform.yaml` |
| Basic auth on every request | Basic auth via Axios + auth provider |

---

## Error Handling

| Error type | PHP | Node |
|------------|-----|------|
| HTTP non-2xx | Returns in response array; marks uploaded | Same in production mode |
| cURL/network error | Empty response, http_code 0; marks uploaded | Caught, logged; marks uploaded in production |
| Retry | None | None (single-attempt function) |

Platform `@rhie/rhie-client` `RhieClient.request()` uses `RetryManager` — **not used** by Visit Encounter service. The service uses `uploadVisitEncounterOnce()` matching PHP single-attempt semantics.

---

## Shadow Mode (Node only)

When `visitEncounter.executionMode: shadow`:

1. Build FHIR payload
2. Log payload
3. Skip HTTP POST
4. Skip `markVisitUploaded`

This allows safe validation before production cutover. PHP has no equivalent.

---

## Config Mapping

| PHP | TypeScript |
|-----|------------|
| `$hie_url` | `rhie.baseUrl` |
| `$hie_username` / `$hie_password` | `rhie.auth.username` / `rhie.auth.password` |
| `/shr/Encounter` | `rhie.visitEncounterPath` (default corrected to `/shr/Encounter`) |
