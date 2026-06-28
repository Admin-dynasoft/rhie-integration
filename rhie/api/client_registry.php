<?php
// rhie/api/client_registry.php
header('Content-Type: application/json');

// Debug (remove in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

// --------------------------------------------------
// Includes
// --------------------------------------------------
require __DIR__ . '/../../link2.php';
require __DIR__ . '/../../link_base_url.php';
require __DIR__ . '/../models/ClientRegistryModel.php';
require __DIR__ . '/../controllers/ClientRegistryController.php';

// --------------------------------------------------
// Validate request method
// --------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([
    'success' => false,
    'message' => 'Only POST method is allowed'
  ]);
  exit;
}

// --------------------------------------------------
// Read JSON input
// --------------------------------------------------
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['client_id'])) {
  http_response_code(400);
  echo json_encode([
    'success' => false,
    'message' => 'client_id is required'
  ]);
  exit;
}

$clientID = (int) $input['client_id'];

// --------------------------------------------------
// Init DB + MVC
// --------------------------------------------------
try {
  $database = new Database();
  $db = $database->connect();

  $model = new ClientRegistryModel($db);

  $config = [
    'url' => 'http://197.243.24.138:5001',
    'username' => 'medisoft',
    'password' => 'medisoft@hie2024'
  ];

  $controller = new ClientRegistryController($model, $config);

  // --------------------------------------------------
  // Execute controller
  // --------------------------------------------------
  ob_start();
  $controller->processClient($clientID);
  $output = ob_get_clean();

  echo $output;
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    'success' => false,
    'message' => $e->getMessage()
  ]);
}
