<?php
// rhie/controllers/UploadEncounterController.php

require_once __DIR__ . '/../config/upid_filter.php';

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
    $obsResult =$this->uploadObservations($client_id, $date, $encount_id, $facilityId);


    return $obsResult;

    /* 3️⃣ MEDICATION */
    // $this->uploadMedications($client_id, $date, $encount_id);

    echo "✔ VISIT completed\n";
  }

  /* ================= BUILDERS ================= */

  private function buildComplaintObservation(array $observation, string $visitId): array
  {
    $date = new DateTime($observation['order_time']);
    $date->setTimezone(new DateTimeZone('UTC'));

    echo "  - Building Observation date: " . $date->format('Y-m-d\TH:i:sP') . "\n";

    $payload = [
      "resourceType" => "Observation",
      "id" => $observation['observation_encount_id'],
      "status" => "final",

      "code" => [
        "coding" => [[
          "system"  => "http://loinc.org",
          "code"    => "33747-0",
          "display" => "Chief Complaints"
        ]]
      ],

      "category" => [[
        "coding" => [[
          "system"  => "http://terminology.hl7.org/CodeSystem/observation-category",
          "code"    => "survey",
          "display" => "survey"
        ]]
      ]],

      "subject" => [
        "reference" => "Patient/" . $observation['upid']
      ],

      "encounter" => [
        "reference" => "Encounter/" . $observation['reference_encount_id']
      ],

      "performer" => [[
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ]],

      "valueString" => $observation['full_description'] ?? 'No complaint details',
      "effectiveDateTime" => $date->format('Y-m-d\TH:i:sP')
    ];

    return $payload;
  }

  private function buildDiagnosticObservation(array $observation, string $visitId): array
  {
    $date = new DateTime($observation['order_time']);
    $date->setTimezone(new DateTimeZone('UTC'));

    echo "  - Building Diagnostic Observation date: " . $date->format('Y-m-d\TH:i:sP') . "\n";

    $payload = [
      "resourceType" => "Condition",
      "id" => $observation['observation_encount_id'],
      "clinicalStatus" => [
        "coding" => [[
          "system" => "http://terminology.hl7.org/CodeSystem/condition-clinical",
          "code" => "active"
        ]]
      ],
      "verificationStatus" => [
        "coding" => [[
          "system" => "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          "code" => "confirmed"
        ]]
      ],
      "code" => [
        "coding" => [[
          "system" => "https://icd.who.int",
          "code" => '1F42',
          "display" => $observation['full_description'] ?? 'No description'
        ]]
      ],
      "subject" => [
        "reference" => "Patient/" . $observation['upid']
      ],
      "encounter" => [
        "reference" => "Encounter/" . $observation['reference_encount_id']
      ],
      "onsetDateTime" => $date->format('Y-m-d\TH:i:sP'),
      "asserter" => [
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ]
    ];

    return $payload;
  }

  private function buildVitalObservation(array $observation, string $visitId): array
  {
    $date = new DateTime($observation['order_time']);
    $date->setTimezone(new DateTimeZone('UTC'));

    echo "  - Building Vital Observation date: " . $date->format('Y-m-d\TH:i:sP') . "\n";

    $payload = [
      "resourceType" => "Observation",
      "id" => $observation['observation_encount_id'],
      "status" => "final",

      "code" => [
        "coding" => [[
          "system"  => "http://loinc.org",
          "code"    => 'unknown',
          "display" => $observation['full_description'] ?? 'No description'
        ]]
      ],

      "category" => [[
        "coding" => [[
          "system"  => "http://terminology.hl7.org/CodeSystem/observation-category",
          "code"    => "vital-signs",
          "display" => "vital-signs"
        ]]
      ]],

      "subject" => [
        "reference" => "Patient/" . $observation['upid']
      ],

      "encounter" => [
        "reference" => "Encounter/" . $observation['reference_encount_id']
      ],

      "performer" => [[
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ]],

      // Assuming result is numeric for vital signs
      "valueQuantity" => [
        "value"  => $observation['result'] ?? null,
        "unit"   => $observation['full_description'] ?? '',
        "system" => "http://unitsofmeasure.org"
      ],
      "effectiveDateTime" => $date->format('Y-m-d\TH:i:sP')
    ];

    return $payload;
  }

  private function buildLabRequestObservation(array $observation, string $visitId): array
  {
    $date = new DateTime($observation['order_time']);
    $date->setTimezone(new DateTimeZone('UTC'));

    echo "  - Building Lab Request Observation date: " . $date->format('Y-m-d\TH:i:sP') . "\n";

    $payload = [
      "resourceType" => "ServiceRequest",
      "id" => $observation['observation_encount_id'],
      "status" => "active",
      "intent" => "order",
      "category" => [
        "coding" => [
          "system" => "http://snomed.info/sct",
          "code" => "108252007",
          "display" => $observation['main_display'] ?? "Laboratory procedure"
        ]
      ],
      "code" => [
        "coding" => [[
          "system"  => "http://loinc.org",
          "code"    => 'unknown',
          "display" => $observation['full_description'] ?? 'No description'
        ]]
      ],
      "subject" => [
        "reference" => "Patient/" . $observation['upid']
      ],
      "encounter" => [
        "reference" => "Encounter/" . $observation['reference_encount_id']
      ],
      "occurrenceDateTime" => $date->format('Y-m-d\TH:i:sP'),
      "requester" => [
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ],
      "performer" => [[
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ]],
      "locationReference" => [
        "reference" => "Location/1",
        "display" => $observation['practitioner_name'] ?? 'System'
      ]
    ];

    return $payload;
  }

  private function buildLabObservation(array $observation, string $visitId): array
  {
    $date = new DateTime($observation['order_time']);
    $date->setTimezone(new DateTimeZone('UTC'));

    echo "  - Building Lab Observation date: " . $date->format('Y-m-d\TH:i:sP') . "\n";

    $payload = [
      "resourceType" => "Observation",
      "id" => $observation['observation_encount_id'],
      "status" => "final",

      "code" => [
        "coding" => [[
          "system"  => "http://loinc.org",
          "code"    => '33747-0',
          "display" => $observation['full_description'] ?? 'No description'
        ]]
      ],

      "category" => [[
        "coding" => [[
          "system"  => "http://terminology.hl7.org/CodeSystem/observation-category",
          "code"    => "laboratory",
          "display" => $observation['display'] ?? 'Laboratory'
        ]]
      ]],

      "subject" => [
        "reference" => "Patient/" . $observation['upid']
      ],

      "encounter" => [
        "reference" => "Encounter/" . $observation['reference_encount_id']
      ],

      "performer" => [[
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ]],

      // Assuming result is numeric for lab results
      "valueQuantity" => [
        "value"  =>  null,
        "unit"   => $observation['result'] ?? '', // Unit can be added if available in the data
        "system" => "http://unitsofmeasure.org"
      ],
      "effectiveDateTime" => $date->format('Y-m-d\TH:i:sP')
    ];

    return $payload;
  }

  private function buildObservation(array $observation, string $visitId): array
  {
    $date = new DateTime($observation['order_time']);
    $date->setTimezone(new DateTimeZone('UTC'));

    echo "  - Observation date: " . $date->format('Y-m-d\TH:i:sP') . "\n";

    $payload = [
      "resourceType" => "Observation",
      "id" => $observation['main_encount_id'],
      "status" => "final",

      "code" => [
        "coding" => [[
          "system"  => "http://loinc.org",
          "code"    => "33747-0",
          "display" => $observation['full_description'] ?? ''
        ]]
      ],

      "category" => [[
        "coding" => [[
          "system"  => "http://terminology.hl7.org/CodeSystem/observation-category",
          "code"    => "survey",
          "display" => "survey"
        ]]
      ]],

      "subject" => [
        "reference" => "Patient/" . $observation['upid']
      ],

      "encounter" => [
        "reference" => "Encounter/" . $observation['med_encount_id']
      ],

      "performer" => [[
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ]],

      "effectiveDateTime" => $date->format('Y-m-d\TH:i:sP')
    ];

    if (
      strtolower($observation['display'] ?? '') === 'chief complaint' ||
      strtolower($observation['display'] ?? '') === 'chief complaints'
    ) {

      $payload['valueString'] =
        $observation['value_string'] ??
        $observation['full_description'] ??
        'No complaint details';
    } else {

      $payload['valueQuantity'] = [
        "value"  => $observation['result'] ?? null,
        "unit"   => $observation['full_description'] ?? '',
        "system" => "http://unitsofmeasure.org"
      ];
    }

    return $payload;
  }

  private function buildMedicationRequestObservation(array $observation, string $visitId): array
  {

    $date = new DateTime($observation['order_time']);
    $date->setTimezone(new DateTimeZone('UTC'));
    echo "  - Building Medication Request Observation date: " . $date->format('Y-m-d\TH:i:sP') . "\n";
    $payload = [
      "resourceType" => "MedicationRequest",
      "id" => $observation['observation_encount_id'],
      "status" => "active",
      "intent" => "order",
      "medicationCodeableConcept" => [
        "coding" => [[
          "system" => "http://snomed.info/sct",
          "code" => $observation['code'] ?? 'unknown',
          "display" => $observation['full_description'] ?? 'No description'
        ]]
      ],
      "subject" => [
        "reference" => "Patient/" . $observation['upid']
      ],
      "encounter" => [
        "reference" => "Encounter/" . $observation['reference_encount_id']
      ],
      "authoredOn" => $date->format('Y-m-d\TH:i:sP'),
      "requester" => [
        "reference" => "Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653",
        "display" => $observation['practitioner_name'] ?? 'System'
      ],

      "extension" => [
        [
          "url" => "http://hl7.org/fhir/StructureDefinition/location",
          "valueReference" => [
            "reference" => "Location/1",
            "display" => $observation['practitioner_name'] ?? 'null'
          ]
        ]
      ],
      [
        "url" => "http://hl7.org/fhir/StructureDefinition/contactpoint",
        "valueContactPoint" => [
          "system" => "phone",
          "value" => $observation['practitioner_phone'] ?? 'null',
          "use" => "work"
        ]
      ],


      "groupIdentifier" => [
        "system" => "http://moh.gov.rw/prescription-code",
        "value" => "PR-2025-11-20-001"
      ],
      "insurance" => [
        [
          "reference" => "Coverage/cov-mituelle-230321",
          "display" => "Mituelle de Santé - Community Based Health Insurance"
        ]
      ],
      "dosageInstruction" => [
        [
          "text" => "Take as directed",
          "timing" => [
            "repeat" => [
              "frequency" => $observation['duration'] ?? 1,
              "period" => 1,
              "periodUnit" => "d"
            ]
          ],
          "route" => [
            "coding" => [
              [
                "system" => "http://snomed.info/sct",
                "code" => "26643006",
                "display" => "Oral route",
                "text" => "oral"
              ]
            ]
          ],

          "doseQuantity" => [
            "type" => [
              "coding" => [
                [
                  "system" => "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                  "code" => "ordered",
                  "display" => "Ordered"
                ]
              ]
            ],
            "value" => $observation['quantity'] ?? null,
            "unit" => 'mg',
            "system" => "http://unitsofmeasure.org",
            "code" => "Mg"
          ],
          "method" => [
            "coding" => [
              [
                "system" => "http://snomed.info/sct",
                "code" => "738995006",
                "display" => "Swallow",
                "text" => "Swallow"
              ]
            ]
          ],
          "doseAndRate" => [

            "type" => [
              "coding" => [
                [
                  "system" => "http://terminology.hl7.org/CodeSystem/dose-rate-type",
                  "code" => "ordered",
                  "display" => "Ordered"
                ]
              ]
            ],
            // "doseQuantity" => [
            //   "value" => $observation['quantity'] ?? null,
            //   "unit" => 'mg',
            //   "system" => "http://unitsofmeasure.org",
            //   "code" => "Mg"
            // ]
          ]
        ]

      ],
      "extension" => [
        [
          "url" => "http://hl7.org/fhir/StructureDefinition/location",
          "valueReference" => [
            "reference" => "Location/1",
            "display" => $observation['practitioner_name'] ?? 'System'
          ]
        ]
      ]
    ];

    return $payload;
  }

  private function buildMedicationAdministration($m, $visitId, $reqId)
  {
    return [
      "resourceType" => "MedicationAdministration",
      "status" => "completed",
      "medicationCodeableConcept" => ["text" => $m['item']],
      "subject" => ["reference" => "Patient/" . $m['upid']],
      "context" => ["reference" => "Encounter/" . $visitId],
      "request" => ["reference" => "MedicationRequest/" . $reqId],
      "effectiveDateTime" => date('c', strtotime($m['date']))
    ];
  }

  private function buildReferralEncounter(array $referral, string $visitId): array
  {
    $date = new DateTime($referral['order_time']);
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
          // $referral['ambulance_call_time'] should be in ISO 8601 format, e.g. "2025-11-19T13:00:00+02:00"
          "valueDateTime" => date('c', strtotime($referral['ambulance_time'])) ?? "2025-11-19T13:00:00+02:00"
        ],
        [
          "url" => "http://example.org/fhir/StructureDefinition/departure-time",
          "valueDateTime" => date('c', strtotime($referral['departure_time'])) ?? "2025-11-19T13:35:35+02:00"
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
        // end can be set to start + 5 hour for simplicity, or left out if not known
        "start" => $date->format('Y-m-d\TH:i:sP'),
        "end" => $date->add(new DateInterval('PT5H'))->format('Y-m-d\TH:i:sP')
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
            "start" => "2025-11-19T13:35:35+02:00",
            "end" => $date->add(new DateInterval('PT5H'))->format('Y-m-d\TH:i:sP')
          ]
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
      $this->model->getComplaintEncounterData($client_id, $date, $facilityId),
      $this->model->getVitalEncounterData($client_id, $date, $facilityId),
      $this->model->getLaboEncounterData($client_id, $date, $facilityId),
      $this->model->getDiagEncounterData($client_id, $date, $facilityId),
      $this->model->getLabRequestEncounterData($client_id, $date, $facilityId),
      $this->model->getMedicationData($client_id, $date, $facilityId),
      $this->model->getMedicationAdmitData($client_id, $date, $facilityId),
      $this->model->getReferralEncounterData($client_id, $date, $facilityId),
      $this->model->getETransferEncounterData($client_id, $date, $facilityId)
    );
    echo "▶ Observations: " . count($obs) . " Date:" . $date . " CID:" . $client_id . "\n";
    foreach ($obs as $o) {
      $o['upid'] = rhieSanitizeUpid($o['upid'] ?? null);

      if (rhieUpidIsExcluded($o['upid'])) {
        continue;
      }

      if ($o['display'] === 'Chief Complaintt') {
        echo "  - Observations display: " . $o['display'] . "  Description chef: " . $o['full_description'] . "\n";
        $resp = $this->send('Observation', 'observ', $this->buildComplaintObservation($o, $visitId));
      } else if ($o['display'] === 'Diagnosticc') {
        echo "  - Observations display: " . $o['display'] . "  Description diag: " . $o['full_description'] . "\n";
        $resp = $this->send('Condition', 'observ', $this->buildDiagnosticObservation($o, $visitId));
      } else if ($o['display'] === 'Vital Signn') {
        echo "  - Observations display: " . $o['display'] . "  Description vital: " . $o['full_description'] . "\n";
        $resp = $this->send('Observation', 'observ', $this->buildVitalObservation($o, $visitId));
      } else if ($o['display'] === 'Lab Requestt') {
        echo "  - Observations display: " . $o['display'] . "  Description labo: " . $o['full_description'] . "\n";
        $resp = $this->send('ServiceRequest', 'observ', $this->buildLabRequestObservation($o, $visitId));
      } else if ($o['display'] === 'Laboratoryy') {
        echo "  - Observations display: " . $o['display'] . "  Description labo: " . $o['full_description'] . "\n";
        $resp = $this->send('Observation', 'observ', $this->buildLabObservation($o, $visitId));
      } else if ($o['display'] === 'Medication_Requestt') {
        echo "  - Observations display: " . $o['display'] . "  Description med: " . $o['full_description'] . "\n";
        $resp = $this->send('MedicationRequest', 'observ', $this->buildMedicationRequestObservation($o, $visitId));
      } else if ($o['display'] === 'Referral') {
        echo "  - Observations display: " . $o['display'] . "  Description Referral: " . $o['full_description'] . "\n";
        $resp = $this->send('Encounter', 'observ', $this->buildReferralEncounter($o, $visitId));
      } else {
        // echo "  - Observations display: " . $o['display'] . "  Description else: " . $o['full_description'] . "\n";
        // $resp = $this->send('Observation','vital-signs', $this->buildObservation($o, $visitId));
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
