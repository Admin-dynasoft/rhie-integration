<?php
// rhie/controllers/GetEncounterController.php

require_once __DIR__ . '/../models/GetEncounterModel.php';

class EncounterController
{
    private PDO $db;

    private GetEncounterModel $model;

    /*
    |--------------------------------------------------------------------------
    | CONSTRUCTOR
    |--------------------------------------------------------------------------
    */
    public function __construct(PDO $db)
    {
        $this->db = $db;

        $this->model = new GetEncounterModel($this->db);
    }

    /*
    |--------------------------------------------------------------------------
    | VISIT
    |--------------------------------------------------------------------------
    */
    public function fetchVisitEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getVisitEncounterData($date, $client_id, $facilityId);
    }

    /*
    |--------------------------------------------------------------------------
    | VISIT
    |--------------------------------------------------------------------------
    */
    public function fetchETransferEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getETransferEncounterData($date, $client_id, $facilityId);
    }

    /*
    |--------------------------------------------------------------------------
    | CONSULTATION
    |--------------------------------------------------------------------------
    */
    public function fetchConsultationEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getConsultationEncounterData($date, $client_id, $facilityId);
    }

    /*
    |--------------------------------------------------------------------------
    | COMPLAINT
    |--------------------------------------------------------------------------
    */
    public function fetchComplaintEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getComplaintEncounterData($date,$client_id,$facilityId);
    }

    /*
    |--------------------------------------------------------------------------
    | GENERAL ENCOUNTER
    |--------------------------------------------------------------------------
    */
    public function fetchEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | DIAGNOSTIC
    |--------------------------------------------------------------------------
    */
    public function fetchDiagEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getDiagEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | VITAL
    |--------------------------------------------------------------------------
    */
    public function fetchVitalEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getVitalEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | LABO
    |--------------------------------------------------------------------------
    */
    public function fetchLaboEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getLaboEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | LAB REQUEST
    |--------------------------------------------------------------------------
    */
    public function fetchLabRequestEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getLabRequestEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | MEDICATION
    |--------------------------------------------------------------------------
    */
    public function fetchMedicationEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getMedicationEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | MEDICATION ADMIN
    |--------------------------------------------------------------------------
    */
    public function fetchMedicationAdminEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getMedicationAdminEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | NCD VITAL
    |--------------------------------------------------------------------------
    */
    public function fetchNCDsVitalEncounterData($date, $client_id, $facilityId)
    {
        return $this->model->getNCDsVitalEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | NCD PLAINT
    |--------------------------------------------------------------------------
    */
    public function fetchNCDsPlaintEncounterData($date, $client_id, $facilityId)
    {
        return $this->model->getNCDsPlaintEncounterData(
            $date,
            $client_id,
            $facilityId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | NCD DIAGNOSTIC
    |--------------------------------------------------------------------------
    */
    public function fetchNCDsDiagEncounterData($date, $client_id, $facilityId)
    {
        return $this->model->getNCDsDiagEncounterData($date,$client_id,$facilityId);
    }

    /*
    |--------------------------------------------------------------------------
    | REFERRAL
    |--------------------------------------------------------------------------
    */
    public function fetchReferralEncounterDetails($date, $client_id, $facilityId)
    {
        return $this->model->getReferralEncounterData($date,$client_id,$facilityId);
    }
}
