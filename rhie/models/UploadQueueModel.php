<?php

class UploadQueueModel
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function tableExists(): bool
    {
        try {
            $stmt = $this->db->query("SHOW TABLES LIKE 'rhie_upload_queue'");
            return (bool) $stmt->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    }

    public function enqueueTransfer(
        int $clientId,
        string $encounterDate,
        int $referralId = 0,
        string $error = ''
    ): bool {
        if (!$this->tableExists()) {
            return $this->enqueueFileFallback($clientId, $encounterDate, $referralId, $error);
        }

        $sql = "INSERT INTO rhie_upload_queue
                (client_id, referral_id, encounter_date, upload_type, last_error, next_retry_at, status)
                VALUES (?, ?, ?, 'transfer', ?, NOW(), 'pending')";

        // Avoid duplicate pending rows for same client/date/type.
        $exists = $this->db->prepare(
            "SELECT id FROM rhie_upload_queue
             WHERE client_id = ? AND encounter_date = ? AND upload_type = 'transfer'
               AND status IN ('pending','processing')
             LIMIT 1"
        );
        $exists->execute([$clientId, $encounterDate]);

        if ($exists->fetchColumn()) {
            return true;
        }

        $stmt = $this->db->prepare(
            "INSERT INTO rhie_upload_queue
             (client_id, referral_id, encounter_date, upload_type, last_error, next_retry_at, status)
             VALUES (?, ?, ?, 'transfer', ?, NOW(), 'pending')"
        );

        return $stmt->execute([
            $clientId,
            $referralId ?: null,
            $encounterDate,
            $error,
        ]);
    }

    public function fetchDue(int $limit = 5): array
    {
        if (!$this->tableExists()) {
            return [];
        }

        $sql = "SELECT *
                FROM rhie_upload_queue
                WHERE status = 'pending'
                  AND next_retry_at <= NOW()
                  AND attempts < max_attempts
                ORDER BY next_retry_at ASC, id ASC
                LIMIT " . (int) $limit;

        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function markProcessing(int $id): void
    {
        $stmt = $this->db->prepare(
            "UPDATE rhie_upload_queue
             SET status = 'processing', updated_at = NOW()
             WHERE id = ?"
        );
        $stmt->execute([$id]);
    }

    public function markDone(int $id): void
    {
        $stmt = $this->db->prepare(
            "UPDATE rhie_upload_queue
             SET status = 'done', updated_at = NOW()
             WHERE id = ?"
        );
        $stmt->execute([$id]);
    }

    public function markRetry(int $id, string $error, int $attempts): void
    {
        $delayMinutes = min(60, (int) pow(2, min($attempts, 6)));

        $stmt = $this->db->prepare(
            "UPDATE rhie_upload_queue
             SET status = 'pending',
                 attempts = ?,
                 last_error = ?,
                 next_retry_at = DATE_ADD(NOW(), INTERVAL {$delayMinutes} MINUTE),
                 updated_at = NOW()
             WHERE id = ?"
        );
        $stmt->execute([$attempts, $error, $id]);
    }

    public function markFailed(int $id, string $error, int $attempts): void
    {
        $stmt = $this->db->prepare(
            "UPDATE rhie_upload_queue
             SET status = 'failed',
                 attempts = ?,
                 last_error = ?,
                 updated_at = NOW()
             WHERE id = ?"
        );
        $stmt->execute([$attempts, $error, $id]);
    }

    public function countPending(): int
    {
        if (!$this->tableExists()) {
            return 0;
        }

        return (int) $this->db->query(
            "SELECT COUNT(*) FROM rhie_upload_queue WHERE status IN ('pending','processing')"
        )->fetchColumn();
    }

    private function enqueueFileFallback(
        int $clientId,
        string $encounterDate,
        int $referralId,
        string $error
    ): bool {
        require_once dirname(__DIR__) . '/batches/batch_helpers.php';
        rhieBatchEnsureLogDir();

        $entry = [
            'client_id' => $clientId,
            'referral_id' => $referralId,
            'encounter_date' => $encounterDate,
            'upload_type' => 'transfer',
            'error' => $error,
            'queued_at' => date('c'),
        ];

        $file = rhieBatchConfig()['log_dir'] . '/retry_queue.jsonl';
        return (bool) file_put_contents($file, json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}
