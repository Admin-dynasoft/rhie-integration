<?php
// rhie/models/ClientRegistryModel.php

require_once __DIR__ . '/../config/upid_filter.php';

class ClientRegistryModel
{
  private PDO $db;

  public function __construct(PDO $db)
  {
    $this->db = $db;
  }

  /**
   * Get UPIDs for a given client that need processing
   * status:
   *  0 = pending
   *  1 = retry
   *  3 = failed
   */
  public function getUpidsByClient(int $clientID): array
  {
    $sql = "SELECT DISTINCT u.upid FROM upid_patients u WHERE u.client_id = :clientID AND u.status IN (0,1,3) AND u.upid NOT LIKE 'UP%' ORDER BY u.upid ASC";

    $stmt = $this->db->prepare($sql);
    $stmt->bindValue(':clientID', $clientID, PDO::PARAM_INT);
    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_COLUMN);
  }

  /**
   * Fetch all data needed to build a Patient resource
   * This structure matches the Controller's expectations exactly
   */
  public function getClientDataByUpid(string $upid): ?array
  {
    $upid = rhieSanitizeUpid($upid) ?? '';

    if ($upid === '') {
      return null;
    }

    $sql = "SELECT u.upid AS UPID,u.document_number AS nida,

                c.beneficiary AS full_names,
                c.family_name AS last_name,
                c.given_name  AS first_name,
                c.sex AS gender,
                c.marital_status AS marital_status,
                c.tel AS phone,

                -- IMPORTANT: real birth date (FHIR needs YYYY-MM-DD)
                c.age AS birthdate,
                u.status AS rhie_status,

                p.province AS state,
                p.province_id AS state_id,

                d.district AS district,
                s.sector AS sector,
                ce.cell  AS cell,CONCAT(d.district, ', ', s.sector, ', ', ce.cell) AS line
                -- referral true/false by checking if client has a referral record in referrals table
                , CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral

            FROM upid_patients u
            INNER JOIN patients c ON u.patient_id = c.patient_id
            INNER JOIN districts_client d ON c.district = d.district_id
            INNER JOIN provinces p ON d.province_id = p.province_id
            INNER JOIN sectors_client s ON s.sector_id = c.sector AND s.district_id = d.district_id
            INNER JOIN cells_client ce ON ce.cell_id = c.cellule AND ce.sector_id = s.sector_id
            LEFT JOIN referral r ON c.patient_id = r.client_id

            WHERE u.upid = :upid AND u.status IN (0,1,3) AND u.upid NOT LIKE 'UP%'
            LIMIT 1
        ";

    $stmt = $this->db->prepare($sql);
    $stmt->bindValue(':upid', $upid, PDO::PARAM_STR);
    $stmt->execute();

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
  }

  /**
   * Update status of a single UPID
   * 2 = success
   * 3 = failed
   */
  public function updateUpidStatus(string $upid, int $status): void
  {
    $sql = "UPDATE upid_patients SET status = :status WHERE upid = :upid";

    $stmt = $this->db->prepare($sql);
    $stmt->bindValue(':status', $status, PDO::PARAM_INT);
    $stmt->bindValue(':upid', $upid, PDO::PARAM_STR);
    $stmt->execute();
  }

  /**
   * Mark ALL UPIDs for a client as failed
   * Used by batch error handling
   */
  public function markClientAsFailed(int $clientID): void
  {
    $sql = "UPDATE upid_patients SET status = 3 WHERE client_id = :clientID";

    $stmt = $this->db->prepare($sql);
    $stmt->bindValue(':clientID', $clientID, PDO::PARAM_INT);
    $stmt->execute();
  }
}
