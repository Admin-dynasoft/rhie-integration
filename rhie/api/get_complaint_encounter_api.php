<?php
// rhie/api/get_complaint_encounter_api.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../controllers/GetEncounterController.php';
require_once __DIR__ . '/../../config/hie_link.php';

header('Content-Type: application/json');

$date = $_GET['date'] ?? $_POST['date'] ?? null;
$client_id = $_GET['client_id'] ?? $_POST['client_id'] ?? null;

$facilityId =
	$_GET['facilityId']
	?? $_GET['facility_id']
	?? $_POST['facilityId']
	?? $_POST['facility_id']
	?? null;

if (!$date || !$client_id || !$facilityId) {
	echo json_encode([
		"status" => "error",
		"message" => "All parameters 'date', 'client_id', and 'facilityId' are required"
	]);
	exit;
}

$db = getFacilityPDOConnection($facilityId);

if (!$db) {
	echo json_encode([
		"status" => "error",
		"message" => "Failed to connect facility database"
	]);
	exit;
}

$controller = new EncounterController($db);

$response = $controller->fetchComplaintEncounterDetails(
	$date,
	$client_id,
	$facilityId
);

echo json_encode([
	"status" => "success",
	"data" => $response
]);
