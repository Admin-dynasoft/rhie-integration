<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

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
require_once APP_ROOT . '/rhie/config/upid_filter.php';

require_once APP_ROOT . '/rhie/models/ClientRegistryModel.php';

/*
|--------------------------------------------------------------------------
| VALIDATE UPID
|--------------------------------------------------------------------------
*/
if (!isset($_GET['upid']) || empty($_GET['upid'])) {

    echo json_encode([
        "success" => false,
        "message" => "UPID is required."
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| VALIDATE FACILITY ID
|--------------------------------------------------------------------------
*/
if (!isset($_GET['facility_id']) || empty($_GET['facility_id'])) {

    echo json_encode([
        "success" => false,
        "message" => "facility_id is required."
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| GET VALUES
|--------------------------------------------------------------------------
*/
$upid = rhieSanitizeUpid($_GET['upid']);
// echo "Received request for UPID: {$upid}" . PHP_EOL;

if (!$upid) {

    echo json_encode([
        "success" => false,
        "message" => "UPID is required."
    ]);

    exit;
}

if (rhieUpidIsExcluded($upid)) {

    echo json_encode([
        "success" => false,
        "message" => "Temporary UPIDs starting with UP are excluded from HIE upload."
    ]);

    exit;
}

$facility_id = (int) $_GET['facility_id'];

/*
|--------------------------------------------------------------------------
| FACILITY DATABASE CONNECTION
|--------------------------------------------------------------------------
*/
$dbh = getFacilityPDOConnection($facility_id);

if (!$dbh) {

    echo json_encode([
        "success" => false,
        "message" => "Failed connecting facility database."
    ]);

    exit;
}

try {

    /*
    |--------------------------------------------------------------------------
    | MODEL
    |--------------------------------------------------------------------------
    */
    $model = new ClientRegistryModel($dbh);

    /*
    |--------------------------------------------------------------------------
    | FETCH CLIENT DATA
    |--------------------------------------------------------------------------
    */
    $data = $model->getClientDataByUpid($upid);

    /*
    |--------------------------------------------------------------------------
    | NO DATA
    |--------------------------------------------------------------------------
    */
    if (!$data) {

        echo json_encode([
            "success" => false,
            "message" => "No data found for UPID: {$upid}"
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */
    echo json_encode([
        "success" => true,
        "facility_id" => $facility_id,
        "message" => "Data retrieved successfully.",
        "data" => $data
    ]);

} catch (Throwable $e) {

    echo json_encode([
        "success" => false,
        "message" => "Error occurred: " . $e->getMessage()
    ]);
}
