<?php
// rhie/batches/generate_encounters_batch.php

ini_set('memory_limit', '500M');
ini_set('max_execution_time', 0);

/*
|--------------------------------------------------------------------------
| ROOT
|--------------------------------------------------------------------------
*/
define('APP_ROOT', realpath(__DIR__ . '/../../'));

$batchName = 'generate_encounters_batch';
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

require_once APP_ROOT . '/rhie/models/EncounterModel.php';

require_once APP_ROOT . '/rhie/controllers/EncounterController.php';

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/
echo PHP_EOL;
echo "==============================================" . PHP_EOL;
echo "🟡 STARTING MULTI-FACILITY ENCOUNTER BATCH" . PHP_EOL;
echo "==============================================" . PHP_EOL;

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
        | CONNECT FACILITY DATABASE
        |--------------------------------------------------------------------------
        */
        $db = getFacilityPDOConnection($facilityID);

        if (!$db) {

            echo "❌ Failed connecting facility database." . PHP_EOL;

            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | CONTROLLER
        |--------------------------------------------------------------------------
        */
        $controller = new EncounterController($db);
        $generate_from = date('Y-m-d');

        /*
        |--------------------------------------------------------------------------
        | VISIT ENCOUNTERS
        |--------------------------------------------------------------------------
        */
        try {

            echo "🔸 Generating visit encounters..." . PHP_EOL;
            
            $visitResult = $controller->generateEncountersVisit($generate_from);

            echo "✅ Visit: " . ($visitResult['message'] ?? 'No message') . PHP_EOL;
        } catch (Throwable $e) {

            echo "❌ Visit Error: {$e->getMessage()}" . PHP_EOL;
        }

        /*
        |--------------------------------------------------------------------------
        | E-TRANSFER
        |--------------------------------------------------------------------------
        */
        try {

            echo "🔸 Generating E-transfer..." . PHP_EOL;
            $start_from='2026-06-20';
            $visitResult = $controller->generateEncountersTransfer($start_from);

            echo "✅ E-Transfer: " . ($visitResult['message'] ?? 'No message') . PHP_EOL;

        } catch (Throwable $e) {

            echo "❌ Visit Error: {$e->getMessage()}" . PHP_EOL;
        }


        /*
        |--------------------------------------------------------------------------
        | REFERRAL ENCOUNTERS
        |--------------------------------------------------------------------------
        */
        try {

            echo "🔸 Generating referral encounters..." . PHP_EOL;

            $referralResult = $controller->generateReferralEncounters($generate_from);

            echo "✅ Referral: " . ($referralResult['message'] ?? 'No message') . PHP_EOL;

        } catch (Throwable $e) {

            echo "❌ Referral Error: {$e->getMessage()}" . PHP_EOL;
        }

    } catch (Throwable $e) {

        /*
        |--------------------------------------------------------------------------
        | FACILITY LEVEL ERROR
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
echo "🎉 MULTI-FACILITY ENCOUNTER BATCH COMPLETED" . PHP_EOL;
echo "==================================================" . PHP_EOL;

if (!$isChild) {
    rhieBatchFinish($batchStartedAt ?? microtime(true), $batchName);
}
