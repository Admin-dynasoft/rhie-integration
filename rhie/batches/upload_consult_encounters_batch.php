<?php
// rhie/batches/upload_consult_encounters_batch.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../models/UploadEncounterModel.php';
require_once __DIR__ . '/../controllers/UploadVisitEncounterController.php';
require_once __DIR__ . '/../../link2.php';
require_once __DIR__ . '/../../link_base_url.php';
require_once __DIR__ . '/../../config/hie.php'; // Adjust as needed

$creds = [
  'url' => $hie_url,
  'username' => $hie_username,
  'password' => $$hie_password
];

$db = (new Database())->connect();
$model = new UploadEncounterModel($db);
$controller = new UploadVisitEncounterController($model, $creds);

/* ONLY VISIT */
$sql = "SELECT DISTINCT client_id, date, encount_id AS resource_encount_id
FROM encounter_patients
WHERE type IN ('CONSULTATION_ENCOUNTER')
AND rhie_status = 2 AND client_id = 1
ORDER BY date ASC
";

$stmt = $db->prepare($sql);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (!$rows) {
  echo "✅ Nothing to upload\n";
  exit;
}

foreach ($rows as $r) {
  $result = $controller->upload($r['client_id'], $r['date'], 'CONSULTATION_ENCOUNTER');
  echo "-----------------------------\n";
  echo json_encode([
    "status" => "success",
    "date" => $r['date'],
    "client_id" => $r['client_id'],
    "resource_encount_id" => $r['resource_encount_id'],
    "upload_result" => $result
  ], JSON_PRETTY_PRINT);
}

echo "✅ Batch finished\n";
