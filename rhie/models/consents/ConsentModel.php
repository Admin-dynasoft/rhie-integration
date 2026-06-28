<?php

class ConsentModel
{
  private $url;
  private $username;
  private $password;

  public function __construct($creds)
  {
    $this->url = rtrim($creds['url'], '/');
    $this->username = $creds['username'];
    $this->password = $creds['password'];
  }

  public function createConsent($patientId)
  {
    $data = [
      "resourceType" => "Consent",
      "status" => "active",
      "scope" => [
        "coding" => [[
          "system" => "http://terminology.hl7.org/CodeSystem/consentscope",
          "code" => "patient-privacy",
          "display" => "Privacy Consent"
        ]]
      ],
      "category" => [[
        "coding" => [[
          "system" => "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          "code" => "INFA",
          "display" => "information access"
        ]]
      ]],
      "patient" => [
        "reference" => "Patient/" . $patientId
      ],
      "dateTime" => date("c") // ISO format
    ];

    $ch = curl_init($this->url . "/Consent");

    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        "Authorization: Basic " . base64_encode($this->username . ":" . $this->password),
        "Content-Type: application/fhir+json"
      ],
      CURLOPT_POSTFIELDS => json_encode($data),
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
      return [
        "success" => false,
        "error" => curl_error($ch)
      ];
    }

    curl_close($ch);

    return [
      "success" => ($httpCode >= 200 && $httpCode < 300),
      "status_code" => $httpCode,
      "response" => json_decode($response, true)
    ];
  }
}
