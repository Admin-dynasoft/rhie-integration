<?php

require_once __DIR__ . '/../../config/upid_filter.php';

class ConsultationEncounterController
{
  private $model;
  private $hie_url;
  private $username;
  private $password;

  public function __construct($model, $creds)
  {
    $this->model = $model;
    $this->hie_url = rtrim($creds['url'], '/');
    $this->username = $creds['username'];
    $this->password = $creds['password'];
  }

  public function uploadConsultations()
  {
    $encounters = $this->model->getConsultationEncounters();

    foreach ($encounters as $row) {
      $row['upid'] = rhieSanitizeUpid($row['upid'] ?? null);

      $payload = $this->buildFHIRPayload($row);

      $response = $this->sendToHIE($payload);

      if ($response['status'] == 201 || $response['status'] == 200) {
        $this->model->markAsUploaded($row['encount_id']);
      }
    }

    return ["status" => "done"];
  }

  private function buildFHIRPayload($row)
  {
    return [
      "resourceType" => "Encounter",
      "id" => $row['encount_id'],

      "meta" => [
        "tag" => [[
          "system" => "http://fhir.openmrs.org/ext/encounter-tag",
          "code" => "encounter",
          "display" => "Encounter"
        ]]
      ],

      "status" => "finished",

      "class" => [
        "system" => "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        "code" => "AMB",
        "display" => "Ambulatory"
      ],

      "type" => [[
        "coding" => [[
          "display" => "CONSULTATION_ENCOUNTER"
        ]]
      ]],

      "serviceType" => [
        "coding" => [[
          "system" => "http://terminology.hl7.org/CodeSystem/service-type",
          "display" => "Outpatients"
        ]]
      ],

      "subject" => [
        "reference" => "Patient/" . $row['upid'],
        "type" => "Patient",
        "identifier" => [
          "type" => [
            "coding" => [[
              "code" => "UPID",
              "display" => "UPID"
            ]]
          ],
          "value" => $row['upid']
        ],
        "display" => $row['patient_name']
      ],

      "participant" => [[
        "individual" => [
          "reference" => "Practitioner/" . $row['practitioner_id'],
          "type" => "Practitioner",
          "identifier" => [
            "value" => $row['practitioner_id']
          ],
          "display" => $row['practitioner_name']
        ]
      ]],

      "period" => [
        "start" => date('c', strtotime($row['date']))
      ],

      "location" => [[
        "location" => [
          "reference" => "Location/" . $row['location_id'],
          "type" => "Location",
          "identifier" => [
            "value" => $row['location_name']
          ],
          "display" => $row['location_name']
        ]
      ]]
    ];
  }

  private function sendToHIE($payload)
  {
    $ch = curl_init();

    curl_setopt_array($ch, [
      CURLOPT_URL => $this->hie_url . "/Encounter",
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        "Authorization: Basic " . base64_encode($this->username . ":" . $this->password),
        "Content-Type: application/fhir+json"
      ],
      CURLOPT_POSTFIELDS => json_encode($payload)
    ]);

    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    return [
      "status" => $status,
      "response" => $response
    ];
  }
}
