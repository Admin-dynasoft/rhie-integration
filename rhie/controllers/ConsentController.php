<?php
// rhie/controllers/ConsentController.php

require_once __DIR__ . '/../models/ConsentModel.php';
require_once __DIR__ . '/../config/upid_filter.php';

class ConsentController
{
  private $model;

  public function __construct()
  {
    $this->model = new ConsentModel();
  }

  public function create(string $upid): array
  {
    $upid = rhieSanitizeUpid($upid) ?? '';

    if (empty($upid)) {
      return [
        "status" => "error",
        "message" => "UPID is required"
      ];
    }

    $payload = $this->model->buildConsent($upid);
    $result  = $this->model->sendConsent($payload);

    if ($result['code'] === 201) {
      return [
        "status" => "success",
        "consent" => $result['response']
      ];
    }

    return [
      "status" => "error",
      "http_code" => $result['code'],
      "response" => $result['response'] ?? $result['error'] ?? null
    ];
  }
}
