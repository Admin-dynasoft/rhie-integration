<?php
/**
 * RHIE – Client Registry Batch
 * File: rhie/batches/client_registry_batch.php
 */

define('APP_ROOT', realpath(__DIR__ . '/../../'));

$batchName = 'client_registry_batch';
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

if (!APP_ROOT) {
    echo "❌ Failed to resolve APP_ROOT\n";
    exit(1);
}

/*
|--------------------------------------------------------------------------
| LOAD FILES
|--------------------------------------------------------------------------
*/
require_once APP_ROOT . '/config/hie_link.php';
require_once APP_ROOT . '/link_base_url.php';

require_once APP_ROOT . '/rhie/models/ClientRegistryModel.php';
require_once APP_ROOT . '/rhie/controllers/ClientRegistryController.php';

require_once APP_ROOT . '/config/hie.php';

/*
|--------------------------------------------------------------------------
| HIE CONFIG
|--------------------------------------------------------------------------
*/
$config = [
    'url' => $hie_url,
    'username' => $hie_username,
    'password' => $hie_password,
    'local_api_url' => BASE_URL,
    'direct' => true,
];

/*
|--------------------------------------------------------------------------
| GET ALL FACILITIES
|--------------------------------------------------------------------------
*/
$facilities = rhieBatchFacilitySlice(getAllFacilities());

if (empty($facilities)) {

    echo "❌ No facilities found.\n";

    exit(1);
}

/*
|--------------------------------------------------------------------------
| START BATCH
|--------------------------------------------------------------------------
*/
echo "========================================\n";
echo "🚀 RHIE CLIENT REGISTRY MULTI-FACILITY\n";
echo "========================================\n";

/*
|--------------------------------------------------------------------------
| LOOP FACILITIES
|--------------------------------------------------------------------------
*/
foreach ($facilities as $facility) {

    $facilityID   = $facility['id'];
    $facilityName = $facility['db_name'];
    $facilityCode = $facility['fosaid'];

    echo "\n";
    echo "========================================\n";
    echo "🏥 Facility: {$facilityName}\n";
    echo "🏷 Code: {$facilityCode}\n";
    echo "========================================\n";

    try {

        /*
        |--------------------------------------------------------------------------
        | CONNECT FACILITY DB
        |--------------------------------------------------------------------------
        */
        $db = getFacilityPDOConnection($facilityID);
        if (!$db) {
            echo "❌ Failed connecting facility database.\n";
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | INIT MVC
        |--------------------------------------------------------------------------
        */
        $model = new ClientRegistryModel($db);
        $controller = new ClientRegistryController($model, $config);

        /*
        |--------------------------------------------------------------------------
        | TESTING MODE
        |--------------------------------------------------------------------------
        | ONLY THOSE CLIENTS WHO HAVE BEEN REFERRALED (referral = true) WILL BE PROCESSED
        |--------------------------------------------------------------------------
        */
        $sql = "SELECT DISTINCT
                up.patient_id
            FROM upid_patients up
            INNER JOIN referral r
                ON up.patient_id = r.client_id
            INNER JOIN patients p
                ON up.patient_id = p.patient_id
            WHERE up.status IN (0,1,3)
                AND up.upid NOT LIKE 'UP%'
                AND up.document_number IS NOT NULL
                AND up.document_number NOT LIKE 'TP-%'
                AND p.age IS NOT NULL
                AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            ORDER BY up.patient_id ASC ";
        $stmt = $db->prepare($sql);
        $stmt->execute();

        $clientIDs = $stmt->fetchAll(PDO::FETCH_COLUMN);

        /*
        |--------------------------------------------------------------------------
        | NO CLIENTS
        |--------------------------------------------------------------------------
        */
        if (empty($clientIDs)) {
            echo "⚠ No matching clients found.\n";
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | PROCESS CLIENTS
        |--------------------------------------------------------------------------
        */

        $clientLimit = (int) rhieBatchConfig()['max_clients_registry_per_run'];
        $processedClients = 0;

        foreach ($clientIDs as $clientID) {
            if (rhieBatchShouldStop() || $processedClients >= $clientLimit) {
                break;
            }

            echo "\n";
            echo "▶ Processing Client ID: {$clientID}\n";
            echo "facility_id: {$facilityID}\n";
            try {
                ob_start();
                $controller->processClient($clientID, $facilityID);
                $output = ob_get_clean();
                echo "✔ Upload Result:\n";
                echo $output . "\n";
            } catch (Throwable $e) {
                echo "❌ Error processing client {$clientID}\n";
                echo "Message: {$e->getMessage()}\n";
                try {
                    $model->markClientAsFailed($clientID);
                } catch (Throwable $inner) {
                    echo "⚠ Failed updating status.\n";
                }
            }
            echo "----------------------------------------\n";
            $processedClients++;
        }

    } catch (Throwable $e) {

        echo "❌ Facility Error: {$e->getMessage()}\n";
    }
}

/*
|--------------------------------------------------------------------------
| DONE
|--------------------------------------------------------------------------
*/
echo "========================================\n";
echo "✅ MULTI-FACILITY BATCH COMPLETED\n";
echo "========================================\n";

if (!$isChild) {
    rhieBatchFinish($batchStartedAt ?? microtime(true), $batchName);
}