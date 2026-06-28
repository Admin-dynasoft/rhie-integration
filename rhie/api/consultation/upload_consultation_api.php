<?php
require_once __DIR__ . '/../../models/consultation/ConsultationEncounterModel.php';
require_once __DIR__ . '/../../controllers/consultation/ConsultationEncounterController.php';

header('Content-Type: application/json');

$model = new ConsultationEncounterModel();

$creds = [
  "url" => "http://197.243.24.138:5001/shr",
  "username" => "medisoft",
  "password" => "medisoft@hie2024"
];

$controller = new ConsultationEncounterController($model, $creds);

echo json_encode($controller->uploadConsultations());