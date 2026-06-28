<?php
// rhie/controllers/UploadVisitEncounterController.php

require_once __DIR__ . '/../config/upid_filter.php';

class UploadVisitEncounterController
{
  private $model;
  private $hie_url;
  private $hie_username;
  private $hie_password;

  public function __construct($model, $creds)
  {
    $this->model = $model;
    $this->hie_url = rtrim($creds['url'], '/');
    $this->hie_username = $creds['username'];
    $this->hie_password = $creds['password'];
  }

  public function upload($clientId, $date, $type, $facilityId)
  {
    echo "▶ VISIT upload: client=$clientId date=$date $facilityId $type\n";

    if ($type === 'VISIT_ENCOUNTER') {
      $visits = $this->model->getVisitEncounterData($clientId, $date, $facilityId);
    } elseif ($type === 'E_TRANSFER') {
      $visits = $this->model->getETransferEncounterData($clientId, $date, $facilityId);
    } elseif ($type === 'TRANSFER_ENCOUNTER') {
      $visits = $this->model->getTransferEncounterData($clientId, $date, $facilityId);
    } elseif ($type === 'CONSULTATION_ENCOUNTER') {
      $visits = $this->model->getConsultationEncounterData($clientId, $date);
    } else {
      throw new Exception("Unsupported encounter type: " . $type);
    }

    $results = [];


    foreach ($visits as $visit) {
      echo "Visits found: " . count($visits) . PHP_EOL;

    echo "Processing encounter: " . $visit['resource_encount_id'] . PHP_EOL;

      $visit['upid'] = rhieSanitizeUpid($visit['upid'] ?? null);

      if (rhieUpidIsExcluded($visit['upid'])) {
        continue;
      }
      if ($type === 'E_TRANSFER') {
        $payload = $this->buildRefFHIRPayload($visit);
        $results[] = $this->sendToHIE($payload, 'referral');
      } elseif ($type === 'TRANSFER_ENCOUNTER') {
        $payload = $this->buildTransferFHIRPayload($visit);
        $results[] = $this->sendTransferToHIE($payload);
        $this->model->markTransferUploaded($visit['resource_encount_id']);
      } else {
        $payload = $this->buildFHIRPayload($visit);
        $results[] = $this->sendToHIE($payload, 'visit');
        $this->model->markVisitUploaded($visit['resource_encount_id']);
      }

      if (!$visit['resource_encount_id']) {
        continue;
      }
    }

    return $results;
  }

  private function buildFHIRPayload($visit)
  {
    return [
      "resourceType" => "Encounter",
      "id" => $visit['resource_encount_id'],
      "meta" => [
        "tag" => [
          [
            "system" => "http://fhir.openmrs.org/ext/encounter-tag",
            "code" => "encounter",
            "display" => "Encounter"
          ]
        ]
      ],
      "status" => "finished",
      "class" => [
        "system" => "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        "code" => "AMB",
        "display" => "Ambulatory"
      ],
      "type" => [
        [
          "coding" => [
            [
              "display" => $visit['type_display']
            ]
          ]
        ]
      ],
      "serviceType" => [
        "coding" => [
          [
            "system" => "http://terminology.hl7.org/CodeSystem/service-type",
            "display" => "Outpatients"
          ]
        ]
      ],
      "subject" => [
        "reference" => "Patient/" . $visit['upid'],
        "type" => "Patient",
        "identifier" => [
          "type" => [
            "coding" => [
              [
                "code" => "UPID",
                "display" => "UPID"
              ]
            ]
          ],
          "value" => $visit['upid']
        ],
        "display" => $visit['patient_name'] ?? ''
      ],
      "participant" => [
        [
          "individual" => [
            "reference" => "Practitioner/" . $visit['practitioner_id'],
            "type" => "Practitioner",
            "identifier" => [
              "value" => $visit['practitioner_id']
            ],
            "display" => $visit['practitioner_name'] ?? ''
          ]
        ]
      ],
      "period" => [
        "start" => date('c', strtotime($visit['order_time']))
      ],
      "location" => [
        [
          "location" => [
            "reference" => "Location/" . $visit['location_id'],
            "type" => "Location",
            "identifier" => [
              "value" => $visit['facility_name']
            ],
            "display" => $visit['facility_name']. " HC"
          ]
        ]
      ]
    ];
  }
  private function buildRefFHIRPayload(array $visit): array
  {
    $start = date('c', strtotime($visit['order_time'] ?? $visit['referral_time'] ?? 'now'));

    return [
      "resourceType" => "Encounter",
      "id" => $visit['resource_encount_id'],
      "meta" => [
        "tag" => [
          [
            "system" => "http://fhir.openmrs.org/ext/encounter-tag",
            "code" => "encounter",
            "display" => "Encounter"
          ]
        ]
      ],
      "status" => "planned",
      "class" => [
        "system" => "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        "code" => "AMB",
        "display" => "Ambulatory"
      ],
      "type" => [
        [
          "coding" => [
            [
              "display" => $visit['type_display'] ?? 'TRANSFER_ENCOUNTER'
            ]
          ]
        ]
      ],
      "serviceType" => [
        "coding" => [
          [
            "system" => "http://terminology.hl7.org/CodeSystem/service-type",
            "display" => "Outpatients"
          ]
        ]
      ],
      "subject" => [
        "reference" => "Patient/" . $visit['upid'],
        "type" => "Patient",
        "identifier" => [
          "type" => [
            "coding" => [
              [
                "code" => "UPID",
                "display" => "UPID"
              ]
            ]
          ],
          "value" => $visit['upid']
        ],
        "display" => $visit['patient_name'] ?? ''
      ],
      "participant" => [
        [
          "individual" => [
            "reference" => "Practitioner/" . ($visit['practitioner_id'] ?? 'MS-PRAC-0025-001'),
            "type" => "Practitioner",
            "identifier" => [
              "value" => $visit['practitioner_id'] ?? 'MS-PRAC-0025-001'
            ],
            "display" => $visit['practitioner_name'] ?? 'System'
          ]
        ]
      ],
      "period" => [
        "start" => $start,
        "end" => date('c')
      ],
      "location" => [
        [
          "location" => [
            "reference" => "Location/" . $visit['origin_location_id'],
            "type" => "Location",
            "identifier" => [
              "value" => $visit['origin_facility_name']
            ],
            "display" => ($visit['origin_facility_name'] ?? '') . ' HC'
          ]
        ]
      ],
      "hospitalization" => [
        "origin" => [
          "reference" => "Location/" . $visit['origin_location_id'],
          "type" => "Location",
          "identifier" => [
            "value" => $visit['origin_facility_name']
          ],
          "display" => ($visit['origin_facility_name'] ?? '') . ' HC'
        ],
        "destination" => [
          "reference" => "Location/" . $visit['destination_location_id'],
          "type" => "Location",
          "identifier" => [
            "value" => $visit['destination_facility_name']
          ],
          "display" => $visit['destination_facility_name']
        ]
      ],
      "partOf" => [
        "reference" => "Encounter/" . $visit['reference_encount_id']
      ]
    ];
  }

  private function buildTransferFHIRPayload(array $visit): array
  {
    $start = date('c', strtotime($visit['order_time'] ?? $visit['referral_time'] ?? 'now'));

    return [
      "resourceType" => "Encounter",
      "id" => $visit['resource_encount_id'],
      "meta" => [
        "tag" => [
          [
            "system" => "http://fhir.openmrs.org/ext/encounter-tag",
            "code" => "encounter",
            "display" => "Encounter"
          ]
        ]
      ],
      "status" => "planned",
      "class" => [
        "system" => "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        "code" => "AMB",
        "display" => "Ambulatory"
      ],
      "type" => [
        [
          "coding" => [
            [
              "display" => "TRANSFER_ENCOUNTER"
            ]
          ]
        ]
      ],
      "serviceType" => [
        "coding" => [
          [
            "system" => "http://terminology.hl7.org/CodeSystem/service-type",
            "display" => "Outpatients"
          ]
        ]
      ],
      "subject" => [
        "reference" => "Patient/" . $visit['upid'],
        "type" => "Patient",
        "identifier" => [
          "type" => [
            "coding" => [
              [
                "code" => "UPID",
                "display" => "UPID"
              ]
            ]
          ],
          "value" => $visit['upid']
        ],
        "display" => $visit['patient_name'] ?? ''
      ],
      "participant" => [
        [
          "individual" => [
            "reference" => "Practitioner/" . ($visit['practitioner_id'] ?? 'MS-PRAC-0025-001'),
            "type" => "Practitioner",
            "identifier" => [
              "value" => $visit['practitioner_id'] ?? 'MS-PRAC-0025-001'
            ],
            "display" => $visit['practitioner_name'] ?? 'System'
          ]
        ]
      ],
      "period" => [
        "start" => $start
      ],
      "location" => [
        [
          "location" => [
            "reference" => "Location/" . $visit['destination_location_id'],
            "type" => "Location",
            "identifier" => [
              "value" => $visit['destination_facility_name']
            ],
            "display" => $visit['destination_facility_name']
          ]
        ]
      ],
      "hospitalization" => [
        "origin" => [
          "reference" => "Location/" . $visit['origin_location_id'],
          "type" => "Location",
          "identifier" => [
            "value" => $visit['origin_facility_name']
          ],
          "display" => ($visit['origin_facility_name'] ?? '') . ' HC'
        ],
        "destination" => [
          "reference" => "Location/" . $visit['destination_location_id'],
          "type" => "Location",
          "identifier" => [
            "value" => $visit['destination_facility_name']
          ],
          "display" => $visit['destination_facility_name']
        ]
      ],
      "partOf" => [
        "reference" => "Encounter/" . $visit['reference_encount_id']
      ]
    ];
  }

  private function sendTransferToHIE($payload)
  {
    $ch = curl_init($this->hie_url . "/shr/Encounter/transfer");

    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        "Content-Type: application/fhir+json",
        "Accept: application/fhir+json"
      ],
      CURLOPT_POSTFIELDS => json_encode($payload),
      CURLOPT_USERPWD => $this->hie_username . ":" . $this->hie_password,
      CURLOPT_SSL_VERIFYPEER => false,
      CURLOPT_SSL_VERIFYHOST => false
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
      "endpoint" => "/shr/Encounter/transfer",
      "kind" => "transfer",
      "encounter_id" => $payload['id'],
      "upid" => $payload['subject']['identifier']['value'],
      "http_code" => $httpCode,
      "response" => json_decode($response, true)
    ];
  }

  private function sendToHIE($payload, string $kind)
  {
    if($kind ==='referral'){
      echo ">>> Payload for type: ($kind):\n" . json_encode($payload, JSON_PRETTY_PRINT) . "\n";

      $ch = curl_init($this->hie_url . "/shr/Encounter/transfer");
    }else{
      $ch = curl_init($this->hie_url . "/shr/Encounter");
    }

    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        "Content-Type: application/fhir+json",
        "Accept: application/fhir+json"
      ],
      CURLOPT_POSTFIELDS => json_encode($payload),
      CURLOPT_USERPWD => $this->hie_username . ":" . $this->hie_password,
      CURLOPT_SSL_VERIFYPEER => false,
      CURLOPT_SSL_VERIFYHOST => false
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
      "endpoint" => "/shr/Encounter",
      "kind" => $kind,
      "encounter_id" => $payload['id'],
      "upid" => $payload['subject']['identifier']['value'],
      "http_code" => $httpCode,
      "response" => json_decode($response, true)
    ];
  }
}
