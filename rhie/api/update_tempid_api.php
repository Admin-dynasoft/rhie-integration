<?php
// rhie/api/update_tempid_api.php

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
    | GET REQUEST DATA
    |--------------------------------------------------------------------------
    */
    $input = json_decode(file_get_contents('php://input'), true);

    $patientId = $input['patient_id'] ?? $_POST['patient_id'] ?? $_GET['patient_id'] ?? null;

    if (empty($patientId)) {
        echo json_encode([
            'success' => false,
            'message' => 'patient_id is required'
        ]);

        exit;
    }

    /*
    |--------------------------------------------------------------------------
    | DEFAULT DOCUMENT TYPE
    |--------------------------------------------------------------------------
    */
    $documentType = 'TEMPID';

    /*
|--------------------------------------------------------------------------
| CHECK PATIENT FROM REFERRAL ADDRESS LOGIC
|--------------------------------------------------------------------------
*/
    $checkSql = "

    SELECT 
        up.upid_id,
        up.patient_id,
        up.client_id,
        up.upid,
        up.document_type,
        rf.*
    FROM gisenyi_198.upid_patients up
    INNER JOIN gisenyi_198.referral rf 
        ON up.client_id = rf.client_id
    WHERE up.upid LIKE 'up-%'
      AND up.patient_id = :patient_id
      AND up.document_type = :document_type
    LIMIT 1

";

    $checkStmt = $db->prepare($checkSql);

    $checkStmt->execute([
        ':patient_id' => $patientId,
        ':document_type' => 'TEMPID'
    ]);

    $tempPatient = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$tempPatient) {
        echo json_encode([
            'success' => false,
            'message' => 'No matching TEMPID patient found from referral address records.',
            'patient_id' => $patientId,
            'document_type' => 'TEMPID'
        ], JSON_PRETTY_PRINT);
        exit;
    }

    /*
|--------------------------------------------------------------------------
| GENERATE NEW UPID
|--------------------------------------------------------------------------
*/
    $fosaStmt = $db->prepare("
    SELECT fosaid 
    FROM gisenyi_198.address 
    WHERE address_id = 1
    LIMIT 1
");

    $fosaStmt->execute();

    $fosa = $fosaStmt->fetch(PDO::FETCH_ASSOC);

    $fosaid = isset($fosa['fosaid'])
        ? str_pad((string) $fosa['fosaid'], 4, '0', STR_PAD_LEFT)
        : '0023';

    do {
        $randomFour = random_int(1000, 9999);

        $newUpid = date('ymd') . '-' . $fosaid . '-' . $randomFour;

        $checkUpidStmt = $db->prepare("
        SELECT COUNT(*) 
        FROM gisenyi_198.upid_patients 
        WHERE upid = :upid
    ");

        $checkUpidStmt->execute([
            ':upid' => $newUpid
        ]);

        $exists = (int) $checkUpidStmt->fetchColumn();
    } while ($exists > 0);

    /*
|--------------------------------------------------------------------------
| UPDATE UPID AND CHANGE DOCUMENT TYPE FROM TEMPID TO NPID
|--------------------------------------------------------------------------
*/
    $updateSql = "

    UPDATE gisenyi_198.upid_patients
    SET 
        upid = :upid,
        document_type = :new_document_type
    WHERE upid_id = :upid_id
      AND document_type = :old_document_type

";

    $updateStmt = $db->prepare($updateSql);

    $updateStmt->execute([
        ':upid' => $newUpid,
        ':new_document_type' => 'NPID',
        ':upid_id' => $tempPatient['upid_id'],
        ':old_document_type' => 'TEMPID'
    ]);

    if ($updateStmt->rowCount() < 1) {
        echo json_encode([
            'success' => false,
            'message' => 'Patient was found, but UPID was not updated.',
            'patient_id' => $patientId,
            'upid_id' => $tempPatient['upid_id']
        ], JSON_PRETTY_PRINT);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'TEMPID updated to NPID successfully',
        'patient_id' => $patientId,
        'upid_id' => $tempPatient['upid_id'],
        'client_id' => $tempPatient['client_id'],
        'old_document_type' => 'TEMPID',
        'document_type' => 'NPID',
        'old_upid' => $tempPatient['upid'],
        'upid' => $newUpid
    ], JSON_PRETTY_PRINT);
} catch (Throwable $e) {

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
