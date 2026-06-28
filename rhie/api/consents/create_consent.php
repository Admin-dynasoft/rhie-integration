<?php
// rhie/api/consents/create_consent.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Content-Type: application/json");

require_once __DIR__ . '/../../models/consents/ConsentModel.php';
require_once __DIR__ . '/../../controllers/consents/ConsentController.php';

$creds = [
  "url" => "http://197.243.24.138:5001/shr",
  "username" => "medisoft",
  "password" => "medisoft@hie2024"
];

$model = new ConsentModel($creds);
$controller = new ConsentController($model);

$patientId = $_GET['patient_id'] ?? null;

if (!$patientId) {
  echo json_encode([
    "status" => "error",
    "message" => "patient_id is required"
  ]);
  exit;
}

$result = $controller->create($patientId);

echo json_encode($result);
