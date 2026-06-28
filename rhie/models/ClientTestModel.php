<?php

namespace App\Models;

use PDO;

class ClientTestModel
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /*
    |--------------------------------------------------------------------------
    | GET CLIENT TEST DATA
    |--------------------------------------------------------------------------
    */
    public function getClientData($client_id)
    {
        $sql = "
            SELECT
                p.patient_id,
                p.beneficiary,
                a.fosaid,
                up.upid
            FROM patients p

            LEFT JOIN upid_patients up
                ON up.patient_id = p.patient_id

            LEFT JOIN address a
                ON a.address_id = 1

            WHERE p.patient_id = ?
            LIMIT 1
        ";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([$client_id]);

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}