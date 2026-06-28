<?php
// rhie/models/GetEncounterModel.php

require_once __DIR__ . '/../config/upid_filter.php';

class GetEncounterModel
{
	private PDO $conn;

	/*
    |--------------------------------------------------------------------------
    | CONSTRUCTOR
    |--------------------------------------------------------------------------
    */
	public function __construct(PDO $db)
	{
		$this->conn = $db;
	}

	public function getVisitEncounterData($date, $client_id)
	{
		$sql = "SELECT 
			em.encount_id AS resource_encount_id,
			em.upid,
			em.client_id,
			em.date AS visit_date,
			p.beneficiary AS patient_name,
			'VISIT_ENCOUNTER' AS type_display,
			'Visit' AS display,
			'Visit Encounter' AS div_display,
			c.time AS order_time,
			u.fullname AS practitioner_name,
			'MS-PRAC-0025-001' AS practitioner_id,
			ad.hc AS facility_name,
			ad.fosaid AS location_id
		FROM encounter_main em
		INNER JOIN clientts c ON c.client_id = em.client_id AND c.date = em.date
		INNER JOIN patients p ON p.patient_id = em.client_id
		LEFT JOIN users u ON c.user_id = u.id
		LEFT JOIN address ad ON ad.address_id = 1
		WHERE em.rhie_status = 2 AND c.deleted = 0
		AND em.type = 'VISIT_ENCOUNTER' AND em.date = '$date' AND em.client_id = $client_id
		AND em.upid NOT LIKE 'UP%'
		";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getConsultationEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
			em.encount_id AS reference_encount_id,
			em.upid,
			em.client_id,
			em.date AS consultation_date,
			ep.encount_id AS observation_encount_id,
			p.beneficiary AS patient_name,
			'CONSULTATION_ENCOUNTER' AS type_display,
			'Consultation' AS display,
			'Consultation Encounter' AS div_display,
			c.time AS order_time,
			u.fullname AS practitioner_name,
			'MS-PRAC-0025-001' AS practitioner_id,
			ad.hc AS facility_name,
			ad.fosaid AS location_id
		FROM encounter_patients ep 
		INNER JOIN encounter_main em ON em.client_id = ep.client_id AND em.date = ep.date AND em.type = 'VISIT_ENCOUNTER'
		INNER JOIN clientts c ON c.client_id = em.client_id AND c.date = em.date
		INNER JOIN patients p ON p.patient_id = em.client_id
		LEFT JOIN users u ON u.id = c.user_id
		LEFT JOIN address ad ON ad.address_id = 1
		WHERE ep.rhie_status = 2 AND ep.date = '$date' AND ep.client_id = $client_id AND ep.type = 'CONSULTATION_ENCOUNTER'
		AND em.upid NOT LIKE 'UP%'
		";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
                em.encount_id AS reference_encount_id,
                em.upid,
                em.client_id,
                em.date AS main_date,
                ep.encount_id AS observation_encount_id,
                ep.source_id,
                'Prescription Encounter' AS main_display,
                'Medication' AS display,
                'Medications Orders' AS div_display,
                o.item,
                o.time AS order_time,
                o.user,
                CONCAT(
                    pr.full_desc, ' || ',
                    COALESCE(p.posologie, ''), ' || ',
                    IF(p.duration IS NOT NULL, CONCAT(p.duration, ' days'), ''), ' || ',
                    o.quantity
                ) AS full_description,
                pr.code
            FROM encounter_main em
            INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND ep.type = 'medicine'
            INNER JOIN orders o ON o.order_id = ep.source_id AND o.client_id = em.client_id AND o.date = em.date AND o.type = 'med'
            LEFT JOIN posologies p ON p.order_id = ep.source_id 
            LEFT JOIN products pr ON pr.prod_id = o.item
            WHERE em.rhie_status = 2 AND o.deleted = 0
            AND em.type = 'encountermedicine' AND em.date = '$date' AND em.client_id = $client_id
            AND em.upid NOT LIKE 'UP%'
        ";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getDiagEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
            em.encount_id AS reference_encount_id,
            em.upid,
            em.client_id,
            em.date AS main_date,
            ep.encount_id AS observation_encount_id,
            ep.source_id,
            'Consultation Encounter' AS main_display,
            'Diagnostic' AS display,
            'Diagnostic' AS div_display,
            d.english AS full_description,
            dc.time AS order_time,
            u.fullname AS practitioner_name,
            'Diag-000' AS code
        FROM encounter_main em
        INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER' 
				INNER JOIN diag_client dc ON dc.id = ep.source_id 
				LEFT JOIN diags d ON dc.diag_id = d.id 
				LEFT JOIN users u ON dc.user = u.id
        WHERE ep.type = 'diagnostic' AND em.date = '$date' AND em.client_id = $client_id
        AND em.upid NOT LIKE 'UP%';
        ";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getComplaintEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
						em.encount_id AS reference_encount_id,
            em.upid,
            em.client_id,
            em.date AS main_date,
            ep.encount_id AS observation_encount_id,
            ep.source_id,
            'Consultation Encounter' AS main_display,
            'Chief Complaint' AS display,
            'Chief Complaint' AS div_display,
            pl.plainte AS full_description,
            vs.created_at AS order_time,
            u.fullname AS practitioner_name,
            'Complaint-001' AS code
        FROM encounter_main em
        INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER' 
        INNER JOIN vital_sign vs ON vs.vital_sign_id = ep.source_id 
				LEFT JOIN users u ON vs.user_id = u.id
        LEFT JOIN plaintes pl ON pl.id = vs.value
        WHERE ep.type = 'complaint' AND ep.rhie_status = 2 AND em.date = '$date' AND em.client_id = $client_id
        AND em.upid NOT LIKE 'UP%';

        ";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getLabRequestEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
						em.encount_id AS reference_encount_id,
						em.upid,
						em.client_id,
						em.date AS main_date,
						ep.encount_id AS observation_encount_id,
						ep.source_id,
						'Laboratory procedure' AS main_display,
						'Lab Request' AS display,
						'Lab Request' AS div_display,
						a.act AS full_description,
						o.time AS order_time,
						u.fullname AS practitioner_name,
						'Lab-000' AS code
				FROM encounter_main em
				INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER' 
				INNER JOIN orders o ON o.order_id = ep.source_id AND o.client_id = em.client_id AND o.date = em.date AND o.deleted = 0
				LEFT JOIN users u ON o.user = u.id
				LEFT JOIN acts a ON o.item = a.act_id
				WHERE ep.type = 'lab_request' AND ep.rhie_status = 2 AND em.date = '$date' AND em.client_id = $client_id
				AND em.upid NOT LIKE 'UP%';

				";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getLaboEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT
            em.encount_id AS reference_encount_id,
            em.upid,
            em.client_id,
            em.date AS main_date,
            ep.encount_id AS observation_encount_id,
            ep.source_id,
            'Laboratory' AS main_display,
            'Laboratory' AS display,
            'Laboratory' AS div_display,
            a.act AS full_description,
            CASE WHEN lr.pos_neg_result = '1' THEN 'Positif' 
            WHEN lr.pos_neg_result = '3' THEN 'Negatif'  
            ELSE lr.comment END AS result, 
            lr.time AS order_time,
						u.fullname AS practitioner_name,
            'Lab-000' AS code
				FROM encounter_main em
				INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER' 
				INNER JOIN lab_results lr ON lr.test_id = ep.source_id AND lr.client_id = em.client_id AND lr.date = em.date AND lr.deleted = 0
				LEFT JOIN acts a ON lr.exam_id = a.act_id
				LEFT JOIN users u ON lr.lab_tech = u.id
				WHERE ep.type = 'lab' AND ep.rhie_status = 2 AND em.date = '$date' AND em.client_id = $client_id
				AND em.upid NOT LIKE 'UP%'

        ";
		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getVitalEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT
            em.encount_id AS reference_encount_id,
            em.upid,
            em.client_id,
            em.date AS main_date,
            ep.encount_id AS observation_encount_id,
            ep.source_id,
            'Vital Sign Encounter' AS main_display,
            'Vital Sign' AS display,
            'Vital Sign' AS div_display,
            v.vital_name AS full_description,
            vs.value  AS result,
            vs.created_at AS order_time,
            u.fullname AS practitioner_name,
            'Vital-000' AS code
        FROM encounter_main em
        INNER JOIN encounter_patients ep 
            ON ep.client_id = em.client_id 
            AND ep.date = em.date 
            AND ep.type = 'vital_sign' AND ep.rhie_status = 2
        INNER JOIN vital_sign vs 
            ON vs.vital_sign_id = ep.source_id 
            AND vs.patient_id = em.client_id 
            AND vs.date = em.date
						AND vs.vital_id != 9
        LEFT JOIN vital v ON vs.vital_id = v.vital_id
				LEFT JOIN users u ON vs.user_id = u.id
        WHERE em.type IN ('VISIT_ENCOUNTER') AND em.date = '$date' AND em.client_id = $client_id
        AND em.upid NOT LIKE 'UP%';

        ";
		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getNCDsVitalEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
					em.encount_id AS reference_encount_id, 
					em.upid, 
					em.client_id, 
					DATE(em.date) AS main_date, 
					ep.encount_id AS observation_encount_id, 
					ep.source_id, 
					'NCDs Vital Sign Encounter' AS main_display, 
					'NCDs Vital Sign' AS display, 
					'NCDs Vital Sign' AS div_display, 
					vs.vitael AS full_description, 
					CASE 
							WHEN nc.vitael_id IN (1,2,3,5,11,12,21) THEN nc.value 
							ELSE 
									CASE 
											WHEN nc.value = 1 THEN 'MILD' 
											WHEN nc.value = 2 THEN 'MODERATE' 
											WHEN nc.value = 3 THEN 'SEVERE' 
											WHEN nc.value = 4 THEN 'CRITICAL' 
											WHEN nc.value = 5 THEN 'EXTREME' 
											ELSE vs.vitael 
									END 
					END AS result,
					(nc.date) AS order_time,
					'Vital-000' AS code 
			FROM encounter_main em 
			INNER JOIN encounter_patients ep 
					ON ep.client_id = em.client_id 
					AND DATE(ep.date) = DATE(em.date) 
					AND ep.type = 'vital_ncds' 
			INNER JOIN ncds nc 
					ON nc.id = ep.source_id 
					AND nc.client_id = em.client_id 
					AND DATE(nc.date) = DATE(em.date) 
			LEFT JOIN vitael_sign vs 
					ON nc.vitael_id = vs.id 
			WHERE ep.rhie_status = 2 
				AND em.type = 'encounterNCDsvital' AND em.date = '$date' AND em.client_id = $client_id
				AND em.upid NOT LIKE 'UP%'";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getMedicationEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
					em.encount_id AS reference_encount_id, 
					em.upid, 
					em.client_id, 
					em.date AS main_date, 
					ep.encount_id AS observation_encount_id, 
					ep.source_id, 
					'Medication Encounter' AS main_display, 
					'Medication_Request' AS display, 
					'Medication' AS div_display, 
					p.duration,
					p.posologie,
					o.quantity,
					o.item,
					o.time AS order_time,
					u.fullname AS practitioner_name,
					CONCAT(
							pr.full_desc, ' || ',
							COALESCE(p.posologie, ''), ' || ',
							IF(p.duration IS NOT NULL, CONCAT(p.duration, ' days'), ''), ' || ',
							o.quantity
					) AS full_description,
					pr.code
			FROM encounter_patients ep 
			INNER JOIN encounter_main em ON em.client_id = ep.client_id AND em.date = ep.date AND em.type = 'VISIT_ENCOUNTER'
			INNER JOIN orders o ON o.order_id = ep.source_id AND o.client_id = em.client_id AND o.date = em.date AND o.type = 'med' AND o.deleted = 0
			LEFT JOIN posologies p ON p.order_id = ep.source_id 
			LEFT JOIN products pr ON pr.prod_id = o.item
			LEFT JOIN users u ON u.id = o.user
			WHERE ep.type = 'MEDICINE_ENCOUNTER' AND ep.rhie_status = 2 AND em.date = '$date' AND em.client_id = $client_id AND pr.full_desc NOT LIKE '%inject%'
			AND em.upid NOT LIKE 'UP%';
		";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getMedicationAdminEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
					em.encount_id AS reference_encount_id, 
					em.upid, 
					em.client_id, 
					em.date AS main_date, 
					ep.encount_id AS observation_encount_id, 
					ep.source_id, 
					'Medication Encounter' AS main_display, 
					'Medication_Admit' AS display, 
					'Medication' AS div_display, 
					p.duration,
					p.posologie,
					o.quantity,
					o.item,
					o.time AS order_time,
					u.fullname AS practitioner_name,
					CONCAT(
							pr.full_desc, ' || ',
							COALESCE(p.posologie, ''), ' || ',
							IF(p.duration IS NOT NULL, CONCAT(p.duration, ' days'), ''), ' || ',
							o.quantity
					) AS full_description,
					pr.code
			FROM encounter_patients ep 
			INNER JOIN encounter_main em ON em.client_id = ep.client_id AND em.date = ep.date AND em.type = 'VISIT_ENCOUNTER'
			INNER JOIN orders o ON o.order_id = ep.source_id AND o.client_id = em.client_id AND o.date = em.date AND o.type = 'med' AND o.deleted = 0
			LEFT JOIN posologies p ON p.order_id = ep.source_id 
			LEFT JOIN products pr ON pr.prod_id = o.item
			LEFT JOIN users u ON u.id = o.user
			WHERE ep.type = 'MEDICINE_ENCOUNTER' AND ep.rhie_status = 2 AND em.date = '$date' AND em.client_id = $client_id AND pr.full_desc LIKE '%inject%'
			AND em.upid NOT LIKE 'UP%';
		";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getNCDsPlaintEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
					em.encount_id AS reference_encount_id, 
					em.upid, 
					em.client_id, 
					DATE(em.date) AS main_date, 
					ep.encount_id AS observation_encount_id, 
					ep.source_id, 
					'NCDs Consultation Encounter' AS main_display, 
					'NCDs Chief Complaint' AS display, 
					'NCDs Chief Complaint' AS div_display, 
					'NCDs Plainte' AS full_description, 
					pl.plainte AS result,
					(nc.date) AS order_time,
					'Vital-000' AS code 
			FROM encounter_main em 
			INNER JOIN encounter_patients ep 
					ON ep.client_id = em.client_id 
					AND DATE(ep.date) = DATE(em.date) 
					AND ep.type = 'plainte_ncds' 
			INNER JOIN ncds nc 
					ON nc.id = ep.source_id 
					AND nc.client_id = em.client_id 
					AND DATE(nc.date) = DATE(em.date) 
          AND nc.vitael_id = 18
			LEFT JOIN plaintes pl 
					ON nc.value = pl.id 
			WHERE ep.rhie_status = 2 
				AND em.type = 'encounterNCDsvital' AND em.date = '$date' AND em.client_id = $client_id
				AND em.upid NOT LIKE 'UP%'";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getNCDsDiagEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
				em.encount_id AS reference_encount_id, 
				em.upid, 
				em.client_id, 
				DATE(em.date) AS main_date, 
				ep.encount_id AS observation_encount_id, 
				ep.source_id, 
				'NCDs Consultation Encounter' AS main_display, 
				'NCDs Diagnostic' AS display, 
				'NCDs Diagnostic' AS div_display, 
				vs.vitael AS full_description, 
				CASE 
						WHEN nc.vitael_id = 19 THEN  
								CASE 
										WHEN nc.value = 1 THEN 'ASTHMA' 
										WHEN nc.value = 2 THEN 'DIABETES' 
										WHEN nc.value = 3 THEN 'HEART FAILURE' 
										WHEN nc.value = 4 THEN 'HYPERTENSION' 
										ELSE vs.vitael 
								END 
						ELSE vs.vitael
				END AS result,
				DATE(nc.date) AS order_time, 
				'Vital-000' AS code 
		FROM encounter_main em 
		INNER JOIN encounter_patients ep 
				ON ep.client_id = em.client_id 
				AND DATE(ep.date) = DATE(em.date) 
				AND ep.type = 'diagnostic_ncds' 
		INNER JOIN ncds nc 
				ON nc.id = ep.source_id 
				AND nc.client_id = em.client_id 
				AND DATE(nc.date) = DATE(em.date) 
				AND nc.vitael_id = 19
		LEFT JOIN vitael_sign vs 
				ON nc.vitael_id = vs.id 
		WHERE ep.rhie_status = 2 
			AND em.type = 'encounterNCDsvital' 
			AND DATE(em.date) = '$date' 
			AND em.client_id = $client_id
			AND em.upid NOT LIKE 'UP%'
		";

		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getReferralEncounterData($date, $client_id, $facilityId)
	{
		$sql = "SELECT 
				em.encount_id AS reference_encount_id,
				em.upid,
				em.client_id,
				em.date AS main_date,
				p.beneficiary AS patient_name,
				ep.encount_id AS observation_encount_id,
				ep.source_id,
				'TRANSFER_ENCOUNTER' AS main_display,
				'Referral' AS display,
				'Referral' AS div_display,
				r.referral_reason_id AS full_description,
				r.referral_type,
				r.referral_date AS referral_time,
				r.ambulance_call_time AS ambulance_time,
				r.departure_time,
				r.receiving_clinician_name AS receiving_clinician,
				r.receiving_clinician_contact,
				r.receiving_clinician_title,
				GROUP_CONCAT(DISTINCT vs.vital_id ORDER BY vs.vital_id SEPARATOR ',') AS vital_ids,
				GROUP_CONCAT(DISTINCT vs.value ORDER BY vs.vital_id SEPARATOR ',') AS vital_values,
				tr.treatments,
				lb.lab_results,
				p.insurance_id AS insurance,
				u.fullname AS practitioner_name,
				'Refer-000' AS code,
				ad.hc AS facility_name,
				ad.hospital AS hospital_name,
				ad.fosaid AS location_id
		FROM encounter_main em
		INNER JOIN (
				SELECT 
						MIN(eps.encount_id) AS encount_id,
						eps.client_id,
						eps.source_id,
						DATE(eps.date) AS referral_date,
						eps.rhie_status
				FROM encounter_patients eps
				WHERE type = 'referral'
				GROUP BY eps.client_id, eps.source_id, DATE(eps.date), eps.rhie_status
		) ep 
				ON ep.client_id = em.client_id
				AND ep.referral_date = DATE(em.date)
				AND ep.rhie_status = 2
		INNER JOIN referral r 
				ON r.id = ep.source_id
				AND r.client_id = em.client_id
				AND DATE(r.referral_date) = DATE(em.date)
				AND r.deleted = 0
		INNER JOIN patients p 
				ON p.patient_id = em.client_id
		LEFT JOIN users u 
				ON r.caregiver_id = u.id
		LEFT JOIN address ad 
				ON ad.address_id = 1
		LEFT JOIN vital_sign vs 
				ON vs.patient_id = em.client_id
				AND DATE(vs.date) = DATE(em.date)
				AND vs.vital_id IN (2,3,5,11,12,20,27,29,30)

		LEFT JOIN (SELECT o.client_id,DATE(o.date) AS order_date,
						GROUP_CONCAT(
								DISTINCT CONCAT(
										pr.full_desc,
										' || ',
										COALESCE(po.posologie, ''),
										' || ',
										IF(
												po.duration IS NOT NULL,
												CONCAT(po.duration, ' days'),
												''
										),
										' || ',
										COALESCE(o.quantity, '')
								)
								SEPARATOR ' ## '
						) AS treatments

				FROM orders o
				LEFT JOIN posologies po ON po.order_id = o.order_id
				LEFT JOIN products pr ON pr.prod_id = o.item
				WHERE o.type IN ('med', 'laboratoire')
				AND pr.full_desc IS NOT NULL
				GROUP BY o.client_id, DATE(o.date)

		) tr 
				ON tr.client_id = em.client_id
				AND tr.order_date = DATE(em.date)

		LEFT JOIN (SELECT 
						lr.client_id,DATE(lr.date) AS lab_date,
						GROUP_CONCAT(
								DISTINCT CONCAT(
										COALESCE(a.act, 'Unknown Test'),
										' => ',
										CASE
												WHEN lr.pos_neg_result = '1' THEN 'Positif'
												WHEN lr.pos_neg_result = '3' THEN 'Negatif'
												ELSE COALESCE(lr.comment, '')
										END
								)
								SEPARATOR ' ## '
						) AS lab_results

				FROM lab_results lr
				LEFT JOIN acts a ON lr.exam_id = a.act_id
				GROUP BY lr.client_id, DATE(lr.date)

		) lb 
				ON lb.client_id = em.client_id
				AND lb.lab_date = DATE(em.date)

		WHERE em.type = 'VISIT_ENCOUNTER'
		AND DATE(em.date) = :date
		AND em.client_id = :client_id
		AND em.upid NOT LIKE 'UP%'

		GROUP BY em.encount_id,ep.encount_id,em.date,em.client_id,ep.source_id,
        r.referral_reason_id,r.referral_type,r.referral_date,r.ambulance_call_time,r.departure_time,
        r.receiving_clinician_name,r.receiving_clinician_contact,r.receiving_clinician_title,
        p.beneficiary,p.insurance_id,u.fullname,ad.hc,ad.hospital,ad.fosaid,tr.treatments,lb.lab_results;
		";

		$stmt = $this->conn->prepare($sql);
		$stmt->bindParam(':date', $date);
		$stmt->bindParam(':client_id', $client_id);
		$stmt->execute();

		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}

	public function getETransferEncounterData($date, $client_id, $facilityId){
		$sql = "SELECT 
    et.encount_id AS resource_encount_id,
    ve.encount_id AS reference_encount_id,
    et.upid,
    et.client_id,
    et.date AS visit_date,
    p.beneficiary AS patient_name,
    'TRANSFER_ENCOUNTER' AS type_display,
    'Transfer' AS display,
    'Transfer Encounter' AS div_display,
    c.time AS order_time,
    u.fullname AS practitioner_name,
    'MS-PRAC-0025-001' AS practitioner_id,
    ad.hc AS origin_facility_name,
    ad.hospital AS destination_facility_name,
    ad.fosaid AS origin_location_id
		FROM encounter_main et
		INNER JOIN encounter_main ve
				ON ve.client_id = et.client_id
				AND ve.date = et.date
				AND ve.type = 'VISIT_ENCOUNTER'
				AND ve.rhie_status = 1
		INNER JOIN clientts c
				ON c.client_id = et.client_id
				AND c.date = et.date
		INNER JOIN patients p
				ON p.patient_id = et.client_id
		LEFT JOIN users u
				ON c.user_id = u.id
		LEFT JOIN address ad
				ON ad.address_id = 1
		WHERE et.rhie_status = 2
    AND et.type = 'E_TRANSFER'
    AND c.deleted = 0
    AND et.date = '$date'
    AND et.client_id = $client_id
    AND et.upid NOT LIKE 'UP%';
		";
		$stmt = $this->conn->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}
}
