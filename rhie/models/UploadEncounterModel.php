<?php
// rhie/models/UploadEncounterModel.php

require_once __DIR__ . '/../../link_base_url.php';
require_once __DIR__ . '/GetEncounterModel.php';

class UploadEncounterModel
{
  private $conn;
  private ?GetEncounterModel $reader = null;

  public function __construct($db)
  {
    $this->conn = $db;

    if ($this->useDirectReads()) {
      $this->reader = new GetEncounterModel($db);
    }
  }

  private function useDirectReads(): bool
  {
    return (defined('RHIE_BATCH_DIRECT') && RHIE_BATCH_DIRECT)
      || php_sapi_name() === 'cli';
  }

  private function readDirect(string $method, array $args): array
  {
    if (!$this->reader || !method_exists($this->reader, $method)) {
      return [];
    }

    $result = $this->reader->$method(...$args);

    return is_array($result) ? $result : [];
  }

  private function fetchApi(string $url): array
  {
    $response = @file_get_contents($url);

    if ($response === false) {
      return [];
    }

    $json = json_decode($response, true);

    return $json['data'] ?? [];
  }

  public function getVisitEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getVisitEncounterData', [$date, $client_id, $facilityId]);
    }

    $url = BASE_URL_ONLINE . "rhie/api/get_visit_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId";
    $response = @file_get_contents($url);

    if ($response === false) {
      return [];
    }

    $json = json_decode($response, true);

    return ($json['status'] ?? '') === 'success' ? ($json['data'] ?? []) : [];
  }

  public function getVisitEncounterRefData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect($client_id, $date, $facilityId);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_referral_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getETransferEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getETransferEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_etransfer_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getConsultationEncounterData($client_id, $date)
  {
    if ($this->reader) {
      return $this->readDirect('getConsultationEncounterData', [$date, $client_id, 0]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/consultation/get_consultation_api.php?date=$date&client_id=$client_id"
    );
  }

  public function getComplaintEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getComplaintEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_complaint_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getVitalEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getVitalEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_vital_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getLabRequestEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getLabRequestEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_lab_request_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getLaboEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getLaboEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_labo_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getDiagEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getDiagEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_diag_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getMedicationData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getMedicationEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_medication_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getMedicationAdmitData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getMedicationAdminEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_medication_admin_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getReferralEncounterData($client_id, $date, $facilityId)
  {
    if ($this->reader) {
      return $this->readDirect('getReferralEncounterData', [$date, $client_id, $facilityId]);
    }

    return $this->fetchApi(
      BASE_URL_ONLINE . "rhie/api/get_referral_encounter_api.php?date=$date&client_id=$client_id&facility_id=$facilityId"
    );
  }

  public function getFosaDetails()
  {
    return $this->conn->query("SELECT hc, fosaid FROM address WHERE address_id = 1")->fetch(PDO::FETCH_ASSOC);
  }

  public function markVisitUploaded($visit_id)
  {
    $sql = "UPDATE encounter_main SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE encount_id = ?";
    $stmt = $this->conn->prepare($sql);
    $stmt->execute([$visit_id]);
  }

  public function markObservationUploaded($encount_id)
  {
    $stmt = $this->conn->prepare(
      "UPDATE encounter_patients SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE encount_id = ?"
    );
    $stmt->execute([$encount_id]);
  }

  public function markTransferUploaded($encount_id)
  {
    $stmt = $this->conn->prepare(
      "UPDATE encounter_patients SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE encount_id = ? AND type = 'referral'"
    );
    $stmt->execute([$encount_id]);
  }

  public function markMedicationUploaded($order_id)
  {
    $stmt = $this->conn->prepare("UPDATE orders SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE order_id = ?");
    $stmt->execute([$order_id]);
  }
}
