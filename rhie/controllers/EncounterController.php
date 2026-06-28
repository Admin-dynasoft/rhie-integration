<?php

require_once __DIR__ . '/../models/EncounterModel.php';
require_once __DIR__ . '/../config/upid_filter.php';
ini_set('memory_limit', '500M');
ini_set('max_execution_time', 0);
class EncounterController
{
  private $db;
  private $model;

  public function __construct(PDO $db)
  {
    $this->db = $db;

    $this->model = new EncounterModel($this->db);
  }


  private function generateUuid()
  {
    return sprintf(
      '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
      mt_rand(0, 0xffff),
      mt_rand(0, 0xffff),
      mt_rand(0, 0xffff),
      mt_rand(0, 0x0fff) | 0x4000,
      mt_rand(0, 0x3fff) | 0x8000,
      mt_rand(0, 0xffff),
      mt_rand(0, 0xffff),
      mt_rand(0, 0xffff)
    );
  }

  public function generateEncountersVisit($startDate)
  {
    $sql = "SELECT c.date, c.time, c.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral

            FROM clientts c
            JOIN upid_patients u ON c.client_id = u.patient_id
            LEFT JOIN referral r ON c.client_id = r.client_id AND DATE(r.referral_date) = c.date
            WHERE c.rhie_status = 0 AND c.date BETWEEN ? AND CURRENT_DATE() AND c.deleted = 0
            AND u.upid NOT LIKE 'UP%'
            ORDER BY c.date, c.client_id, c.time";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($orders as $order) {
      $key = $order['client_id'] . '_' . $order['date'];
      $grouped[$key][] = $order;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['date'];
      $time = $first['time'];

      if (!$this->model->checkMainEncounterExists($upid, $client_id, $date, 'VISIT_ENCOUNTER')) {
        $this->model->insertMainEncounter([
          $this->generateUuid(),
          'VISIT_ENCOUNTER',
          $upid,
          $client_id,
          $date,
          $time,
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markVisitAsUploaded($client_id);
      }
    }
  }

  public function generateEncountersTransfer($startDate)
  {
    $sql = "SELECT c.date, c.time, c.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
    FROM clientts c
    JOIN upid_patients u ON c.client_id = u.patient_id
    LEFT JOIN referral r ON c.client_id = r.client_id AND DATE(r.referral_date) = c.date
    WHERE c.rhie_status = 1 AND c.date BETWEEN ? AND CURRENT_DATE() AND c.deleted = 0
    AND u.upid NOT LIKE 'UP%'
    ORDER BY c.date, c.client_id, c.time";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($orders as $order) {
      $key = $order['client_id'] . '_' . $order['date'];
      $grouped[$key][] = $order;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['date'];
      $time = $first['time'];

      if (!$this->model->checkMainEncounterExists($upid, $client_id, $date, 'E_TRANSFER')) {
        $this->model->insertMainEncounter([
          $this->generateUuid(),
          'E_TRANSFER',
          $upid,
          $client_id,
          $date,
          $time,
          2,
          date('Y-m-d H:i:s')
        ]);
        // $this->model->markVisitAsUploaded($client_id);
      }
    }
  }

  public function generateEncountersFromOrders($startDate, $type, $type_display)
  {
    $sql = "SELECT o.order_id, o.date, o.time, o.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
            FROM orders o
            JOIN upid_patients u ON o.client_id = u.client_id
            LEFT JOIN referral r ON o.client_id = r.client_id AND DATE(r.referral_date) = o.date
            WHERE o.type = ? AND o.rhie_status = 0 AND o.date BETWEEN ? AND CURRENT_DATE() AND o.deleted = 0
            AND u.upid NOT LIKE 'UP%'
            ORDER BY o.date, o.client_id, o.time";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$type, $startDate]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($orders as $order) {
      $key = $order['client_id'] . '_' . $order['date'];
      $grouped[$key][] = $order;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['date'];
      $time = $first['time'];

      foreach ($group as $order) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          $type_display,
          $upid,
          $client_id,
          $order['order_id'],
          'orders',
          $order['date'],
          $order['time'],
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markOrderAsUploaded($order['order_id']);
      }
    }

    echo "✔️ Inserted encounter for Medicine ID {$orders['order_id']},date: {$orders['date']}" . PHP_EOL;
  }

  public function generateLabEncounters($startDate)
  {
    $sql = "SELECT l.test_id, l.date, l.time, l.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
            FROM lab_results l
            JOIN upid_patients u ON l.client_id = u.patient_id
            LEFT JOIN referral r ON l.client_id = r.client_id AND DATE(r.referral_date) = l.date
            WHERE l.rhie_status = 0 AND l.date BETWEEN ? AND CURRENT_DATE()
            AND u.upid NOT LIKE 'UP%'
            ORDER BY l.date, l.client_id, l.time";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $labs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($labs as $lab) {
      $key = $lab['client_id'] . '_' . $lab['date'];
      $grouped[$key][] = $lab;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['date'];
      $time = $first['time'];

      foreach ($group as $lab) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'lab',
          $upid,
          $client_id,
          $lab['test_id'],
          'lab_results',
          $lab['date'],
          $lab['time'],
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markLabAsUploaded($lab['test_id']);
      }

      echo "✔️ Inserted encounter for lab result ID {$lab['test_id']},date: {$lab['date']}" . PHP_EOL;
    }
  }

  public function generateLabRequestEncounters($startDate)
  {
    $sql = "SELECT o.order_id, o.date, o.time, o.client_id, u.upid, a.act, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
            FROM orders o
            INNER JOIN acts a ON o.item = a.act_id
            JOIN upid_patients u ON o.client_id = u.patient_id
            LEFT JOIN referral r ON o.client_id = r.client_id AND DATE(r.referral_date) = o.date
            WHERE o.rhie_status = 0 AND o.date BETWEEN ? AND CURRENT_DATE() AND o.deleted = 0 AND o.type = 'laboratoire'
            AND u.upid NOT LIKE 'UP%'
            ORDER BY o.date, o.client_id, o.time";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $lab_requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($lab_requests as $lab_request) {
      $key = $lab_request['client_id'] . '_' . $lab_request['date'];
      $grouped[$key][] = $lab_request;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['date'];
      $time = $first['time'];

      foreach ($group as $lab_request) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'lab_request',
          $upid,
          $client_id,
          $lab_request['order_id'],
          'orders',
          $lab_request['date'],
          $lab_request['time'],
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markOrderAsUploaded($lab_request['order_id']);
      }

      echo "✔️ Inserted encounter for lab request ID {$lab_request['order_id']},date: {$lab_request['date']}" . PHP_EOL;
    }
  }

  public function generateDiagEncounters($startDate)
  {
    $sql = "WITH ranked_diags AS ( 
    SELECT 
      u.upid, 
      dc.client_id, 
      dc.id AS source_id, 
      dc.date AS source_date, 
      d.english AS diagnosis,
      LENGTH(COALESCE(d.english, '')) AS diag_length, 
      ROW_NUMBER() OVER (
          PARTITION BY dc.client_id 
          ORDER BY LENGTH(COALESCE(d.english, '')) DESC
      ) AS rn, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral 
    FROM diag_client dc 
    JOIN upid_patients u ON dc.client_id = u.patient_id 
    INNER JOIN diags d ON dc.diag_id = d.id 
    LEFT JOIN referral r ON dc.client_id = r.client_id AND DATE(r.referral_date) = dc.date
    WHERE dc.rhie_status = 0 AND reference_reason IS NULL AND dc.date BETWEEN ? AND CURRENT_DATE()
    AND u.upid NOT LIKE 'UP%'
    ) 
    SELECT upid, client_id, source_id,source_date, diagnosis, referral
    FROM ranked_diags 
    WHERE rn = 1;
    ";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $diags = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($diags as $diag) {
      $key = $diag['client_id'] . '_' . $diag['source_date'];
      $grouped[$key][] = $diag;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['source_date'];
      $time = date('Y-m-d H:i:s');

      if (!$this->model->checkMainEncounterExists($upid, $client_id, $date, 'consultation')) {
        $this->model->insertMainEncounter([
          $this->generateUuid(),
          'consultation',
          $upid,
          $client_id,
          $date,
          $time,
          2,
          date('Y-m-d H:i:s')
        ]);
      }

      foreach ($group as $diag) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'diagnostic',
          $upid,
          $client_id,
          $diag['source_id'],
          'diag_client',
          $diag['source_date'],
          date('Y-m-d H:i:s'),
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markDiagAsUploaded($client_id, $date);
      }

      echo "✔️ Inserted encounter for Diagnostic ID {$diag['source_id']},date: {$diag['source_date']}" . PHP_EOL;
    }
  }

  public function generateComplaintEncounters($startDate)
  {
    $sql = "SELECT 
          upid,
          patient_id,
          vital_sign_id AS source_id,
          date AS source_date,
          referral
    FROM (
        SELECT 
          u.upid,
          vs.patient_id,
          vs.vital_sign_id,
          vs.date,

          CASE 
            WHEN r.id IS NOT NULL THEN TRUE 
            ELSE FALSE 
          END AS referral,

          ROW_NUMBER() OVER (
            PARTITION BY u.upid 
            ORDER BY vs.date ASC, vs.vital_sign_id ASC
          ) AS rn

        FROM vital_sign vs

        JOIN upid_patients u 
          ON vs.patient_id = u.patient_id

        LEFT JOIN referral r 
          ON vs.patient_id = r.client_id 
          AND DATE(r.referral_date) = vs.date

        WHERE vs.vital_id = 9
        AND vs.rhie_status = 0
        AND vs.date BETWEEN ? AND CURRENT_DATE()
        AND u.upid NOT LIKE 'UP%'

    ) AS filtered

    WHERE rn = 1
    ";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $plaintes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($plaintes as $plainte) {
      $key = $plainte['patient_id'] . '_' . $plainte['source_date'];
      $grouped[$key][] = $plainte;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['patient_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['source_date'];
      $time = date('Y-m-d H:i:s');

      foreach ($group as $plainte) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'complaint',
          $upid,
          $client_id,
          $plainte['source_id'],
          'vital_sign',
          $plainte['source_date'],
          date('Y-m-d H:i:s'),
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markComplaintAsUploaded($client_id, $date);
      }

      echo "✔️ Inserted encounter for Complainte ID {$plainte['source_id']},date: {$plainte['source_date']}" . PHP_EOL;
    }
  }

  public function generateVitalSignEncounters($startDate)
  {
    $sql = "SELECT u.upid, vs.patient_id, vs.vital_sign_id AS source_id, vs.date AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
    FROM vital_sign vs 
    JOIN upid_patients u ON vs.patient_id = u.patient_id 
    LEFT JOIN referral r ON vs.patient_id = r.client_id AND DATE(r.referral_date) = vs.date
    WHERE vs.vital_id IN (1,2,3,8,9,11,12,20,27,28,29,30) AND vs.rhie_status = 0 AND vs.date BETWEEN ? AND CURRENT_DATE()
    AND u.upid NOT LIKE 'UP%'
    ";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $vital_signs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($vital_signs as $vital_sign) {
      $key = $vital_sign['patient_id'] . '_' . $vital_sign['source_date'];
      $grouped[$key][] = $vital_sign;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['patient_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['source_date'];
      $time = date('Y-m-d H:i:s');

      if (!$this->model->checkMainEncounterExists($upid, $client_id, $date, 'encountervital')) {
        $this->model->insertMainEncounter([
          $this->generateUuid(),
          'encounter_vital',
          $upid,
          $client_id,
          $date,
          $time,
          2,
          date('Y-m-d H:i:s')
        ]);
      }

      foreach ($group as $vital_sign) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'vital_sign',
          $upid,
          $client_id,
          $vital_sign['source_id'],
          'vital_sign',
          $vital_sign['source_date'],
          date('Y-m-d H:i:s'),
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markVitalSignAsUploaded($client_id, $date);
      }

      echo "✔️ Inserted encounter for Vital Sign ID {$vital_sign['source_id']},date: {$vital_sign['source_date']}" . PHP_EOL;
    }
  }

  public function generateVitalNCDsEncounters($startDate)
  {
    $sql = "SELECT u.upid, nc.client_id, nc.id AS source_id, DATE(nc.date) AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
    FROM ncds nc 
    JOIN upid_patients u ON nc.client_id = u.client_id 
    LEFT JOIN referral r ON nc.client_id = r.client_id AND DATE(r.referral_date) = nc.date
    WHERE nc.vitael_id IN (1,2,3,5,11,12,13,15,17,20,21) AND nc.rhie_status = 0 AND DATE(nc.date) BETWEEN ? AND CURRENT_DATE()
    AND u.upid NOT LIKE 'UP%'
    ";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $vital_signs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($vital_signs as $vital_sign) {
      $key = $vital_sign['client_id'] . '_' . $vital_sign['source_date'];
      $grouped[$key][] = $vital_sign;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['source_date'];
      $time = date('Y-m-d H:i:s');

      if (!$this->model->checkMainEncounterExists($upid, $client_id, $date, 'encounterNCDsvital')) {
        $this->model->insertMainEncounter([
          $this->generateUuid(),
          'encounterNCDsvital',
          $upid,
          $client_id,
          $date,
          $time,
          2,
          date('Y-m-d H:i:s')
        ]);
      }

      foreach ($group as $vital_sign) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'vital_ncds',
          $upid,
          $client_id,
          $vital_sign['source_id'],
          'ncds',
          $vital_sign['source_date'],
          date('Y-m-d H:i:s'),
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markVitalNCDsAsUploaded($client_id, $date);
      }

      echo "✔️ Inserted encounter for Vital Sign NCDs ID {$vital_sign['source_id']},date: {$vital_sign['source_date']}" . PHP_EOL;
    }
  }

  public function generatePlaintesNCDsEncounters($startDate)
  {
    $sql = "SELECT u.upid, nc.client_id, nc.id AS source_id, DATE(nc.date) AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
    FROM ncds nc 
    JOIN upid_patients u ON nc.client_id = u.client_id 
    LEFT JOIN referral r ON nc.client_id = r.client_id AND DATE(r.referral_date) = nc.date
    WHERE nc.vitael_id =18 AND nc.rhie_status = 0 AND DATE(nc.date) BETWEEN ? AND CURRENT_DATE()
    AND u.upid NOT LIKE 'UP%'
    ";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $vital_signs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($vital_signs as $vital_sign) {
      $key = $vital_sign['client_id'] . '_' . $vital_sign['source_date'];
      $grouped[$key][] = $vital_sign;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['source_date'];
      $time = date('Y-m-d H:i:s');

      if (!$this->model->checkMainEncounterExists($upid, $client_id, $date, 'encounterNCDsPlaintes')) {
        $this->model->insertMainEncounter([
          $this->generateUuid(),
          'encounterNCDsPlaintes',
          $upid,
          $client_id,
          $date,
          $time,
          2,
          date('Y-m-d H:i:s')
        ]);
      }

      foreach ($group as $vital_sign) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'plainte_ncds',
          $upid,
          $client_id,
          $vital_sign['source_id'],
          'ncds',
          $vital_sign['source_date'],
          date('Y-m-d H:i:s'),
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markPlainteNCDsAsUploaded($client_id, $date);
      }

      echo "✔️ Inserted encounter for Plaintes NCDs ID {$vital_sign['source_id']},date: {$vital_sign['source_date']}" . PHP_EOL;
    }
  }

  public function generateDiagnosticNCDsEncounters($startDate)
  {
    $sql = "SELECT u.upid, nc.client_id, nc.id AS source_id, DATE(nc.date) AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
    FROM ncds nc 
    JOIN upid_patients u ON nc.client_id = u.client_id 
    LEFT JOIN referral r ON nc.client_id = r.client_id AND DATE(r.referral_date) = nc.date
    WHERE nc.vitael_id =19 AND nc.rhie_status = 0 AND DATE(nc.date) BETWEEN ? AND CURRENT_DATE()
    AND u.upid NOT LIKE 'UP%'
    ";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $vital_signs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($vital_signs as $vital_sign) {
      $key = $vital_sign['client_id'] . '_' . $vital_sign['source_date'];
      $grouped[$key][] = $vital_sign;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['source_date'];
      $time = date('Y-m-d H:i:s');

      if (!$this->model->checkMainEncounterExists($upid, $client_id, $date, 'encounterNCDsDiagnostic')) {
        $this->model->insertMainEncounter([
          $this->generateUuid(),
          'encounterNCDsDiagnostic',
          $upid,
          $client_id,
          $date,
          $time,
          2,
          date('Y-m-d H:i:s')
        ]);
      }

      foreach ($group as $vital_sign) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'diagnostic_ncds',
          $upid,
          $client_id,
          $vital_sign['source_id'],
          'ncds',
          $vital_sign['source_date'],
          date('Y-m-d H:i:s'),
          2,
          date('Y-m-d H:i:s')
        ]);
        $this->model->markDiagnosticNCDsAsUploaded($client_id, $date);
      }

      echo "✔️ Inserted encounter for Diagnostic NCDs ID {$vital_sign['source_id']},date: {$vital_sign['source_date']}" . PHP_EOL;
    }
  }

  public function generateReferralEncounters($startDate)
  {
    $sql = "SELECT 
      u.upid, 
      dc.client_id, 
      dc.id AS source_id, 
      dc.referral_date AS source_date 
    FROM referral dc 
    JOIN upid_patients u ON dc.client_id = u.patient_id
    WHERE dc.rhie_status = 0 AND dc.referral_reason_id IS NOT NULL AND DATE(dc.referral_date) BETWEEN ? AND CURRENT_DATE() AND dc.deleted = 0
    AND u.upid NOT LIKE 'UP%'
    ORDER BY dc.referral_date, dc.client_id, dc.referral_date";
    $stmt = $this->db->prepare($sql);
    $stmt->execute([$startDate]);
    $referrals = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grouped = [];
    foreach ($referrals as $referral) {
      $key = $referral['client_id'] . '_' . $referral['source_date'];
      $grouped[$key][] = $referral;
    }

    foreach ($grouped as $group) {
      $first = $group[0];
      $client_id = $first['client_id'];
      $upid = rhieSanitizeUpid($first['upid']);
      $date = $first['source_date'];
      $time = date('Y-m-d H:i:s');

      foreach ($group as $referral) {
        $this->model->insertEncounter([
          $this->generateUuid(),
          'referral',
          $upid,
          $client_id,
          $referral['source_id'],
          'diag_client',
          $referral['source_date'],
          date('Y-m-d H:i:s'),
          2,
          date('Y-m-d H:i:s')
        ]);
        // Mark referral as uploaded if needed
      }

      echo "✔️ Inserted encounter for Referral ID {$referral['source_id']},date: {$referral['source_date']}" . PHP_EOL;
    }
  }

  public function ensureVisitEncounterForClient(int $clientId, string $date): array
  {
    $deletedFilter = $this->clienttsHasDeletedColumn()
      ? ' AND c.deleted = 0'
      : '';

    $sql = "SELECT c.date, c.time, c.client_id, u.upid
            FROM clientts c
            JOIN upid_patients u
              ON (c.client_id = u.patient_id OR c.client_id = u.client_id)
            WHERE c.client_id = ?
              AND c.date = ?
              {$deletedFilter}
              AND u.upid NOT LIKE 'UP%'
            LIMIT 1";

    $stmt = $this->db->prepare($sql);
    $stmt->execute([$clientId, $date]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$visit) {
      return [
        'ok' => false,
        'created' => false,
        'reason' => "No visit record in clientts for client {$clientId} on {$date}.",
      ];
    }

    $upid = rhieSanitizeUpid($visit['upid']);

    if (rhieUpidIsExcluded($upid)) {
      return [
        'ok' => false,
        'created' => false,
        'reason' => 'Patient UPID is excluded from HIE upload.',
      ];
    }

    if ($this->model->checkMainEncounterExists($upid, $clientId, $date, 'VISIT_ENCOUNTER')) {
      return ['ok' => true, 'created' => false, 'reason' => null];
    }

    $this->model->insertMainEncounter([
      $this->generateUuid(),
      'VISIT_ENCOUNTER',
      $upid,
      $clientId,
      $date,
      $visit['time'],
      2,
      date('Y-m-d H:i:s'),
    ]);
    $this->model->markVisitAsUploaded($clientId);

    return ['ok' => true, 'created' => true, 'reason' => null];
  }

  private function clienttsHasDeletedColumn(): bool
  {
    $stmt = $this->db->prepare(
      'SELECT COUNT(*) FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
    );
    $stmt->execute(['clientts', 'deleted']);

    return (int) $stmt->fetchColumn() > 0;
  }

  public function ensureReferralEncounterForClient(int $clientId, string $date, ?int $referralId = null): array
  {
    if ($referralId > 0) {
      $sql = "SELECT r.id AS source_id, u.upid, DATE(r.referral_date) AS source_date
              FROM referral r
              JOIN upid_patients u ON (r.client_id = u.patient_id OR r.client_id = u.client_id)
              WHERE r.id = ?
                AND r.client_id = ?
                AND r.referral_reason_id IS NOT NULL
                AND r.deleted = 0
                AND u.upid NOT LIKE 'UP%'
              LIMIT 1";
      $stmt = $this->db->prepare($sql);
      $stmt->execute([$referralId, $clientId]);
    } else {
      $sql = "SELECT r.id AS source_id, u.upid, DATE(r.referral_date) AS source_date
              FROM referral r
              JOIN upid_patients u
                ON (r.client_id = u.patient_id OR r.client_id = u.client_id)
              WHERE r.client_id = ?
                AND DATE(r.referral_date) = ?
                AND r.referral_reason_id IS NOT NULL
                AND r.deleted = 0
                AND u.upid NOT LIKE 'UP%'
              ORDER BY r.id DESC
              LIMIT 1";
      $stmt = $this->db->prepare($sql);
      $stmt->execute([$clientId, $date]);
    }

    $referral = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$referral) {
      return [
        'ok' => false,
        'created' => false,
        'reason' => 'Referral record not found for HIE encounter generation.',
      ];
    }

    $upid = rhieSanitizeUpid($referral['upid']);
    $sourceId = (int) $referral['source_id'];
    $encounterDate = $date;

    $check = $this->db->prepare(
      "SELECT 1
       FROM encounter_patients
       WHERE client_id = ?
         AND date = ?
         AND type = 'referral'
         AND source_id = ?
       LIMIT 1"
    );
    $check->execute([$clientId, $encounterDate, $sourceId]);

    if ($check->fetchColumn()) {
      return ['ok' => true, 'created' => false, 'reason' => null];
    }

    $this->model->insertEncounter([
      $this->generateUuid(),
      'referral',
      $upid,
      $clientId,
      $sourceId,
      'referral',
      $encounterDate,
      date('Y-m-d H:i:s'),
      2,
      date('Y-m-d H:i:s'),
    ]);

    return ['ok' => true, 'created' => true, 'reason' => null];
  }
}
