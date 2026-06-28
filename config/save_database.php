<?php
// config/save_database.php

if ($_SERVER['REQUEST_METHOD'] == 'POST') {

    $selectedDatabase = trim($_POST['database']);

    if (empty($selectedDatabase)) {
        die("No database selected.");
    }

    /*
    |--------------------------------------------------------------------------
    | CONFIG FILE PATH
    |--------------------------------------------------------------------------
    */

    $configFile = __DIR__ . '/database_config.php';

    /*
    |--------------------------------------------------------------------------
    | LOAD CURRENT CONFIG
    |--------------------------------------------------------------------------
    */

    $oldConfig = include $configFile;

    $currentDatabase = $oldConfig['current_database'] ?? '';

    /*
    |--------------------------------------------------------------------------
    | GENERATE NEW CONFIG CONTENT
    |--------------------------------------------------------------------------
    */

    $content = "<?php\n\nreturn [\n\n" .
        "    'host' => '127.0.0.1',\n" .
        "    'username' => 'root',\n" .
        "    'password' => 'raymond1',\n\n" .
        "    'current_database' => '{$selectedDatabase}',\n" .
        "    'previous_database' => '{$currentDatabase}'\n\n" .
        "];";

    /*
    |--------------------------------------------------------------------------
    | SAVE CONFIG
    |--------------------------------------------------------------------------
    */

    $saved = file_put_contents($configFile, $content);

    if (!$saved) {
        die("Failed to write database config file.");
    }

    /*
    |--------------------------------------------------------------------------
    | REDIRECT
    |--------------------------------------------------------------------------
    */

    header("Location: database_selector.php?success=1");

    exit;
}