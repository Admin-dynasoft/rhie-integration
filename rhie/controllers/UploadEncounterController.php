<?php
// rhie/controllers/UploadEncounterController.php

require_once __DIR__ . '/../config/upid_filter.php';
require_once __DIR__ . '/../config/date_helper.php';

class UploadEncounterController
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

  /* ================= ENTRY POINT ================= */

  public function uploadEncounter($client_id, $date, $encount_id, $facilityId)
  {
    echo "▶ VISIT upload: client=$client_id date=$date encounter=$encount_id\n";

    /* 1️⃣ VISIT */
    if (!$encount_id) {
      echo "❌ No VISIT found\n";
      return;
    }

    /* 2️⃣ OBSERVATIONS */
    $obsResult = $this->uploadObservations($client_id, $date, $encount_id, $facilityId);


    return $obsResult;

    echo "✔ VISIT completed\n";
  }

  /* ================= BUILDERS ================= */

  private function buildReferralEncounter(array $referral, string $visitId): array
  {
    $date = new DateTime($referral['referral_time']);
    $date->setTimezone(new DateTimeZone('UTC'));
    echo "  - Referral Encounter date: " . $date->format('Y-m-d\TH:i:sP') . "\n";
    $payload = [
      "resourceType" => "Encounter",
      "id" => $referral['observation_encount_id'],
      "meta" => [
        "tag" => [
          [
            "system" => "http://fhir.openmrs.org/ext/encounter-tag",
            "code" => "encounter",
            "display" => "Encounter"
          ]
        ]
      ],
      "extension" => [
        [
          "url" => "http://example.org/fhir/StructureDefinition/transfer-type",
          "valueCodeableConcept" => [
            "coding" => [
              [
                "system" => "http://example.org/fhir/CodeSystem/transfer-type",
                "code" => "emergency",
                "display" => "Emergency"
              ]
            ]
          ]
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/ambulance-call-time",
          "valueDateTime" => rhieFormatDateTimeOffset($referral['ambulance_time'])
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/departure-time",
          "valueDateTime" => rhieFormatDateTimeOffset($referral['departure_time'])
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/receiving-clinician-contact",
          "valueString" => "Dr. John Doe - +250788123456"
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/insurance-type",
          "valueCodeableConcept" => [
            "coding" => [
              [
                "system" => "http://example.org/fhir/CodeSystem/insurance-type",
                "code" => "cbhi",
                "display" => "CBHI (mutuelle)"
              ]
            ]
          ]
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/caregiver-info",
          "extension" => [
            [
              "url" => "name",
              "valueString" => "Name of caregiver"
            ],
            [
              "url" => "phone",
              "valueString" => "Telephone"
            ]
          ]
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/vital-signs",
          "valueString" => $referral['formatted_vitals'] ?? 'No vital signs recorded'
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/lab-results",
          "valueString" => $referral['lab_results'] ?? 'No laboratory results recorded'
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/procedures-treatments",
          "valueString" => $referral['treatments'] ?? 'No procedures recorded'
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/transport-type",
          "valueCodeableConcept" => [
            "coding" => [
              [
                "system" => "http://example.org/fhir/CodeSystem/transport-type",
                "code" => "ambulance",
                "display" => "Ambulance"
              ]
            ]
          ]
        ]
      ],
      "status" => "finished",
      "class" => [
        "system" => "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        "code" => "EMER",
        "display" => "Emergency"
      ],
      "type" => [
        [
          "coding" => [
            [
              "code" => "TRANSFER_ENCOUNTER"
            ]
          ]
        ]
      ],
      "serviceType" => [
        "coding" => [
          [
            "system" => "http://terminology.hl7.org/CodeSystem/service-type",
            "code" => "253",
            "display" => "General medical practice"
          ]
        ]
      ],
      "subject" => [
        "reference" => "Patient/" . $referral['upid'],
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
          "value" => $referral['upid']
        ],
        "display" => $referral['patient_name']
      ],
      "participant" => [

        [
          "type" => [
            [
              "coding" => [
                [
                  "system" => "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                  "code" => "REF",
                  "display" => "Referrer"
                ]
              ]
            ]
          ],

          "individual" => [
            "reference" => "Practitioner/HLC-PRAC-2025-00005",
            "type" => "Practitioner",
            "identifier" => [
              "value" => "HLC-PRAC-2025-00005"
            ],
            "display" => $referral['practitioner_name']
          ]
        ]
      ],
      "period" => [
        "start" => rhieFormatDateTimeOffset($date),
        "end"   => rhieFormatDateTimeOffset($date, 'PT5H')
      ],
      "length" => [
        "value" => 5,
        "unit" => "hours",
        "system" => "http://unitsofmeasure.org",
        "code" => "h"
      ],
      "reasoncode" => [
        [
          "coding" => [
            [
              "system" => "http://snomed.info/sct",
              "code" => '261665006',
              "display" => 'Unknown (qualifier)'
            ]
          ],
          "text" => 'Reason for Transfer: [To be filled from form]'
        ]
      ],
      "diagnosis" => [
        [
          "condition" => [
            "reference" => "Condition/example-diagnosis",
            "display" => "Primary Diagnosis"
          ],
          "use" => [
            "coding" => [
              [
                "system" => "http://terminology.hl7.org/CodeSystem/diagnosis-role",
                "code" => "AD",
                "display" => "Admission diagnosis"
              ]
            ]
          ]
        ]
      ],
      "hospitalization" => [
        "origin" => [
          "reference" => "Location/1163f2b9-08b0-4333-8e60-6a6fadc91f4f",
          "identifier" => [
            "value" => $referral['location_id']
          ],
          "display" => $referral['facility_name'] . ' Health Center'
        ],
        "admitSource" => [
          "coding" => [
            [
              "system" => "http://terminology.hl7.org/CodeSystem/admit-source",
              "code" => "hosp-trans",
              "display" => "Hospital Transfer"
            ]
          ]
        ],
        "destination" => [
          "reference" => "Location/1163f2b9-08b0-4333-8e60-6a6fadc91f4f",
          "identifier" => [
            "value" => "0002"
          ],
          "display" => $referral['hospital_name'] . ' Hospital'
        ]
      ],
      "dischargeDisposition" => [
        "coding" => [
          [
            "system" => "http://terminology.hl7.org/CodeSystem/discharge-disposition",
            "code" => "hosp",
            "display" => "Hospital"
          ]
        ]
      ],
      "location" => [
        [
          "location" => [
            "reference" => "Location/1163f2b9-08b0-4333-8e60-6a6fadc91f4f",
            "display" => $referral['hospital_name'] . ' Level Two Teaching Hospital'
          ],
          "status" => "completed",
          "period" => [
            "start" => rhieFormatDateTimeOffset($date),
            "end"   => rhieFormatDateTimeOffset($date, 'PT5H')
          ],
        ]
      ],
      "partOf" => [
        "reference" => "Encounter/" . $referral['reference_encount_id'],

      ]
    ];

    echo json_encode($payload, JSON_PRETTY_PRINT) . "\n";

    return $payload;
  }

  /* ================= UPLOADERS ================= */

  private function uploadObservations($client_id, $date, $visitId, $facilityId)
  {
    $obs = array_merge(
      $this->model->getReferralEncounterData($client_id, $date, $facilityId)
    );
    echo "▶ Observations: " . count($obs) . " Date:" . $date . " CID:" . $client_id . "\n";
    foreach ($obs as $o) {
      $o['upid'] = rhieSanitizeUpid($o['upid'] ?? null);

      if (rhieUpidIsExcluded($o['upid'])) {
        continue;
      }

      if ($o['display'] === 'Referral') {
        echo "  - Observations display: " . $o['display'] . "  Description Referral: " . $o['full_description'] . "\n";
        $resp = $this->send('Encounter', 'observ', $this->buildReferralEncounter($o, $visitId));
      } else {
        $resp = ['success' => false, 'response' => 'Skipped non-chief non-diagnostic observation'];
      }
      if ($resp['success']) {
        $this->model->markObservationUploaded($o['observation_encount_id']);
        echo "  ✓ Observation" . " Resource ID: " . $o['observation_encount_id'] . "\n";
      } else {
        echo "  ❌ Observation upload failed\n";
        echo "  Response: " . $resp['response'] . "\n";
      }
    }
  }


  /* ================= HTTP ================= */

  private function send($resource, $type, $payload)
  {
    if ($type === 'observ') {
      // echo ">>> Payload for $resource ($type):\n" . json_encode($payload, JSON_PRETTY_PRINT) . "\n";
      echo 'mm----' . $this->hie_url . '/shr/' . $resource . "\n";
      $ch = curl_init("{$this->hie_url}/shr/$resource");
    } else {
      // echo ">>> Payload for $resource ($type):\n" . json_encode($payload, JSON_PRETTY_PRINT) . "\n";
      $ch = curl_init("{$this->hie_url}/shr/$resource/" . $type ?? '');
    }
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => ['Content-Type: application/fhir+json', 'Accept: application/fhir+json'],
      CURLOPT_USERPWD => "{$this->hie_username}:{$this->hie_password}",
      CURLOPT_SSL_VERIFYPEER => false,
      CURLOPT_SSL_VERIFYHOST => false,
      CURLOPT_POSTFIELDS => json_encode($payload)
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['success' => in_array($code, [200, 201]), 'response' => $res];
  }

  private function extractId($response)
  {
    return json_decode($response, true)['id'] ?? null;
  }
}
