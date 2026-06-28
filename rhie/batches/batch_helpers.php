<?php

require_once dirname(__DIR__) . '/config/batch_config.php';

function rhieBatchConfig(): array
{
    static $config = null;

    if ($config === null) {
        $config = require dirname(__DIR__) . '/config/batch_config.php';
    }

    return $config;
}

function rhieBatchEnsureLogDir(): void
{
    $dir = rhieBatchConfig()['log_dir'];

    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

function rhieBatchLog(string $message, string $channel = 'master_batch'): void
{
    rhieBatchEnsureLogDir();

    $line = '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    $file = rhieBatchConfig()['log_dir'] . '/' . $channel . '.log';

    file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

function rhieBatchLockPath(string $name): string
{
    $config = rhieBatchConfig();

    return rtrim($config['lock_dir'], '/') . '/' . $name . '.lock';
}

function rhieBatchAcquireLock(string $name): bool
{
    $config = rhieBatchConfig();

    if (!empty($config['use_db_lock']) && rhieBatchAcquireDbLock($name)) {
        $GLOBALS['rhie_batch_db_lock_name'] = $name;
        register_shutdown_function('rhieBatchReleaseDbLock');
    }

    $path = rhieBatchLockPath($name);

    if (rhieBatchIsStaleLock($path, (int) $config['lock_ttl_seconds'])) {
        rhieBatchLog("Breaking stale lock metadata for {$name}", $name);
        @unlink($path);
    }

    $handle = fopen($path, 'c+');

    if ($handle === false) {
        rhieBatchLog("Unable to open lock file: {$path}", $name);
        return false;
    }

    if (!flock($handle, LOCK_EX | LOCK_NB)) {
        fclose($handle);
        rhieBatchLog("Another {$name} process is already running. Exiting.", $name);
        return false;
    }

    $meta = json_encode([
        'pid' => getmypid(),
        'started_at' => date('c'),
        'name' => $name,
    ], JSON_UNESCAPED_SLASHES);

    ftruncate($handle, 0);
    fwrite($handle, $meta);
    fflush($handle);

    $GLOBALS['rhie_batch_lock_handle'] = $handle;
    $GLOBALS['rhie_batch_lock_name'] = $name;

    register_shutdown_function('rhieBatchReleaseLock');

    return true;
}

function rhieBatchIsStaleLock(string $path, int $ttlSeconds): bool
{
    if (!is_readable($path)) {
        return false;
    }

    $raw = trim((string) file_get_contents($path));

    if ($raw === '') {
        return false;
    }

    $meta = json_decode($raw, true);

    if (!is_array($meta)) {
        return is_numeric($raw) && !rhieBatchPidAlive((int) $raw);
    }

    if (!empty($meta['pid']) && !rhieBatchPidAlive((int) $meta['pid'])) {
        return true;
    }

    if (!empty($meta['started_at'])) {
        $started = strtotime($meta['started_at']);
        if ($started !== false && (time() - $started) > $ttlSeconds) {
            return empty($meta['pid']) || !rhieBatchPidAlive((int) $meta['pid']);
        }
    }

    return false;
}

function rhieBatchPidAlive(int $pid): bool
{
    if ($pid <= 0) {
        return false;
    }

    if (function_exists('posix_kill')) {
        return @posix_kill($pid, 0);
    }

    return is_dir('/proc/' . $pid);
}

function rhieBatchAcquireDbLock(string $name): bool
{
    if (!function_exists('getCentralPDOConnection')) {
        require_once dirname(__DIR__, 2) . '/config/hie_link.php';
    }

    $pdo = getCentralPDOConnection();

    if (!$pdo) {
        return false;
    }

    $stmt = $pdo->query("SELECT GET_LOCK(" . $pdo->quote('rhie_' . $name) . ", 0)");
    $got = (int) $stmt->fetchColumn();

    return $got === 1;
}

function rhieBatchReleaseDbLock(): void
{
    if (empty($GLOBALS['rhie_batch_db_lock_name'])) {
        return;
    }

    if (!function_exists('getCentralPDOConnection')) {
        require_once dirname(__DIR__, 2) . '/config/hie_link.php';
    }

    $pdo = getCentralPDOConnection();

    if ($pdo) {
        $name = $GLOBALS['rhie_batch_db_lock_name'];
        $pdo->query("SELECT RELEASE_LOCK(" . $pdo->quote('rhie_' . $name) . ")");
    }

    unset($GLOBALS['rhie_batch_db_lock_name']);
}

function rhieBatchReleaseLock(): void
{
    if (empty($GLOBALS['rhie_batch_lock_handle'])) {
        return;
    }

    $handle = $GLOBALS['rhie_batch_lock_handle'];
    flock($handle, LOCK_UN);
    fclose($handle);

    unset($GLOBALS['rhie_batch_lock_handle'], $GLOBALS['rhie_batch_lock_name']);
}

function rhieBatchInitRuntime(string $channel = 'master_batch'): float
{
    $config = rhieBatchConfig();

    ini_set('memory_limit', $config['memory_limit']);
    set_time_limit((int) $config['max_execution_seconds'] + 30);

    $startedAt = microtime(true);
    $GLOBALS['rhie_batch_started_iso'] = date('c');
    $GLOBALS['rhie_batch_started_at'] = $startedAt;
    $GLOBALS['rhie_batch_channel'] = $channel;

    rhieBatchLog("START {$channel}", $channel);

    return $startedAt;
}

function rhieBatchShouldStop(): bool
{
    if (empty($GLOBALS['rhie_batch_started_at'])) {
        return false;
    }

    $elapsed = microtime(true) - $GLOBALS['rhie_batch_started_at'];
    $limit = rhieBatchConfig()['max_execution_seconds'];

    if ($elapsed >= $limit) {
        rhieBatchLog(
            'Time budget reached (' . round($elapsed, 1) . "s >= {$limit}s). Stopping gracefully.",
            $GLOBALS['rhie_batch_channel'] ?? 'master_batch'
        );
        return true;
    }

    return false;
}

function rhieBatchFinish(float $startedAt, string $channel = 'master_batch'): void
{
    $duration = round(microtime(true) - $startedAt, 2);
    rhieBatchLog("END {$channel} in {$duration}s", $channel);

    $alertAfter = (int) rhieBatchConfig()['alert_runtime_seconds'];

    if ($duration >= $alertAfter) {
        rhieBatchLog(
            "ALERT: {$channel} runtime {$duration}s exceeded threshold {$alertAfter}s. Increase cron interval.",
            $channel
        );
    }

    rhieBatchWriteStatus([
        'channel' => $channel,
        'finished_at' => date('c'),
        'duration_seconds' => $duration,
        'alert' => $duration >= $alertAfter,
    ]);
}

function rhieBatchWriteStatus(array $payload): void
{
    rhieBatchEnsureLogDir();
    $file = rhieBatchConfig()['status_file'];
    $existing = [];

    if (is_readable($file)) {
        $existing = json_decode((string) file_get_contents($file), true) ?: [];
    }

    $channel = $payload['channel'] ?? 'master_batch';
    $existing[$channel] = $payload;
    $existing['updated_at'] = date('c');

    file_put_contents($file, json_encode($existing, JSON_PRETTY_PRINT));
}

function rhieBatchRecordStageMetric(string $stage, int $processed, int $failed, array $extra = []): void
{
    rhieBatchEnsureLogDir();

    $entry = array_merge([
        'ts' => date('c'),
        'stage' => $stage,
        'processed' => $processed,
        'failed' => $failed,
    ], $extra);

    file_put_contents(
        rhieBatchConfig()['metrics_file'],
        json_encode($entry) . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}

function rhieBatchCollectBacklog(PDO $db): array
{
    $backlog = [
        'visits_pending' => 0,
        'observations_pending' => 0,
        'referrals_pending' => 0,
        'retry_queue_pending' => 0,
    ];

    try {
        $backlog['visits_pending'] = (int) $db->query(
            "SELECT COUNT(*) FROM encounter_main WHERE type = 'VISIT_ENCOUNTER' AND rhie_status = 2"
        )->fetchColumn();

        $backlog['observations_pending'] = (int) $db->query(
            "SELECT COUNT(*) FROM encounter_patients WHERE rhie_status = 2"
        )->fetchColumn();

        $backlog['referrals_pending'] = (int) $db->query(
            "SELECT COUNT(*) FROM encounter_patients WHERE type = 'referral' AND rhie_status = 2"
        )->fetchColumn();

        require_once dirname(__DIR__) . '/models/UploadQueueModel.php';
        $backlog['retry_queue_pending'] = (new UploadQueueModel($db))->countPending();
    } catch (Throwable $e) {
        $backlog['error'] = $e->getMessage();
    }

    return $backlog;
}

function rhieBatchLogFacilityBacklog(int $facilityId, string $facilityName, PDO $db): void
{
    $backlog = rhieBatchCollectBacklog($db);
    rhieBatchLog(
        "BACKLOG facility={$facilityName} id={$facilityId} " . json_encode($backlog),
        'master_batch'
    );
    rhieBatchRecordStageMetric('backlog_snapshot', 0, 0, [
        'facility_id' => $facilityId,
        'facility_name' => $facilityName,
        'backlog' => $backlog,
    ]);
}

function rhieBatchFacilitySlice(array $facilities): array
{
    if (empty($facilities)) {
        return [];
    }

    $config = rhieBatchConfig();
    $max = max(1, (int) $config['max_facilities_per_run']);
    $stateFile = $config['facility_state_file'];
    $offset = 0;

    if (is_readable($stateFile)) {
        $offset = max(0, (int) trim((string) file_get_contents($stateFile)));
    }

    $total = count($facilities);
    $slice = [];

    for ($i = 0; $i < $max; $i++) {
        $slice[] = $facilities[($offset + $i) % $total];
    }

    file_put_contents($stateFile, (string) (($offset + $max) % $total));

    return $slice;
}

function rhieBatchRecordLimit(int $override = 0): int
{
    $config = rhieBatchConfig();

    return $override > 0 ? $override : max(1, (int) $config['max_records_per_batch']);
}

function rhieBatchResolveFacilityId(?string $dbName = null): ?int
{
    return resolveFacilityIdFromDbName($dbName);
}
