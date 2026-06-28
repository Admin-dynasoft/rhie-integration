// rhie/views/js/referral.js
let encountersCache = []; // store all encounters

async function loadPatient() {
  let upid = document.getElementById("upid").value;

  if (!upid) {
    alert("Enter UPID");
    return;
  }

  try {
    // =====================
    // 1. LOAD PATIENT
    // =====================
    let patientRes = await fetch(`../api/referral/get_patient.php?upid=${upid}`);
    let patientData = await patientRes.json();

    let patient = patientData.entry?.[0]?.resource;

    if (!patient) {
      alert("Patient not found");
      return;
    }

    // Fill patient immediately
    document.getElementById("client_name").innerText =
      patient.name?.[0]?.given?.join(" ") + " " + patient.name?.[0]?.family;

    document.getElementById("upid_display").innerText = patient.id;
    document.getElementById("dob").innerText = patient.birthDate;
    document.getElementById("gender").innerText = patient.gender;
    document.getElementById("phone").innerText =
      patient.telecom?.[0]?.value || "";
    
    
    // ✅ PHONE
    document.getElementById("phone").innerText =
      patient.telecom?.[0]?.value || "";

    // ❌ caregiver not in API
    document.getElementById("caregiver").innerText = "-";

    // ✅ ADDRESS MAPPING
    let addr = patient.address?.[0];

    if (addr) {
      let parts = addr.line?.[0]?.split(",") || [];

      document.getElementById("province").innerText = addr.city || "";
      document.getElementById("district").innerText = parts[0] || "";
      document.getElementById("district_cl").innerText = parts[0] || "";
      document.getElementById("sector").innerText = parts[1] || "";
      document.getElementById("cell").innerText = parts[2] || "";
      // document.getElementById("village").innerText = parts[3] || "";
    }

    // =====================
    // 2. LOAD ENCOUNTERS
    // =====================
    let encRes = await fetch(`../api/referral/get_transfer.php?upid=${upid}`);
    let encData = await encRes.json();

    let entries =
      encData.parameter?.find((p) => p.name === "bundle")?.resource?.entry ||
      [];

    if (entries.length === 0) {
      alert("No transfers found");
      return;
    }

    // Save in cache
    encountersCache = entries.map((e) => e.resource);

    // Populate dropdown
    let select = document.getElementById("resource_id");
    select.innerHTML = `<option value="">-- Select Resource ID --</option>`;

    encountersCache.forEach((enc) => {
      let option = document.createElement("option");
      option.value = enc.id;
      option.text = `${enc.id} (${enc.hospitalization?.destination?.display || ""})`;
      select.appendChild(option);
    });
  } catch (e) {
    console.error(e);
    alert("Error loading patient or encounters");
  }
}

// =====================
// LOAD SELECTED ENCOUNTER
// =====================
document.getElementById("resource_id").addEventListener("change", function () {
  let selectedId = this.value;

  if (!selectedId) return;

  let encounter = encountersCache.find((e) => e.id === selectedId);

  if (!encounter) return;

  // ✅ HOSPITAL
  document.getElementById("hospital").innerText =
    encounter.hospitalization?.destination?.display || "";

  // ✅ REFERRING FACILITY
  document.getElementById("referring_facility").innerText =
    encounter.hospitalization?.origin?.display || "";

  // ✅ UNIT
  document.getElementById("referring_unit").innerText =
    encounter.location?.[0]?.location?.display || "";

  // ✅ CLINICIAN
  document.getElementById("clinician").innerText =
    encounter.participant?.[0]?.individual?.display || "";

  // ✅ DATE (optional but useful)
  let date = encounter.period?.start || "";
  if (date) {
    let formatted = new Date(date).toLocaleString();
    console.log("Encounter date:", formatted);
  }
});
