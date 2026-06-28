<?php
// rhie/api/get_upid_referral_api.php
//displays all patients with upid like 'up-%' from gisenyi.upid_patients and also appear in referral table
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

        SELECT * FROM gisenyi_198.upid_patients 
        INNER JOIN gisenyi_198.referral ON gisenyi_198.upid_patients.client_id = gisenyi_198.referral.client_id
        WHERE gisenyi_198.upid_patients.upid LIKE 'up-%';
        
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