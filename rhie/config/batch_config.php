<?php

return [
    'lock_dir' => sys_get_temp_dir(),
    'log_dir' => dirname(__DIR__) . '/logs',
    'metrics_file' => dirname(__DIR__) . '/logs/batch_metrics.jsonl',
    'status_file' => dirname(__DIR__) . '/logs/batch_status.json',
    'max_execution_seconds' => 540,
    'alert_runtime_seconds' => 480,
    'recommended_cron_minutes' => 15,
    'lock_ttl_seconds' => 7200,
    'use_db_lock' => true,
    'max_facilities_per_run' => 2,
    'max_records_per_batch' => 25,
    'max_clients_registry_per_run' => 15,
    'retry_batch_max_records' => 5,
    'facility_state_file' => sys_get_temp_dir() . '/rhie_facility_offset.txt',
    'enable_transfer_batch' => false,
    'transfer_batch_max_records' => 5,
    'memory_limit' => '256M',
    'master_lock_name' => 'rhie_master_batch',
];
