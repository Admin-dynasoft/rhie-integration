<?php

define('APP_ROOT', realpath(__DIR__ . '/../../'));
define('RHIE_BATCH_DIRECT', true);

require_once __DIR__ . '/batch_helpers.php';
require_once APP_ROOT . '/config/hie_link.php';

$startedAt = rhieBatchInitRuntime('batch_status');

$facilities = getAllFacilities();
$summary = [
    'generated_at' => date('c'),
    'facility_count' => count($facilities),
    'facilities' => [],
    'totals' => [
        'visits_pending' => 0,
        'observations_pending' => 0,
        'referrals_pending' => 0,
        'retry_queue_pending' => 0,
    ],
];

require_once APP_ROOT . '/rhie/models/UploadQueueModel.php';

foreach ($facilities as $facility) {
    $facilityId = (int) $facility['id'];
    $db = getFacilityPDOConnection($facilityId);

    if (!$db) {
        continue;
    }

    $backlog = rhieBatchCollectBacklog($db);
    $summary['facilities'][] = [
        'id' => $facilityId,
        'db_name' => $facility['db_name'] ?? '',
        'backlog' => $backlog,
    ];

    foreach ($summary['totals'] as $key => $value) {
        $summary['totals'][$key] += (int) ($backlog[$key] ?? 0);
    }
}

$statusFile = rhieBatchConfig()['status_file'];
$lastRuns = is_readable($statusFile)
    ? json_decode((string) file_get_contents($statusFile), true)
    : [];

$summary['last_runs'] = $lastRuns;
$summary['recommended_cron_minutes'] = rhieBatchConfig()['recommended_cron_minutes'];

echo json_encode($summary, JSON_PRETTY_PRINT) . PHP_EOL;

rhieBatchFinish($startedAt, 'batch_status');
