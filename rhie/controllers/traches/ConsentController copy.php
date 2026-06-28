<?php
// rhie/controllers/ConsentController.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../models/ConsentModel.php';

class ConsentController
{
  private ConsentModel $model;
  private array $fhir;

  public function __construct(PDO $pdo)
  {
    $this->model = new ConsentModel($pdo);

    $config = require __DIR__ . '/../config/fhir.php';
    if (!is_array($config)) {
      throw new RuntimeException('FHIR configuration is invalid');
    }
    $this->fhir = $config;
  }

  /**
   * Ensure a consent exists for given patient + scope
   */
  public function ensureConsent(array $input): array
  {
    // 🔒 1. Validate input early (NO WARNINGS EVER)
    $required = [
      'patient_id',
      'patient_fhir_id',
      'upid',
      'status',
      'scope',
      'dateTime'
    ];

    foreach ($required as $key) {
      if (!isset($input[$key]) || $input[$key] === '') {
        throw new InvalidArgumentException("Missing required field: {$key}");
      }
    }

    $scope = $input['scope'];

    // 🔒 2. Validate allowed values
    if (!in_array($scope, ['patient-privacy', 'treatment', 'research'], true)) {
      throw new InvalidArgumentException("Invalid consent scope: {$scope}");
    }

    if (!in_array($input['status'], ['draft', 'proposed', 'active', 'rejected', 'inactive'], true)) {
      throw new InvalidArgumentException("Invalid consent status: {$input['status']}");
    }

    // 🛑 3. Block if active consent already exists
    if ($this->model->hasActiveConsent($input['patient_id'], $scope)) {
      return [
        'success' => true,
        'message' => 'Active consent already exists',
        'scope'   => $scope
      ];
    }

    // 🧱 4. Build FHIR payload
    $payload = $this->buildFHIRPayload($input);

    // 🌐 5. Send to RHIE
    $fhirResponse = $this->postToFHIR($payload);

    if (empty($fhirResponse['id'])) {
      throw new RuntimeException('FHIR Consent created but no ID returned');
    }

    // 💾 6. Save locally
    $this->model->saveConsent([
      'patient_id' => (int)$input['patient_id'],
      'upid'       => $input['upid'],
      'fhir_id'    => $fhirResponse['id'],
      'status'     => $input['status'],
      'scope'      => $scope,
      'dateTime'   => $this->normalizeDateTime($input['dateTime'])
    ]);

    return [
      'success'          => true,
      'message'          => 'Consent created successfully',
      'fhir_consent_id'  => $fhirResponse['id'],
      'scope'            => $scope
    ];
  }

  /**
   * Build valid FHIR Consent payload
   */
  private function buildFHIRPayload(array $input): array
  {
    $categoryMap = [
      'patient-privacy' => ['code' => 'INFA',  'display' => 'Information Access'],
      'treatment'       => ['code' => 'TREAT', 'display' => 'Treatment'],
      'research'        => ['code' => 'RESEARCH', 'display' => 'Research']
    ];

    return [
      'resourceType' => 'Consent',
      'status'       => $input['status'],
      'scope' => [
        'coding' => [[
          'system' => 'http://terminology.hl7.org/CodeSystem/consentscope',
          'code'   => $input['scope']
        ]]
      ],
      'category' => [[
        'coding' => [[
          'system'  => 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          'code'    => $categoryMap[$input['scope']]['code'],
          'display' => $categoryMap[$input['scope']]['display']
        ]]
      ]],
      'patient' => [
        'reference' => 'Patient/' . $input['patient_fhir_id']
      ],
      'dateTime' => $input['dateTime']
    ];
  }

  /**
   * POST Consent to FHIR server
   */
  private function postToFHIR(array $payload): array
  {
    $url = rtrim($this->fhir['base_url'], '/') . '/Consent';

    $auth = base64_encode(
      $this->fhir['username'] . ':' . $this->fhir['password']
    );

    $headers = [
      'Content-Type: application/fhir+json',
      'Accept: application/fhir+json',
      'Authorization: Basic ' . $auth
    ];

    $ch = curl_init($url);

    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST           => true,
      CURLOPT_HTTPHEADER     => $headers,
      CURLOPT_POSTFIELDS     => json_encode($payload),
      CURLOPT_TIMEOUT        => 30,
      CURLOPT_CONNECTTIMEOUT => 10
    ]);

    $response = curl_exec($ch);

    if ($response === false) {
      $err = curl_error($ch);
      curl_close($ch);
      throw new RuntimeException('cURL error: ' . $err);
    }

    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!in_array($code, [200, 201, 202], true)) {
      throw new RuntimeException("FHIR Consent failed [{$code}]: {$response}");
    }

    $decoded = json_decode($response, true);

    if (!is_array($decoded)) {
      throw new RuntimeException('Invalid JSON from FHIR server');
    }

    return $decoded;
  }

  private function normalizeDateTime(string $dateTime): string
  {
    try {
      $dt = new DateTime($dateTime);
      return $dt->format('Y-m-d H:i:s'); // MySQL DATETIME
    } catch (Exception $e) {
      throw new InvalidArgumentException('Invalid dateTime format');
    }
  }
}
