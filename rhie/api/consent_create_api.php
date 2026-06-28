<?php
// rhie/api/consent_create_api.php

require_once __DIR__ . '/../controllers/ConsentController.php';

header("Content-Type: application/json");

$input = json_decode(file_get_contents("php://input"), true);

$upid = $input['upid'] ?? null;

$controller = new ConsentController();
echo json_encode($controller->create($upid), JSON_PRETTY_PRINT);
