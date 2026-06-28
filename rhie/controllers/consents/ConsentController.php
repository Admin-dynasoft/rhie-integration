<?php
class ConsentController
{
  private $model;

  public function __construct($model)
  {
    $this->model = $model;
  }

  public function create($patientId)
  {
    $result = $this->model->createConsent($patientId);

    if ($result['success']) {
      return [
        "status" => "success",
        "message" => "Consent created successfully",
        "data" => $result['response']
      ];
    } else {
      return [
        "status" => "error",
        "message" => "Failed to create consent",
        "error" => $result
      ];
    }
  }
}
