<?php
// rhie/api/get_medication_encounter_api.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

/*
|--------------------------------------------------------------------------
| ROOT
|--------------------------------------------------------------------------
*/
define('APP_ROOT', realpath(__DIR__ . '/../../'));

/*
|--------------------------------------------------------------------------
| LOAD FILES
|--------------------------------------------------------------------------
*/
require_once APP_ROOT . '/config/hie_link.php';
require_once APP_ROOT . '/rhie/controllers/GetEncounterController.php';

/*
|--------------------------------------------------------------------------
| JSON
|--------------------------------------------------------------------------
*/
header('Content-Type: application/json');

/*
|--------------------------------------------------------------------------
| INPUTS
|--------------------------------------------------------------------------
*/
$date = $_GET['date'] ?? $_POST['date'] ?? null;

$client_id = $_GET['client_id'] ?? $_POST['client_id'] ?? null;

$facility_id =
    $_GET['facility_id']
    ?? $_GET['facilityId']
    ?? $_POST['facility_id']
    ?? $_POST['facilityId']
    ?? null;

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/
if (!$date || !$client_id || !$facility_id) {

    echo json_encode([
        "status" => "error",
        "message" => "date, client_id and facility_id are required"
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| FACILITY CONNECTION
|--------------------------------------------------------------------------
*/
$db = getFacilityPDOConnection($facility_id);

if (!$db) {

    echo json_encode([
        "status" => "error",
        "message" => "Failed connecting facility database"
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| CONTROLLER
|--------------------------------------------------------------------------
*/
$controller = new EncounterController($db);

/*
|--------------------------------------------------------------------------
| FETCH DATA
|--------------------------------------------------------------------------
*/
$response = $controller->fetchMedicationEncounterDetails(
    $date,
    $client_id,
    $facility_id
);

/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/
echo json_encode([
    "status" => "success",
    "facility_id" => $facility_id,
    "date" => $date,
    "client_id" => $client_id,
    "data" => $response
], JSON_PRETTY_PRINT);