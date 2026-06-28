<?php
// rhie/api/get_upid_api.php
// displays all patients with upid like 'up-%' from kinyinya.upid_patients table
/*
|--------------------------------------------------------------------------
| ROOT
|--------------------------------------------------------------------------
*/
define('APP_ROOT', realpath(__DIR__ . '/../../'));

header('Content-Type: application/json');

/*
|--------------------------------------------------------------------------
| LOAD CONNECTION
|--------------------------------------------------------------------------
*/
require_once APP_ROOT . '/config/hie_link.php';

try {

    /*
    |--------------------------------------------------------------------------
    | CENTRAL DATABASE CONNECTION
    |--------------------------------------------------------------------------
    */
    $db = getCentralPDOConnection();

    if (!$db) {

        echo json_encode([
            'success' => false,
            'message' => 'Failed connecting central database'
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | GET UPID PATIENTS WITH UPID LIKE 'up-%'
    |--------------------------------------------------------------------------
    */
    $sql = "
        SELECT * FROM kinyinya.`upid_patients` WHERE `upid` LIKE '%up-%'
    ";

    $stmt = $db->prepare($sql);

    $stmt->execute();

    $facilities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */
    echo json_encode([
        'success' => true,
        'total' => count($facilities),
        'data' => $facilities
    ], JSON_PRETTY_PRINT);

} catch (Throwable $e) {

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}