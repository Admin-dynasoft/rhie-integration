<?php
// rhie/api/upload_visit_encounter_api.php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json");

require_once __DIR__ . '/../models/UploadEncounterModel.php';
require_once __DIR__ . '/../controllers/UploadVisitEncounterController.php';
require_once __DIR__ . '/../../link2.php';
require_once __DIR__ . '/../../link_base_url.php';

$creds = [
    'url' => 'http://197.243.24.138:5001',
    'username' => 'medisoft',
    'password' => 'medisoft@hie2024'
];

$date = $_GET['date'] ?? null;
$clientId = $_GET['client_id'] ?? null;

if (!$date || !$clientId) {
    echo json_encode([
        "status" => "error",
        "message" => "date and client_id are required"
    ]);
    exit;
}

$db = (new Database())->connect();
$model = new UploadEncounterModel($db);
$controller = new UploadVisitEncounterController($model, $creds);

$result = $controller->upload($clientId, $date);

echo json_encode([
    "api_status" => "ok",
    "controller_response" => $result,
    "debug" => [
        "date" => $date,
        "client_id" => $clientId,
        "base_url" => BASE_URL
    ]
], JSON_PRETTY_PRINT);
