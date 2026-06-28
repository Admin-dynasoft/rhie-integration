<?php
// rhie/api/consultation/get_consultation_api.php

require_once  __DIR__ . '/../../controllers/GetEncounterController.php';
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set the content type to JSON
header('Content-Type: application/json');

// Get parameters from GET or POST
$date = $_GET['date'] ?? $_POST['date'] ?? null;
$client_id = $_GET['client_id'] ?? $_POST['client_id'] ?? null;

// Validate inputs
if (!$date || !$client_id) {
	echo json_encode([
		"status" => "error",
		"message" => "Both 'date' and 'client_id' are required"
	]);
	exit;
}

$controller = new EncounterController();
$response = $controller->fetchConsultationEncounterDetails($date, $client_id);

echo json_encode([
	"status" => "success",
	"data" => $response
]);
