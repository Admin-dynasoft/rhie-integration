<?php

ini_set('memory_limit', '500M');

ini_set('max_execution_time', 0);

class EncounterModel
{
  private PDO $db;

  /*
    |--------------------------------------------------------------------------
    | CONSTRUCTOR
    |--------------------------------------------------------------------------
    */
  public function __construct(PDO $db)
  {
    $this->db = $db;
  }

  /*
    |--------------------------------------------------------------------------
    | INSERT MAIN ENCOUNTER
    |--------------------------------------------------------------------------
    */
  public function insertMainEncounter($data)
  {
    $sql = "INSERT INTO encounter_main
            (
                encount_id,
                type,
                upid,
                client_id,
                date,
                time,
                rhie_status,
                rhie_uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)

            ON DUPLICATE KEY UPDATE
                rhie_status = VALUES(rhie_status),
                rhie_uploaded_at = VALUES(rhie_uploaded_at)
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute($data);
  }

  /*
  |--------------------------------------------------------------------------
  | INSERT ENCOUNTER
  |--------------------------------------------------------------------------
  */
  public function insertEncounter($data)
  {
    $sql = "INSERT INTO encounter_patients
            (
              encount_id,
              type,
              upid,
              client_id,
              source_id,
              source_table,
              date,
              time,
              rhie_status,
              rhie_uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute($data);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK VISIT
    |--------------------------------------------------------------------------
    */
  public function markVisitAsUploaded($client_id)
  {
    $sql = "UPDATE clientts
            SET rhie_status = 1
            WHERE client_id = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$client_id]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK ORDER
    |--------------------------------------------------------------------------
    */
  public function markOrderAsUploaded($order_id)
  {
    $sql = "
            UPDATE orders
            SET rhie_status = 1
            WHERE order_id = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$order_id]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK LAB
    |--------------------------------------------------------------------------
    */
  public function markLabAsUploaded($test_id)
  {
    $sql = "UPDATE lab_results
            SET rhie_status = 1
            WHERE test_id = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$test_id]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK DIAG
    |--------------------------------------------------------------------------
    */
  public function markDiagAsUploaded($client_id, $date)
  {
    $sql = "UPDATE diag_client
            SET rhie_status = 1
            WHERE client_id = ?
            AND date = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$client_id, $date]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK COMPLAINT
    |--------------------------------------------------------------------------
    */
  public function markComplaintAsUploaded($client_id, $date)
  {
    $sql = "
            UPDATE vital_sign
            SET rhie_status = 1
            WHERE patient_id = ?
            AND vital_id = 9
            AND date = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$client_id, $date]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK VITAL
    |--------------------------------------------------------------------------
    */
  public function markVitalSignAsUploaded($client_id, $date)
  {
    $sql = "
            UPDATE vital_sign
            SET rhie_status = 1
            WHERE patient_id = ?
            AND date = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$client_id, $date]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK NCD VITAL
    |--------------------------------------------------------------------------
    */
  public function markVitalNCDsAsUploaded($client_id, $date)
  {
    $sql = "
            UPDATE ncds
            SET rhie_status = 1
            WHERE client_id = ?
            AND date = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$client_id, $date]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK NCD PLAINTES
    |--------------------------------------------------------------------------
    */
  public function markPlainteNCDsAsUploaded($client_id, $date)
  {
    $sql = "UPDATE ncds
            SET rhie_status = 1
            WHERE client_id = ?
            AND date = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$client_id, $date]);
  }

  /*
    |--------------------------------------------------------------------------
    | MARK NCD DIAGNOSTIC
    |--------------------------------------------------------------------------
    */
  public function markDiagnosticNCDsAsUploaded($client_id, $date)
  {
    $sql = "
            UPDATE ncds
            SET rhie_status = 1
            WHERE client_id = ?
            AND date = ?
        ";

    $stmt = $this->db->prepare($sql);

    return $stmt->execute([$client_id, $date]);
  }

  /*
    |--------------------------------------------------------------------------
    | CHECK MAIN ENCOUNTER
    |--------------------------------------------------------------------------
    */
  public function checkMainEncounterExists(
    $upid,
    $client_id,
    $date,
    $type
  ) {
    $sql = "SELECT 1
            FROM encounter_main
            WHERE upid = ?
            AND client_id = ?
            AND date = ?
            AND type = ?
        ";

    $stmt = $this->db->prepare($sql);

    $stmt->execute([
      $upid,
      $client_id,
      $date,
      $type
    ]);

    return $stmt->fetchColumn();
  }
}
