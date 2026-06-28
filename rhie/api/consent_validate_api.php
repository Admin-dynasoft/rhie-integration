<?php
header("Content-Type: application/json");

$patientId = $_GET['patient_id'] ?? null;

if (!$patientId) {
  echo json_encode(["valid" => false, "message" => "Patient ID required"]);
  exit;
}

$fhirUrl = "https://your-fhir-server/fhir/Consent?patient=Patient/$patientId&status=active";

$response = file_get_contents($fhirUrl);
$data = json_decode($response, true);

if (!empty($data['entry'])) {
  echo json_encode([
    "valid" => true,
    "consent_reference" => $data['entry'][0]['resource']['id']
  ]);
} else {
  echo json_encode([
    "valid" => false,
    "message" => "No active consent"
  ]);
}
