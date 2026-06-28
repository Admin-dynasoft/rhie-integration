<?php

class ConsentModel
{
  private $shrBaseUrl;
  private $authHeader;

  public function __construct()
  {
    // SHR base URL (MANDATORY)
    $this->shrBaseUrl = "http://197.243.24.138:5001/shr";

    // RHIE / SHR credentials (MANDATORY)
    // MRS_TEST : Ubuzima1.
    $this->authHeader = "Authorization: Basic TVJTX1RFU1Q6VWJ1emltYTEu";
  }

  public function buildConsent(string $upid): array
  {
    return [
      "resourceType" => "Consent",
      "status" => "active",
      "scope" => [
        "coding" => [[
          "system"  => "http://terminology.hl7.org/CodeSystem/consentscope",
          "code"    => "patient-privacy",
          "display" => "Privacy Consent"
        ]]
      ],
      "category" => [[
        "coding" => [[
          "system"  => "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          "code"    => "INFA",
          "display" => "information access"
        ]]
      ]],
      "patient" => [
        "reference" => "Patient/" . $upid
      ],
      "dateTime" => gmdate("Y-m-d\TH:i:s+00:00")
    ];
  }

  public function sendConsent(array $payload): array
  {
    $url = $this->shrBaseUrl . "/Consent";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST           => true,
      CURLOPT_HTTPHEADER     => [
        "Content-Type: application/fhir+json",
        "Accept: application/fhir+json",
        $this->authHeader
      ],
      CURLOPT_POSTFIELDS     => json_encode($payload),
      CURLOPT_TIMEOUT        => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($response === false) {
      $error = curl_error($ch);
      curl_close($ch);
      return [
        "code" => 0,
        "error" => $error
      ];
    }

    curl_close($ch);

    return [
      "code" => $httpCode,
      "response" => json_decode($response, true)
    ];
  }
}
