<?php

namespace App\Controllers;

use App\Models\ClientTestModel;

class ClientTestController
{
  private $model;

  public function __construct(ClientTestModel $model)
  {
    $this->model = $model;
  }

  /*
    |--------------------------------------------------------------------------
    | GET CLIENT
    |--------------------------------------------------------------------------
    */
  public function show($client_id)
  {
    try {

      $data = $this->model->getClientData($client_id);

      if (!$data) {

        echo json_encode([
          'success' => false,
          'message' => 'Client not found'
        ]);

        return;
      }

      echo json_encode([
        'success' => true,
        'data' => $data
      ]);
    } catch (\Throwable $e) {

      echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
      ]);
    }
  }
}
