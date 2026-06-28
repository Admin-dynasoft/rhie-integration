<?php
//rhie/api/consent_api.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../../link2.php';
require_once __DIR__ . '/../controllers/ConsentController.php';

header('Content-Type: application/json');

$database = new Database();
$pdo = $database->connect();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'POST only']);
  exit;
}

$data = json_decode(file_get_contents("php://input"), true);

try {
  $controller = new ConsentController($pdo);

  $result = $controller->ensureConsent([
    'patient_id' => $data['patient_id'],
    'patient_fhir_id' => $data['patient_fhir_id'],
    'upid' => $data['upid'],
    'status' => $data['status'],
    'scope' => $data['scope'],
    'dateTime' => $data['dateTime']
  ]);

  echo json_encode($result);
} catch (Throwable $e) {
  http_response_code(400);
  echo json_encode([
    'success' => false,
    'error' => $e->getMessage()
  ]);
}
