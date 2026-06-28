<?php
// rhie/batches/upload_visit_ref_encounters_batch.php

ini_set('memory_limit', '500M');

ini_set('max_execution_time', 0);

/*
|--------------------------------------------------------------------------
| ROOT
|--------------------------------------------------------------------------
*/
define('APP_ROOT', realpath(__DIR__ . '/../../'));

$batchName = 'upload_visit_encounters_batch';
$isChild = defined('RHIE_BATCH_CHILD') && RHIE_BATCH_CHILD;

require_once __DIR__ . '/batch_helpers.php';

if (!$isChild) {
  if (!rhieBatchAcquireLock($batchName)) {
    exit(0);
  }
  if (!defined('RHIE_BATCH_DIRECT')) {
    define('RHIE_BATCH_DIRECT', true);
  }
  $batchStartedAt = rhieBatchInitRuntime($batchName);
}

/*
|--------------------------------------------------------------------------
| LOAD FILES
|--------------------------------------------------------------------------
*/
require_once APP_ROOT . '/config/hie_link.php';

require_once APP_ROOT . '/link_base_url.php';

require_once APP_ROOT . '/config/hie.php';

require_once APP_ROOT . '/rhie/models/UploadEncounterModel.php';

require_once APP_ROOT . '/rhie/controllers/UploadVisitEncounterController.php';

/*
|--------------------------------------------------------------------------
| HIE CREDENTIALS
|--------------------------------------------------------------------------
*/
$creds = [
  'url'      => $hie_url,
  'username' => $hie_username,
  'password' => $hie_password
];

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/
echo PHP_EOL;
echo "==================================================" . PHP_EOL;
echo "🚀 STARTING MULTI-FACILITY VISIT UPLOAD BATCH" . PHP_EOL;
echo "==================================================" . PHP_EOL;

/*
|--------------------------------------------------------------------------
| GET FACILITIES
|--------------------------------------------------------------------------
*/
$facilities = rhieBatchFacilitySlice(getAllFacilities());

if (empty($facilities)) {

  echo "❌ No facilities found." . PHP_EOL;

  exit;
}

/*
|--------------------------------------------------------------------------
| LOOP FACILITIES
|--------------------------------------------------------------------------
*/
foreach ($facilities as $facility) {

  if (rhieBatchShouldStop()) {
    break;
  }

  $facilityID = $facility['id'];

  $facilityName = $facility['db_name'];

  $fosaid = $facility['fosaid'];

  echo PHP_EOL;
  echo "==================================================" . PHP_EOL;
  echo "🏥 FACILITY: {$facilityName}" . PHP_EOL;
  echo "🏷 FOSAID: {$fosaid}" . PHP_EOL;
  echo "🆔 FACILITY ID: {$facilityID}" . PHP_EOL;
  echo "==================================================" . PHP_EOL;

  try {

    /*
        |--------------------------------------------------------------------------
        | FACILITY CONNECTION
        |--------------------------------------------------------------------------
        */
    $db = getFacilityPDOConnection($facilityID);

    if (!$db) {

      echo "❌ Failed connecting facility database." . PHP_EOL;

      continue;
    }

    rhieBatchLogFacilityBacklog($facilityID, $facilityName, $db);

    /*
        |--------------------------------------------------------------------------
        | MVC
        |--------------------------------------------------------------------------
        */
    $model = new UploadEncounterModel($db);

    $controller = new UploadVisitEncounterController(
      $model,
      $creds
    );

    /*
        |--------------------------------------------------------------------------
        | FETCH VISIT ENCOUNTERS
        |--------------------------------------------------------------------------
        */
        // from patients the only format of age we need is YYYY-MM-DD, not this type: 14-02-1987 or other formats, we only need YYYY-MM-DD
    $sql = "SELECT DISTINCT
        em.client_id,
        up.upid,
        em.date,
        p.age,
        em.encount_id AS resource_encount_id
      FROM encounter_main em
      /*JOIN referral r ON em.client_id = r.client_id*/
      LEFT JOIN upid_patients up ON em.client_id = up.client_id
      LEFT JOIN patients p ON em.client_id = p.patient_id
      WHERE type IN ('E_TRANSFER')
      AND em.rhie_status = 2 AND up.status = 2
      AND up.upid NOT LIKE 'UP%'
      AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
      AND p.age IS NOT NULL
      AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      ORDER BY date ASC
      LIMIT " . (int) rhieBatchRecordLimit() . "
    ";

    $stmt = $db->prepare($sql);

    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /*
        |--------------------------------------------------------------------------
        | NOTHING TO UPLOAD
        |--------------------------------------------------------------------------
        */
    if (!$rows) {

      echo "✅ Nothing to upload." . PHP_EOL;

      continue;
    }

    /*
        |--------------------------------------------------------------------------
        | PROCESS ENCOUNTERS
        |--------------------------------------------------------------------------
        */
    foreach ($rows as $r) {

      if (rhieBatchShouldStop()) {
        break 2;
      }

      try {

        $result = $controller->upload($r['client_id'], $r['date'], 'E_TRANSFER',$facilityID);

        echo "-----------------------------" . PHP_EOL;

        echo json_encode([
          "facility_id"         => $facilityID,
          "facility_name"       => $facilityName,
          "we are in"           =>"transfer batch",
          "status"              => "success",
          "date"                => $r['date'],
          "client_id"           => $r['client_id'],
          "upid"                => $r['upid'],
          "resource_encount_id" => $r['resource_encount_id'],
          "response"            => $result
        ], JSON_PRETTY_PRINT);

        echo PHP_EOL;
      } catch (Throwable $e) {

        echo "❌ Upload Error for Client ID {$r['client_id']}" . PHP_EOL;

        echo "Message: {$e->getMessage()}" . PHP_EOL;

        continue;
      }
    }
  } catch (Throwable $e) {

    /*
        |--------------------------------------------------------------------------
        | FACILITY FAILURE
        |--------------------------------------------------------------------------
        */
    echo "❌ FACILITY FAILURE: {$facilityName}" . PHP_EOL;

    echo "Message: {$e->getMessage()}" . PHP_EOL;

    continue;
  }
}

/*
|--------------------------------------------------------------------------
| FINISHED
|--------------------------------------------------------------------------
*/
echo PHP_EOL;
echo "==================================================" . PHP_EOL;
echo "✅ MULTI-FACILITY VISIT UPLOAD BATCH FINISHED" . PHP_EOL;
echo "==================================================" . PHP_EOL;

if (!$isChild) {
  rhieBatchFinish($batchStartedAt ?? microtime(true), $batchName);
}
