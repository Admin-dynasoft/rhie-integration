<?php
// config/hie.php

$production = true; // Set to false for testing, true for production

if (!$production) {
  $hie_url = "http://197.243.24.138:5001";
  $hie_password = "medisoft@hie2024";
  $hie_username = "medisoft";
}else {
  $hie_url = "https://devhie.moh.gov.rw:5000";
  $hie_password = "Qk2wM7zmrt4PcJWU";
  $hie_username = "MRS_MEDISOFT";
}


