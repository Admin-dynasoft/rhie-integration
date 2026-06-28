<!-- Facility display as logo section instead of with dates -->
<div class="facility-logo d-flex align-items-center justify-content-between">
    <div class="facility-logo-name d-flex align-items-center">
        <i class="bi bi-building me-2"></i>
        <?php echo htmlspecialchars($facilityName); ?>
    </div>
    <div id="dashboard-date-range" class="text-white px-3 py-1 rounded"
        style="background-color: #0d6efd; font-size: 0.9em; text-align: center;">
        <!-- Date range will be displayed here -->
    </div>
</div>

<!-- Add error alert container -->
<div id="errorAlert" class="alert alert-danger alert-error" role="alert">
    <i class="bi bi-exclamation-triangle me-2"></i>
    <span id="errorMessage"></span>
</div>

<!-- Filter Bar -->
<div class="filter-bar">
    <form method="GET" action="" id="filterForm">
        <div class="row g-2 align-items-end">
            <div class="col-lg-3 col-md-4 col-sm-6">
                <label for="from_date" class="form-label">
                    <i class="bi bi-calendar-event"></i> From Date
                </label>
                <input type="date" name="from_date" id="from_date" class="form-control"
                    value="<?php echo htmlspecialchars($fromDate); ?>" required>
            </div>

            <div class="col-lg-3 col-md-4 col-sm-6">
                <label for="to_date" class="form-label">
                    <i class="bi bi-calendar-check"></i> To Date
                </label>
                <input type="date" name="to_date" id="to_date" class="form-control"
                    value="<?php echo htmlspecialchars($toDate); ?>" required>
            </div>

            <div class="col-lg-2 col-md-3 col-sm-6">
                <button type="button" class="btn btn-primary w-100 btn-sm-custom" onclick="loadMetrics()">
                    <i class="bi bi-funnel"></i> Filter
                </button>
            </div>

            <div class="col-lg-2 col-md-3 col-sm-6">
                <button type="button" class="btn btn-info w-100 btn-sm-custom" onclick="reloadStats()">
                    <i class="bi bi-arrow-clockwise"></i> Reload
                </button>
            </div>
        </div>
    </form>
</div>

<!-- Metrics Grid -->
<div class="metrics-grid">
    <!-- Total Patients Received -->
    <div class="stat-card border-red">
        <div class="stat-title">Total Patient Received</div>
        <div class="stat-value" id="total_patients">-</div>
        <div class="stat-today text-danger">
            <span id="total_patients_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-red">
            <i class="bi bi-hospital"></i>
        </div>
    </div>

    <!-- OPD Patients -->
    <div class="stat-card border-cyan">
        <div class="stat-title">Total OPD Patients</div>
        <div class="stat-value" id="opd_patients">-</div>
        <div class="stat-today text-info">
            <span id="opd_patients_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-cyan">
            <i class="bi bi-stethoscope"></i>
        </div>
    </div>

    <!-- Lab Exams -->
    <div class="stat-card border-yellow">
        <div class="stat-title">Total Lab Exams</div>
        <div class="stat-value" id="lab_exams">-</div>
        <div class="stat-today text-warning">
            <span id="lab_exams_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-yellow">
            <i class="bi bi-beaker"></i>
        </div>
    </div>

    <!-- Pharmacy Dispensed -->
    <div class="stat-card border-green">
        <div class="stat-title">Total Pharmacy Dispensed</div>
        <div class="stat-value" id="pharmacy">-</div>
        <div class="stat-today text-success">
            <span id="pharmacy_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-green">
            <i class="bi bi-capsule"></i>
        </div>
    </div>

    <!-- IMCI Visits -->
    <div class="stat-card border-blue">
        <div class="stat-title">PCMIE Visits</div>
        <div class="stat-value" id="imci_visits">-</div>
        <div class="stat-today text-primary">
            <span id="imci_visits_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-blue">
            <i class="bi bi-person-check"></i>
        </div>
    </div>

    <!-- Sales Invoices -->
    <div class="stat-card border-dark">
        <div class="stat-title">Sales Invoices</div>
        <div class="stat-value" id="sales_invoices">-</div>
        <div class="stat-today text-dark">
            <span id="sales_invoices_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-dark-gradient">
            <i class="bi bi-receipt"></i>
        </div>
    </div>

    <!-- Maternity Visits -->
    <div class="stat-card border-pink">
        <div class="stat-title">Maternity Visits</div>
        <div class="stat-value" id="maternity_visits">-</div>
        <div class="stat-today text-danger">
            <span id="maternity_visits_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-pink">
            <i class="bi bi-gender-female"></i>
        </div>
    </div>

    <!-- ANC Visits -->
    <div class="stat-card border-gray">
        <div class="stat-title">CPN Visits</div>
        <div class="stat-value" id="anc_visits">-</div>
        <div class="stat-today text-secondary">
            <span id="anc_visits_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-gray">
            <i class="bi bi-people"></i>
        </div>
    </div>

    <!-- Family Planning -->
    <div class="stat-card border-teal">
        <div class="stat-title">Family Planning</div>
        <div class="stat-value" id="family_planning">-</div>
        <div class="stat-today text-info">
            <span id="family_planning_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-teal">
            <i class="bi bi-heart"></i>
        </div>
    </div>

    <!-- Mental Health Care -->
    <div class="stat-card border-orange">
        <div class="stat-title">Mental Health Care</div>
        <div class="stat-value" id="mental_health">-</div>
        <div class="stat-today text-warning">
            <span id="mental_health_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-orange">
            <i class="bi bi-brain"></i>
        </div>
    </div>

    <!-- NCDs Management -->
    <div class="stat-card border-cyan">
        <div class="stat-title">NCDs Management</div>
        <div class="stat-value" id="ncds_management">-</div>
        <div class="stat-today text-info">
            <span id="ncds_management_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-cyan">
            <i class="bi bi-heart-pulse-fill"></i>
        </div>
    </div>

    <!-- IPD Visits -->
    <div class="stat-card border-blue">
        <div class="stat-title">Hospitalisation Visits</div>
        <div class="stat-value" id="ipd_visits">-</div>
        <div class="stat-today text-primary">
            <span id="ipd_visits_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-blue">
            <i class="bi bi-hospital-fill"></i>
        </div>
    </div>
    <!-- Dentistry -->
    <div class="stat-card border-green">
        <div class="stat-title">Dentistry</div>
        <div class="stat-value" id="dentistry">-</div>
        <div class="stat-today text-success">
            <span id="dentistry_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-green">
            <i class="bi bi-tooth"></i>
        </div>
    </div>
    <!-- Transfer -->
    <div class="stat-card border-purple">
        <div class="stat-title">INTERNAL Transfer</div>
        <div class="stat-value" id="transfer">-</div>
        <div class="stat-today text-info">
            <span id="transfer_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-purple">
            <i class="bi bi-arrow-right-circle"></i>
        </div>
    </div>
    <!-- Ophthalmology -->
    <div class="stat-card border-pink">
        <div class="stat-title">Ophthalmology</div>
        <div class="stat-value" id="ophthalmology">-</div>
        <div class="stat-today text-danger">
            <span id="ophthalmology_today">0</span> <?php echo htmlspecialchars($todayFormatted); ?>
        </div>
        <div class="stat-icon bg-pink">
            <i class="bi bi-eye-fill"></i>
        </div>
    </div>

</div>