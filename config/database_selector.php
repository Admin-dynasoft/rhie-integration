<?php
// config/database_selector.php

$config = include __DIR__ . '/database_config.php';
$host = $config['host'];
$user = $config['username'];
$pass = $config['password'];

$currentDatabase  = $config['current_database'];
$previousDatabase = $config['previous_database'];

$conn = new mysqli($host, $user, $pass);

if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

$result = $conn->query("SHOW DATABASES");

?>

<!DOCTYPE html>
<html>

<head>

  <title>Database Selector</title>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

</head>

<body class="bg-light">

  <div class="container mt-5">

    <div class="row justify-content-center">

      <div class="col-md-8">

        <div class="card border-0 shadow-lg">

          <div class="card-header bg-primary text-white">

            <h4 class="mb-0">
              Database Manager
            </h4>

          </div>

          <div class="card-body">

            <?php if (isset($_GET['success'])) { ?>

              <div class="alert alert-success">
                Database changed successfully.
              </div>

            <?php } ?>

            <div class="row mb-4">

              <div class="col-md-6">

                <div class="card border-success">

                  <div class="card-body">

                    <h6 class="text-success">
                      Current Database
                    </h6>

                    <h4>
                      <?= $currentDatabase; ?>
                    </h4>

                  </div>

                </div>

              </div>

              <div class="col-md-6">

                <div class="card border-secondary">

                  <div class="card-body">

                    <h6 class="text-secondary">
                      Previous Database
                    </h6>

                    <h4>
                      <?= !empty($previousDatabase)
                        ? $previousDatabase
                        : 'No previous database'; ?>
                    </h4>

                  </div>

                </div>

              </div>

            </div>

            <form action="save_database.php" method="POST">

              <div class="mb-3">

                <label class="form-label">
                  Select Database
                </label>

                <select name="database"
                  class="form-select"
                  required>

                  <?php while ($row = $result->fetch_assoc()) { ?>

                    <option value="<?= $row['Database']; ?>"
                      <?= ($currentDatabase == $row['Database']) ? 'selected' : ''; ?>>

                      <?= $row['Database']; ?>

                    </option>

                  <?php } ?>

                </select>

              </div>

              <button type="submit" class="btn btn-primary">

                Change Database

              </button>

            </form>

          </div>

        </div>

      </div>

    </div>

  </div>

</body>

</html>