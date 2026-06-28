<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

define('APP_ROOT', realpath(__DIR__ . '/../../'));
define('RHIE_BATCH_DIRECT', true);

require_once __DIR__ . '/batch_helpers.php';

$config = rhieBatchConfig();

if (!rhieBatchAcquireLock($config['master_lock_name'])) {
    exit(0);
}

$startedAt = rhieBatchInitRuntime('master_batch');
$totalProcessed = 0;
$totalFailed = 0;

$batches = [
    __DIR__ . '/client_registry_batch.php',
    __DIR__ . '/generate_encounters_batch.php',
    // __DIR__ . '/upload_visit_encounters_batch.php',
    // __DIR__ . '/upload_visit_ref_encounters_batch.php',
    // __DIR__ . '/process_upload_retry_batch.php',
];

if (!empty($config['enable_transfer_batch'])) {
    $batches[] = __DIR__ . '/upload_visit_ref_encounters_batch.php';
}

$batches[] = __DIR__ . '/upload_encounters_batch.php';

define('RHIE_BATCH_CHILD', true);

foreach ($batches as $batch) {
    if (rhieBatchShouldStop()) {
        rhieBatchLog('Stopping master_batch before ' . basename($batch));
        break;
    }

    $batchStarted = microtime(true);
    rhieBatchLog('Running ' . basename($batch));

    try {
        include $batch;
        $duration = round(microtime(true) - $batchStarted, 2);
        rhieBatchLog('Finished ' . basename($batch) . " in {$duration}s");
        rhieBatchRecordStageMetric(basename($batch), 1, 0, ['duration_seconds' => $duration]);
    } catch (Throwable $e) {
        rhieBatchLog('ERROR in ' . basename($batch) . ': ' . $e->getMessage());
        rhieBatchRecordStageMetric(basename($batch), 0, 1, ['error' => $e->getMessage()]);
        $totalFailed++;
        break;
    }
}

rhieBatchWriteStatus([
    'channel' => 'master_batch',
    'started_at' => $GLOBALS['rhie_batch_started_iso'] ?? date('c'),
    'processed_stages' => count($batches) - $totalFailed,
    'failed_stages' => $totalFailed,
]);

rhieBatchFinish($startedAt, 'master_batch');
