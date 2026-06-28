# Client Registry — Business Rules

Every business rule extracted from the PHP source code. Rules are listed as implemented — not as intended.

---

## Record Eligibility

### Batch-level client selection (`client_registry_batch.php`)

A `patient_id` is selected for processing when **ALL** of the following are true:

| # | Rule | Source |
|---|------|--------|
| B1 | Row exists in `upid_patients` with `status IN (0, 1, 3)` | Batch SQL |
| B2 | UPID does **not** start with `UP` (`upid NOT LIKE 'UP%'`) | Batch SQL |
| B3 | `document_number IS NOT NULL` | Batch SQL |
| B4 | `document_number NOT LIKE 'TP-%'` (temporary IDs excluded) | Batch SQL |
| B5 | Linked `patients.age IS NOT NULL` | Batch SQL |
| B6 | `patients.age` matches regex `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` (YYYY-MM-DD birth date) | Batch SQL |
| B7 | Client has a record in `referral` table (`INNER JOIN referral ON patient_id = client_id`) | Batch SQL — **testing/referral mode** |
| B8 | Facility database connection succeeds | Batch logic |
| B9 | Global batch time budget not exceeded (`rhieBatchShouldStop()`) | batch_helpers |
| B10 | Per-run client count below `max_clients_registry_per_run` (default: 15) | batch_config |

**Ambiguity:** Batch passes `patient_id` to `processClient()` as `$clientID`, but Model queries by `client_id`. Verify whether these columns hold the same value in `upid_patients`.

---

### UPID-level selection (`ClientRegistryModel.getUpidsByClient`)

A UPID is loaded for upload when:

| # | Rule | Source |
|---|------|--------|
| U1 | `upid_patients.client_id = :clientID` | Model SQL |
| U2 | `status IN (0, 1, 3)` | Model SQL |
| U3 | `upid NOT LIKE 'UP%'` | Model SQL |
| U4 | Results ordered by `upid ASC` | Model SQL |
| U5 | DISTINCT UPIDs returned | Model SQL |

---

### UPID-level filtering (`ClientRegistryController.processClient`)

After loading UPIDs, each is further filtered:

| # | Rule | Source |
|---|------|--------|
| F1 | UPID must survive `rhieSanitizeUpid()` — trim, remove whitespace, non-printable chars, zero-width chars | upid_filter.php |
| F2 | UPID must not match `rhieUpidIsExcluded()` — case-insensitive `UP` prefix | upid_filter.php |
| F3 | Empty UPID after sanitization → skip silently | Controller |

---

### Patient data fetch (`getClientDataByUpid`)

Data row returned only when:

| # | Rule | Source |
|---|------|--------|
| D1 | UPID matches after sanitization | Model |
| D2 | `upid_patients.upid = :upid` | Model SQL |
| D3 | `status IN (0, 1, 3)` | Model SQL |
| D4 | `upid NOT LIKE 'UP%'` | Model SQL |
| D5 | All INNER JOINs succeed: `patients`, `districts_client`, `provinces`, `sectors_client`, `cells_client` | Model SQL |
| D6 | `LIMIT 1` — first matching row only | Model SQL |

**Note:** `referral` is LEFT JOINed for the `referral` boolean field only — not required for data fetch in the Model (unlike batch selection).

---

## Status Values (`upid_patients.status`)

| Value | Meaning | Set by | Included in selection? |
|-------|---------|--------|------------------------|
| `0` | Pending | Default / manual | Yes |
| `1` | Retry | Manual or external process | Yes |
| `2` | Success (uploaded) | Controller on HIE success | **No** — excluded |
| `3` | Failed | Controller on failure; batch error handler | Yes — will retry on next run |

### Status transition rules

```
Pending (0) or Retry (1) or Failed (3)
    │
    ├── Fetch data fails        → status = 3
    ├── HIE returns non-200/201 → status = 3
    └── HIE returns 200 or 201  → status = 2

Batch unhandled exception on client
    └── markClientAsFailed() → ALL upids for client_id = 3
```

**No intermediate "in progress" status exists.** A record can be uploaded twice if two batch processes run concurrently before status is updated.

---

## Validation Rules

### UPID validation

| Rule | Implementation |
|------|----------------|
| Trim whitespace | `rhieSanitizeUpid()` |
| Remove internal whitespace | `preg_replace('/\s+/', '', $clean)` |
| Remove non-printable characters | `preg_replace('/[[:^print:]]/', '', $clean)` |
| Remove zero-width Unicode chars | `preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '', $clean)` |
| Reject empty after sanitization | Returns `null` |
| Reject `UP*` prefix (temporary UPIDs) | `rhieUpidIsExcluded()` |

### Document number validation (batch only)

| Rule | Value |
|------|-------|
| Must not be NULL | Batch SQL |
| Must not start with `TP-` | Batch SQL (temporary document numbers) |

### Birth date validation (batch only)

| Rule | Value |
|------|-------|
| `patients.age` must not be NULL | Batch SQL |
| Must match `YYYY-MM-DD` format | Regex in batch SQL |

### Payload field validation

**No explicit validation** in Controller before sending to HIE. Payload is built from DB values as-is. Missing join data would cause the row to not be returned (INNER JOINs).

---

## Duplicate Upload Prevention

| Mechanism | Description |
|-----------|-------------|
| Status exclusion | `status = 2` records never selected |
| UPID prefix exclusion | `UP*` temporary UPIDs never processed |
| Process lock | File lock + optional MySQL `GET_LOCK` prevents concurrent batch runs |
| Per-run limits | `max_clients_registry_per_run = 15` caps throughput |

**Gaps:**

- No row-level lock during upload — concurrent processes could double-upload
- No idempotency key sent to HIE
- Failed records (`status = 3`) **will** be retried on every subsequent batch run
- Status `1` (retry) is treated identically to `0` (pending) — no different retry logic

---

## Retry Handling

| Aspect | Behavior |
|--------|----------|
| Explicit retry status | `status = 1` included in all selection queries — same as pending |
| Retry delay | None — retried on next batch/cron run |
| Retry count limit | None in Client Registry code |
| Backoff | None |
| HIE HTTP retry | Single attempt per UPID — no retry on 5xx or network error |
| Batch re-run | Primary retry mechanism — cron re-executes batch |

---

## Failure Handling

| Failure | Handler | Result |
|---------|---------|--------|
| Lock already held | Batch exits immediately (code 0) | No processing |
| No facilities found | Batch exits (code 1) | No processing |
| Facility DB connection fails | Log error, `continue` to next facility | Facility skipped |
| No matching clients | Log warning, `continue` | Facility skipped |
| No local data for UPID | `updateUpidStatus(upid, 3)` | UPID marked failed, next UPID |
| cURL error to HIE | Return `success: false`, status 3 | UPID marked failed |
| HIE HTTP not 200/201 | Return `success: false`, status 3 | UPID marked failed |
| Unhandled exception in batch loop | `markClientAsFailed(clientID)` — **all UPIDs for client** | Entire client marked failed |
| Inner exception in markClientAsFailed | Log warning, continue | Status may remain unchanged |

---

## Processing Limits (from `batch_config.php`)

| Setting | Default | Effect |
|---------|---------|--------|
| `max_clients_registry_per_run` | 15 | Max clients processed per facility per run |
| `max_facilities_per_run` | 2 | Facilities processed per run (rotating slice) |
| `max_execution_seconds` | 540 | Global time budget — batch stops gracefully |
| `max_records_per_batch` | 25 | Used by other batches, not client registry directly |

---

## Mandatory FHIR Payload Fields

Built by `buildPatientPayload()` — all fields below are always included:

| Field | Required | Notes |
|-------|----------|-------|
| `resourceType` | Yes | Always `"Patient"` |
| `id` | Yes | UPID value (non-standard FHIR usage) |
| `identifier[UPI]` | Yes | `{ system: "UPI", value: upid }` |
| `identifier[NID]` | Yes | `{ system: "NID", value: document_number }` |
| `active` | Yes | Always `true` |
| `name[].family` | Yes | From `first_name` (given_name column) |
| `name[].given[]` | Yes | From `last_name` (family_name column) |
| `gender` | Yes | `"male"` or `"female"` |
| `birthDate` | Yes | From `patients.age` |
| `deceasedBoolean` | Yes | Always `true` (hardcoded) |
| `telecom[].phone` | Yes | `"+25" + phone` |
| `address[]` | Yes | Single physical address in Rwanda |
| `maritalStatus.coding[]` | Yes | Mapped from marital_status code |
| `extension[]` | Yes | Single empty object `{}` (registry quirk) |

---

## Gender Mapping

```
Input (patients.sex)     → Output (FHIR gender)
'm', 'male', '1'         → 'male'
anything else            → 'female'
```

Case-insensitive comparison via `strtolower()`.

---

## Marital Status Mapping

| DB value | FHIR code | Display |
|----------|-----------|---------|
| `0` (or missing) | `S` | Single |
| `1` | `M` | Married |
| `2` | `W` | Widowed |
| `3` | `D` | Divorced |

System: `http://terminology.hl7.org/CodeSystem/v3-MaritalStatus`

---

## Conditions That Stop Processing

| Condition | Scope | Action |
|-----------|-------|--------|
| Lock not acquired | Entire batch | Exit 0 |
| Time budget exceeded | Entire batch | Break client loop |
| Client limit reached | Per facility | Break client loop |
| Empty UPID list for client | Single client | Return JSON, no HIE call |
| Excluded UPID | Single UPID | Skip silently |
| No data for UPID | Single UPID | Status 3, continue |
| HIE failure | Single UPID | Status 3, continue |

Processing **never stops** the entire batch due to a single client or UPID failure (except unhandled exceptions which mark the whole client failed).

---

## Open Questions (Documented, Not Guessed)

1. **`patient_id` vs `client_id`** — Are these always equal in `upid_patients`?
2. **Referral filter** — Is the batch referral JOIN intentional for production or leftover testing code?
3. **`deceasedBoolean: true`** — Confirmed hardcoded; is this accepted by HIE intentionally?
4. **Phone prefix `+25`** — Likely should be `+250` (Rwanda country code); preserved as-is.
5. **`link_base_url.php`** — Missing from repo; `BASE_URL` only used in error messages in API mode.
