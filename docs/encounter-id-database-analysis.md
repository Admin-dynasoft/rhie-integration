# Encounter ID — Database Analysis

SQL and schema analysis for the Encounter ID module.

---

## Tables Written

### `encounter_main`

Parent encounter records (visit, transfer, consultation wrapper, vital wrapper, NCD wrappers).

| Column | Insert source | Notes |
|--------|---------------|-------|
| `encount_id` | `generateUuid()` | Primary encounter UUID |
| `type` | Generator-specific string | e.g. `VISIT_ENCOUNTER`, `E_TRANSFER` |
| `upid` | Sanitized UPID | |
| `client_id` | Source record | |
| `date` | Visit/encounter date | |
| `time` | Source time or `Y-m-d H:i:s` | |
| `rhie_status` | Always `2` on insert | Pending upload |
| `rhie_uploaded_at` | Current timestamp | |

**Upsert:** `ON DUPLICATE KEY UPDATE rhie_status, rhie_uploaded_at`

Unique key assumed on `(upid, client_id, date, type)` or similar — dedup via `checkMainEncounterExists`.

### `encounter_patients`

Child encounter records linked to source clinical data.

| Column | Insert source |
|--------|---------------|
| `encount_id` | New UUID per row |
| `type` | e.g. `lab`, `diagnostic`, `MEDICINE_ENCOUNTER` |
| `upid` | Sanitized UPID |
| `client_id` | Source client/patient id |
| `source_id` | order_id, test_id, vital_sign_id, etc. |
| `source_table` | `orders`, `lab_results`, `vital_sign`, `diag_client`, `ncds` |
| `date` | Source date |
| `time` | Source time or current timestamp |
| `rhie_status` | `2` |
| `rhie_uploaded_at` | Current timestamp |

Plain INSERT — no upsert.

---

## Tables Read (Selection)

### `clientts`

| Generator | Filter | Join |
|-----------|--------|------|
| Visit | `rhie_status = 0`, `deleted = 0` | `c.client_id = u.patient_id` |
| E-transfer | `rhie_status = 1`, `deleted = 0` | same |

### `orders`

| Generator | Filter | Join |
|-----------|--------|------|
| Consultation/Med | `type = ?`, `rhie_status = 0`, `deleted = 0` | `o.client_id = u.client_id` |
| Lab request | `type = 'laboratoire'`, same | `o.client_id = u.patient_id` |

### `lab_results`

| Filter | Join |
|--------|------|
| `rhie_status = 0` | `l.client_id = u.patient_id` |

### `diag_client` + `diags`

CTE ranks by longest diagnosis text per client. Filter: `rhie_status = 0`, `reference_reason IS NULL`.

### `vital_sign`

| Generator | Filter | Join |
|-----------|--------|------|
| Complaint | `vital_id = 9` | `vs.patient_id = u.patient_id` |
| Vitals | `vital_id IN (1,2,3,8,9,11,12,20,27,28,29,30)` | same |

### `ncds`

| Generator | Filter | Join |
|-----------|--------|------|
| NCD vitals | `vitael_id IN (1,2,3,5,11,12,13,15,17,20,21)` | `nc.client_id = u.client_id` |
| NCD plaintes | `vitael_id = 18` | same |
| NCD diagnostic | `vitael_id = 19` | same |

### `referral`

Filter: `rhie_status = 0`, `referral_reason_id IS NOT NULL`, `deleted = 0`.

### `upid_patients`

Joined in all queries for UPID. Column used for join varies — see business rules.

### `referral` (LEFT JOIN)

Used only to populate unused `referral` boolean in SELECT.

---

## Tables Updated (Source Status)

After encounter insert, source records marked `rhie_status = 1`:

| Method | Table | WHERE clause |
|--------|-------|--------------|
| `markVisitAsUploaded` | `clientts` | `client_id = ?` |
| `markOrderAsUploaded` | `orders` | `order_id = ?` |
| `markLabAsUploaded` | `lab_results` | `test_id = ?` |
| `markDiagAsUploaded` | `diag_client` | `client_id = ? AND date = ?` |
| `markComplaintAsUploaded` | `vital_sign` | `patient_id = ? AND vital_id = 9 AND date = ?` |
| `markVitalSignAsUploaded` | `vital_sign` | `patient_id = ? AND date = ?` |
| `markVitalNCDsAsUploaded` | `ncds` | `client_id = ? AND date = ?` |
| `markPlainteNCDsAsUploaded` | `ncds` | `client_id = ? AND date = ?` |
| `markDiagnosticNCDsAsUploaded` | `ncds` | `client_id = ? AND date = ?` |

**Not updated:** referral records in batch generator.

---

## rhie_status Semantics

### Source tables (clientts, orders, etc.)

| Value | Meaning |
|-------|---------|
| `0` | Pending encounter ID generation |
| `1` | Encounter ID generated (source processed) |

### Encounter tables (encounter_main, encounter_patients)

| Value | Meaning |
|-------|---------|
| `2` | ID generated, pending HIE upload |
| `1` | Uploaded to HIE (set by upload batches) |

---

## patient_id vs client_id

PHP uses inconsistent join columns. **Preserve per query:**

| Query | Join column on upid_patients |
|-------|------------------------------|
| Visit, E-transfer, Lab results, Lab request, Diag, Referral, Vitals | `patient_id` |
| Orders (consultation/med) | `client_id` |
| NCD generators | `client_id` |

On-demand helpers use `(c.client_id = u.patient_id OR c.client_id = u.client_id)`.

---

## Exact SQL Reference

All selection and mutation SQL is ported verbatim to `services/encounter-id/src/repository/sql.ts`.

Key queries:

- `SQL_VISIT_ENCOUNTERS`
- `SQL_TRANSFER_ENCOUNTERS`
- `SQL_ORDERS_ENCOUNTERS`
- `SQL_LAB_RESULTS`
- `SQL_LAB_REQUEST`
- `SQL_DIAG_ENCOUNTERS` (WITH ranked_diags CTE)
- `SQL_COMPLAINT_ENCOUNTERS` (subquery with ROW_NUMBER)
- `SQL_VITAL_SIGN_ENCOUNTERS`
- `SQL_NCD_VITAL`, `SQL_NCD_PLAINTES`, `SQL_NCD_DIAGNOSTIC`
- `SQL_REFERRAL_ENCOUNTERS`
- `SQL_INSERT_MAIN_ENCOUNTER`, `SQL_INSERT_PATIENT_ENCOUNTER`
- `SQL_CHECK_MAIN_ENCOUNTER`
- All `SQL_MARK_*` update statements

---

## Central Database

Same as Client Registry: PHP reads `health_facilities` from central `medisoft_hie`. TypeScript uses YAML `onlineDatabases` / `localDatabase` per ADR-018.

---

## Indexes (Recommended, not in PHP)

For performance at scale:

- `clientts(rhie_status, date, deleted)`
- `orders(type, rhie_status, date, deleted)`
- `encounter_main(upid, client_id, date, type)`
- `encounter_patients(client_id, date, type, source_id)`

No schema changes required for TypeScript parity.
