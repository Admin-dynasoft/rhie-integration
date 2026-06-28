<?php
header("Content-Type: application/json");

$patientId = $_POST['patient_id'] ?? null;
$encounterId = $_POST['encounter_id'] ?? null;
if (empty($patientId) || empty($encounterId)) {
  echo json_encode([
    "status" => "error",
    "message" => "Patient ID and Encounter ID are required"
  ]);
  exit;
}
// 1. Validate consent
$check = json_decode(file_get_contents(
  "http://localhost/api/consent_validate_api.php?patient_id=$patientId"
), true);

// 2. Auto-create if missing
if (!$check['valid']) {
  $create = json_decode(file_get_contents(
    "http://localhost/api/consent_create_api.php",
    false,
    stream_context_create([
      'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json",
        'content' => json_encode([
          "patient_id" => $patientId,
          "scope" => "treatment"
        ])
      ]
    ])
  ), true);

  $consentId = $create['consent_id'] ?? null;
} else {
  $consentId = $check['consent_reference'];
}
