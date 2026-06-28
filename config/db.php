<?php
    /**
     * config/db.php
     *
     * Loads environment variables from .env (without any external dependency),
     * validates BASE_URL, then configures the PDO connection.
     *
     * @package MedisoftV2
     */

    /**
     * Load a .env file into getenv() and $_ENV
     */
    function loadDotEnv(string $filepath): void
    {
        if (! file_exists($filepath)) {
            return;
        }

        $lines = file($filepath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            // skip comments and blank lines
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            // split on the first “=”
            list($key, $value) = array_map('trim', explode('=', $line, 2));
            // remove surrounding quotes if present
            if (preg_match('/^"(.*)"$/', $value, $m) || preg_match("/^'(.*)'$/", $value, $m)) {
                $value = $m[1];
            }
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }

    // 1) load .env from project root
    loadDotEnv(__DIR__ . '/../.env');

    // 2) fetch our config values
    $dbhost   = getenv('DB_HOST');
    $dbname   = getenv('DB_NAME');
    $dbuser   = getenv('DB_USER');
    $dbpass   = getenv('DB_PASS');
    $baseUrl  = getenv('BASE_URL');

    // 3) Validate BASE_URL
    define('BASE_URL', $baseUrl);
    function validateBaseUrl(string $url): void
    {
        if (empty($url) || $url[0] !== '/') {
            throw new Exception("BASE_URL must start with a slash. Provided: {$url}");
        }
        $fullPath = $_SERVER['DOCUMENT_ROOT'] . $url;
        if (! is_dir($fullPath)) {
            throw new Exception("BASE_URL directory not found: {$fullPath}");
        }
    }
    validateBaseUrl(BASE_URL);

    // 4) Create PDO
    $dsn = "mysql:host={$dbhost};dbname={$dbname};charset=utf8";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, $dbuser, $dbpass, $options);
