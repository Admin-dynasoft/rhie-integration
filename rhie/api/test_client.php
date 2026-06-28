<?php
// rhie/api/test_client.php
/*
|--------------------------------------------------------------------------
| ROOT
|--------------------------------------------------------------------------
*/
define('APP_ROOT', realpath(__DIR__ . '/../../'));

header('Content-Type: application/json');

/*
|--------------------------------------------------------------------------
| LOAD FILES
|--------------------------------------------------------------------------
*/
require_once APP_ROOT . '/config/hie_link.php';

require_once APP_ROOT . '/rhie/models/ClientTestModel.php';

require_once APP_ROOT . '/rhie/controllers/ClientTestController.php';

/*
|--------------------------------------------------------------------------
| NAMESPACE IMPORTS
|--------------------------------------------------------------------------
*/

use App\Models\ClientTestModel;
use App\Controllers\ClientTestController;

/*
|--------------------------------------------------------------------------
| GET FACILITY ID
|--------------------------------------------------------------------------
*/

$facility_id = $_GET['facility_id'] ?? null;

if (!$facility_id) {

  echo json_encode([
    'success' => false,
    'message' => 'facility_id is required'
  ]);

  exit;
}

/*
|--------------------------------------------------------------------------
| CLIENT ID
|--------------------------------------------------------------------------
*/
$client_id = $_GET['client_id'] ?? 50;

/*
|--------------------------------------------------------------------------
| FACILITY CONNECTION
|--------------------------------------------------------------------------
*/
$db = getFacilityPDOConnection($facility_id);

if (!$db) {

  echo json_encode([
    'success' => false,
    'message' => 'Failed connecting facility database'
  ]);

  exit;
}

/*
|--------------------------------------------------------------------------
| MVC
|--------------------------------------------------------------------------
*/
$model = new ClientTestModel($db);

$controller = new ClientTestController($model);

/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/
$controller->show($client_id);
