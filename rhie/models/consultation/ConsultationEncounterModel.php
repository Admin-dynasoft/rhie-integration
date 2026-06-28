<?php
// rhie/models/consultation/ConsultationEncounterModel.php

require_once __DIR__ . '/../../../link2.php';

class ConsultationEncounterModel
{
  private $db;

  public function __construct()
  {
    $this->db = (new Database())->connect();
  }

  public function getConsultationEncounters()
  {
    $sql = "SELECT em.encount_id, em.upid, em.client_id, em.date,
                       p.name as patient_name,
                       pr.practitioner_id, pr.name as practitioner_name,
                       l.location_id, l.name as location_name
                FROM encounter_main em
                LEFT JOIN patients p ON em.client_id = p.client_id
                LEFT JOIN practitioners pr ON pr.id = em.practitioner_id
                LEFT JOIN locations l ON l.id = em.location_id
                WHERE em.type = 'consultation'
                AND (em.rhie_status IS NULL OR em.rhie_status != 'uploaded')
                LIMIT 20";

    $stmt = $this->db->prepare($sql);
    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
  }

  public function markAsUploaded($encount_id)
  {
    $sql = "UPDATE encounter_main 
                SET rhie_status = 'uploaded' 
                WHERE encount_id = ?";
    $stmt = $this->db->prepare($sql);
    return $stmt->execute([$encount_id]);
  }
}
