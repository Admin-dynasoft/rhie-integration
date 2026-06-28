<?php

define('APP_ROOT', realpath(__DIR__ . '/../../'));

$batchName = 'process_upload_retry_batch';
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

require_once APP_ROOT . '/config/hie_link.php';
require_once APP_ROOT . '/config/hie.php';
require_once APP_ROOT . '/rhie/models/UploadQueueModel.php';
require_once APP_ROOT . '/rhie/services/RealtimeTransferService.php';

$limit = (int) rhieBatchConfig()['retry_batch_max_records'];
$processed = 0;
$failed = 0;

echo "🔄 STARTING UPLOAD RETRY BATCH (limit {$limit})" . PHP_EOL;

foreach (rhieBatchFacilitySlice(getAllFacilities()) as $facility) {
    if (rhieBatchShouldStop()) {
        break;
    }

    $facilityId = (int) $facility['id'];
    $db = getFacilityPDOConnection($facilityId);

    if (!$db) {
        continue;
    }

    $queue = new UploadQueueModel($db);
    $rows = $queue->fetchDue($limit);

    foreach ($rows as $row) {
        if (rhieBatchShouldStop() || $processed >= $limit) {
            break 2;
        }

        $queue->markProcessing((int) $row['id']);
        $service = new RealtimeTransferService();
        $result = $service->processAfterReferralSave(
            $db,
            $facilityId,
            (int) $row['client_id'],
            $row['encounter_date'] . ' 00:00:00',
            (int) ($row['referral_id'] ?? 0),
            true
        );

        $attempts = ((int) $row['attempts']) + 1;

        if (!empty($result['success'])) {
            $queue->markDone((int) $row['id']);
            $processed++;
            echo "✔ Retry success client {$row['client_id']} date {$row['encounter_date']}" . PHP_EOL;
        } elseif ($attempts >= (int) $row['max_attempts']) {
            $queue->markFailed((int) $row['id'], $result['message'] ?? 'retry failed', $attempts);
            $failed++;
            echo "❌ Retry permanently failed queue #{$row['id']}" . PHP_EOL;
        } else {
            $queue->markRetry((int) $row['id'], $result['message'] ?? 'retry failed', $attempts);
            $failed++;
            echo "↻ Retry rescheduled queue #{$row['id']} attempt {$attempts}" . PHP_EOL;
        }
    }
}

rhieBatchRecordStageMetric($batchName, $processed, $failed);

echo "✅ UPLOAD RETRY BATCH FINISHED processed={$processed} failed={$failed}" . PHP_EOL;

if (!$isChild) {
    rhieBatchFinish($batchStartedAt ?? microtime(true), $batchName);
}
