<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <title>External Transfer Form</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="css/referral.css">
</head>

<body>

  <div class="container mt-3">

    <!-- INPUTS -->
    <div class="card p-3 mb-3">
      <div class="row">
        <div class="col-md-4">
          <label>UPID</label>
          <input type="text" id="upid" class="form-control" placeholder="Enter UPID">
        </div>

        <div class="col-md-4">
          <label>Resource ID</label>
          <select id="resource_id" class="form-control">
            <option value="">-- Select Resource ID --</option>
          </select>
        </div>

        <div class="col-md-4 d-flex align-items-end">
          <button onclick="loadPatient()" class="btn btn-primary w-100">
            Load Patient
          </button>
        </div>
      </div>
    </div>

    <!-- PDF BUTTON -->
    <div class="text-end mb-2">
      <a href="Facility_transfer_forms_2020-1.pdf" target="_blank" class="btn btn-danger">
        View PDF
      </a>
    </div>

  </div>

  <!-- FORM -->
  <div class="paper">

    <div class="header">
      <div>
        <strong>REPUBLIC OF RWANDA</strong><br>
        <strong>MINISTRY OF HEALTH</strong>
      </div>

      <div class="header-right">
        Province: <span id="province" class="line h5"></span><br>
        District: <span id="district" class="line h5"></span><br>
        Name of Hospital: <span id="hospital" class="line h5"></span><br>
        Name of Referring Facility: <span id="referring_facility" class="line h5"></span><br>
        Referring Unit: <span id="referring_unit" class="line h5"></span><br>
        Receiving Clinician/Phone: <span id="clinician" class="line h5"></span>
      </div>
    </div>

    <div class="title">EXTERNAL TRANSFER FORM</div>

    <!-- CLIENT -->
    <div class="section">
      Client Name: <span id="client_name" class="line h5"></span>
      Serial number in register/EMR ID: <span id="upid_display" class="line h5"></span>
    </div>

    <div class="section">
      Age(DOB): <span id="dob" class="line h5"></span>
      Sex: <span id="gender" class="line h5"></span>
      Name of caregiver: <span id="caregiver" class="line h5"></span>
      Telephone: <span id="phone" class="line h5"></span>
    </div>

    <div class="section mb-4">
      District: <span id="district_cl" class="line h5"></span>
      Sector: <span id="sector" class="line h5"></span>
      Cell: <span id="cell" class="line h5"></span>
      Village: <span id="village" class="line h5"></span>
    </div>

    <div class="section">
      Date and time of Admission: <span class="line"></span>
      Date and Time of decision to transfer: <span class="line"></span>
    </div>

    <div class="section">
      Receiving Facility: <span class="line"></span>
      Receiving Service: <span class="line"></span>
      Calling Time: <span class="line"></span>
    </div>

    <div class="section">
      Staff contacted at receiving facility: <span class="line"></span>
      Phone: <span class="line"></span>
    </div>

    <div class="section">
      Type of transfer:
      Emergency ⃝
      Not-Emergency ⃝
      Follow up ⃝
    </div>

    <div class="section">
      If emergency:
      Time ambulance called: <span class="line"></span>
      Time of departure: <span class="line"></span>
    </div>

    <div class="section">
      Reason for Transfer:
      <div class="full-line"></div>
    </div>
  </div>

  <script src="js/referral.js"></script>

</body>

</html>