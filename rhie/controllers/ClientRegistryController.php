<?php
require_once __DIR__ . '/../../link_base_url.php';
require_once __DIR__ . '/../config/upid_filter.php';

class ClientRegistryController
{
  private $model;
  private $hie_url;
  private $hie_username;
  private $hie_password;
  private $directMode = false;

  public function __construct($model, $config)
  {
    $this->model = $model;
    $this->hie_url = $config['url']; // http://197.243.24.138:5001
    $this->hie_username = $config['username'];
    $this->hie_password = $config['password'];
    $this->directMode = !empty($config['direct']);
  }

  /**
   * Main entry point
   */
  public function processClient($clientID, $facility_id)
  {
    $upids = $this->model->getUpidsByClient($clientID);

    if (empty($upids)) {
      echo json_encode([
        "success" => false,
        "message" => "No UPIDs found for client ID: $clientID",
        "log" => []
      ], JSON_PRETTY_PRINT);
      return;
    }

    $log = [];

    foreach ($upids as $upid) {

      $upid = rhieSanitizeUpid($upid) ?? '';

      if ($upid === '' || rhieUpidIsExcluded($upid)) {
        continue;
      }

      $entry = [
        "client_id" => $clientID,
        "upid" => $upid,
        "steps" => []
      ];

      // --------------------------------------------------
      // STEP 1: Fetch local data
      // --------------------------------------------------
      $data = $this->getClientDataFromAPI($upid, $facility_id);

      if (!$data) {
        $entry['steps'][] = [
          "step" => "fetch_local_data",
          "success" => false,
          "message" => "No local data found BASE_URL: " . BASE_URL
        ];
        $this->model->updateUpidStatus($upid, 3);
        $log[] = $entry;
        continue;
      }

      $entry['steps'][] = [
        "step" => "fetch_local_data",
        "success" => true,
        "data" => $data
      ];

      // --------------------------------------------------
      // STEP 2: Build FHIR Patient payload
      // --------------------------------------------------
      $patientPayload = $this->buildPatientPayload($data);

      $entry['steps'][] = [
        "step" => "build_patient_payload",
        "payload" => $patientPayload
      ];

      // --------------------------------------------------
      // STEP 3: Send to HIE
      // --------------------------------------------------
      $result = $this->sendToHIE($patientPayload);

      $entry['steps'][] = [
        "step" => "send_to_hie",
        "success" => $result['success'],
        "http_status" => $result['status'] ?? null,
        "response" => $result['response'] ?? null
      ];

      // --------------------------------------------------
      // STEP 4: Update status
      // --------------------------------------------------
      if ($result['success']) {
        $this->model->updateUpidStatus($upid, 2);
      } else {
        $this->model->updateUpidStatus($upid, 3);
      }

      $log[] = $entry;
    }

    echo json_encode([
      "success" => true,
      "message" => "Client registry process completed",
      "log" => $log
    ], JSON_PRETTY_PRINT);
  }

  /**
   * Build Patient payload EXACTLY as accepted by HIE
   */
  private function buildPatientPayload(array $data): array
  {
    // Gender normalization
    $gender = in_array(strtolower($data['gender']), ['m', 'male', '1']) ? 'male' : 'female';

    // Name split
    $names  = explode(' ', trim($data['full_names']));
    $given  = $data['last_name'];
    $family = $data['first_name'];

    // Marital status mapping
    $maritalMap = [
      '0' => ['code' => 'S', 'display' => 'Single'],
      '1' => ['code' => 'M', 'display' => 'Married'],
      '2' => ['code' => 'W', 'display' => 'Widowed'],
      '3' => ['code' => 'D', 'display' => 'Divorced'],
    ];

    $ms = $maritalMap[$data['marital_status']] ?? $maritalMap['0'];
    $upid = rhieSanitizeUpid($data['UPID'] ?? null) ?? '';

    return [
      "resourceType" => "Patient",

      // REQUIRED by this registry (non-standard FHIR)
      "id" => $upid,
      // "id" => "602645-3179-7909",

      "identifier" => [
        [
          "system" => "UPI",
          "value"  => $upid
        ],
        [
          "system" => "NID",
          "value"  => $data['nida']
        ]
      ],

      "active" => true,

      "name" => [
        [
          "family" => $family,
          "given"  => [$given]
        ]
      ],

      "gender"     => $gender,
      "birthDate" => $data['birthdate'],
      "deceasedBoolean" => true,

      "telecom" => [
        [
          "system" => "phone",
          "value"  => "+25" . $data['phone'],
          "use"    => "mobile"
        ]
      ],

      // ONLY ONE address – exactly as registry expects
      "address" => [
        [
          "type"       => "physical",
          "country"    => "Rwanda",
          "state"      => $data['state'],
          "district"   => $data['district'],
          "line"       => $data['line'],
          "city"       => $data['state'],
          "postalCode" => ""
        ]
      ],

      "maritalStatus" => [
        "coding" => [
          [
            "system"  => "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
            "code"    => $ms['code'],
            "display" => $ms['display']
          ]
        ]
      ],

      // REQUIRED but empty (registry quirk)
      "extension" => [
        new stdClass()
      ]
    ];
  }

  /**
   * Fetch local mapped patient data
   */
  private function getClientDataFromAPI(string $upid, int $facility_id): ?array
  {
    if (!empty($this->directMode)) {
      require_once __DIR__ . '/../../config/hie_link.php';
      $db = getFacilityPDOConnection($facility_id);

      if (!$db) {
        return null;
      }

      $model = new ClientRegistryModel($db);
      return $model->getClientDataByUpid($upid);
    }

    echo "Fetching local data for UPID: {$upid} and Facility ID: {$facility_id} from API..." . PHP_EOL;

    $url = "https://medisoft.rw/rhie/api/view_upid_data.php?upid="
      . urlencode($upid)
      . "&facility_id="
      . urlencode($facility_id);

    $ch = curl_init($url);

    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_HTTPHEADER => [
        'Accept: application/json'
      ]
    ]);

    $response = curl_exec($ch);

    if ($response === false) {

      curl_close($ch);

      return null;
    }

    curl_close($ch);

    $decoded = json_decode($response, true);

    if (
      !$decoded ||
      empty($decoded['success']) ||
      empty($decoded['data'])
    ) {
      return null;
    }

    return $decoded['data'];
  }


  /**
   * Send Patient to HIE Client Registry
   */
  private function sendToHIE(array $payload): array
  {
    $ch = curl_init($this->hie_url . "/clientregistry/Patient");

    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        'Content-Type: application/fhir+json',
        'Accept: application/fhir+json'
      ],
      CURLOPT_USERPWD => $this->hie_username . ':' . $this->hie_password,
      CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES)
    ]);

    $response = curl_exec($ch);
    $status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($response === false) {
      $error = curl_error($ch);
      curl_close($ch);

      return [
        'success' => false,
        'status' => null,
        'response' => $error
      ];
    }

    curl_close($ch);

    return [
      'success' => in_array($status, [200, 201]),
      'status' => $status,
      'response' => json_decode($response, true) ?? $response
    ];
  }
}
