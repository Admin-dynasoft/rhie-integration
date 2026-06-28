<?php

require_once __DIR__ . '/../config/upid_filter.php';
require_once __DIR__ . '/../models/EncounterModel.php';
require_once __DIR__ . '/../controllers/EncounterController.php';
require_once __DIR__ . '/../models/UploadEncounterModel.php';
require_once __DIR__ . '/../controllers/UploadVisitEncounterController.php';

class RealtimeTransferService
{
  public function processAfterReferralSave(
    PDO $db,
    int $facilityId,
    int $clientId,
    string $referralDate,
    int $referralId,
    bool $fromRetry = false
  ): array {
    if (!defined('RHIE_BATCH_DIRECT')) {
      define('RHIE_BATCH_DIRECT', true);
    }

    require_once dirname(__DIR__, 2) . '/config/hie.php';

    $date = date('Y-m-d', strtotime($referralDate));
    $result = [
      'success' => false,
      'steps' => [],
    ];

    try {
      $generateController = new EncounterController($db);

      $visitEnsure = $generateController->ensureVisitEncounterForClient($clientId, $date);
      $result['steps'][] = array_merge(['step' => 'ensure_visit'], $visitEnsure);

      if (!$visitEnsure['ok']) {
        $result['message'] = $visitEnsure['reason'];
        return $result;
      }

      $referralEnsure = $generateController->ensureReferralEncounterForClient(
        $clientId,
        $date,
        $referralId > 0 ? $referralId : null
      );
      $result['steps'][] = array_merge(['step' => 'ensure_referral'], $referralEnsure);

      if (!$referralEnsure['ok']) {
        $result['message'] = $referralEnsure['reason'];
        return $result;
      }

      $visitStatus = $this->getVisitStatus($db, $clientId, $date);
      $result['steps'][] = ['step' => 'visit_status', 'status' => $visitStatus];

      $creds = [
        'url' => $GLOBALS['hie_url'] ?? '',
        'username' => $GLOBALS['hie_username'] ?? '',
        'password' => $GLOBALS['hie_password'] ?? '',
      ];

      $uploadModel = new UploadEncounterModel($db);
      $uploadController = new UploadVisitEncounterController($uploadModel, $creds);

      if ($visitStatus !== 1) {
        $visitUpload = $uploadController->upload($clientId, $date, 'E_TRANSFER', $facilityId);
        $result['steps'][] = ['step' => 'upload_visit', 'response' => $visitUpload];
        $visitStatus = $this->getVisitStatus($db, $clientId, $date);
        $result['steps'][] = ['step' => 'visit_status_after_upload', 'status' => $visitStatus];
      }

      if ($visitStatus !== 1) {
        $result['message'] = $visitStatus === null
          ? 'Visit encounter could not be created for this client and date.'
          : 'Parent visit encounter is not uploaded yet.';
        return $result;
      }

      $encounterResult = $uploadController->upload(
        $clientId,
        $date,
        'E_TRANSFER',
        $facilityId
      );
      $transferResult = $uploadController->upload(
        $clientId,
        $date,
        'TRANSFER_ENCOUNTER',
        $facilityId
      );

      $result['steps'][] = ['step' => 'upload_referral_encounter', 'response' => $encounterResult];
      $result['steps'][] = ['step' => 'upload_transfer', 'response' => $transferResult];
      $result['success'] = $this->responsesSuccessful($transferResult);
      $result['message'] = $result['success']
        ? 'Referral and transfer sent to HIE.'
        : 'Referral saved locally but HIE transfer upload failed.';

      if (!$result['success'] && !$fromRetry) {
        require_once __DIR__ . '/../models/UploadQueueModel.php';
        (new UploadQueueModel($db))->enqueueTransfer(
          $clientId,
          $date,
          $referralId,
          $result['message'] ?? 'transfer upload failed'
        );
        $result['queued_for_retry'] = true;
      }

      return $result;
    } catch (Throwable $e) {
      $result['message'] = $e->getMessage();

      try {
        if (!$fromRetry) {
          require_once __DIR__ . '/../models/UploadQueueModel.php';
          (new UploadQueueModel($db))->enqueueTransfer(
            $clientId,
            $date,
            $referralId,
            $e->getMessage()
          );
          $result['queued_for_retry'] = true;
        }
      } catch (Throwable $ignored) {
      }

      return $result;
    }
  }

  private function getVisitStatus(PDO $db, int $clientId, string $date): ?int
  {
    $sql = "SELECT rhie_status
            FROM encounter_main
            WHERE client_id = ?
              AND date = ?
              AND type = 'E_TRANSFER'
            LIMIT 1";

    $stmt = $db->prepare($sql);
    $stmt->execute([$clientId, $date]);
    $status = $stmt->fetchColumn();

    return $status === false ? null : (int) $status;
  }

  private function responsesSuccessful(array $responses): bool
  {
    foreach ($responses as $response) {
      $code = (int) ($response['http_code'] ?? 0);

      if (!in_array($code, [200, 201], true)) {
        return false;
      }
    }

    return !empty($responses);
  }
}
