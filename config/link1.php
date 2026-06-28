<?php
// link1.php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

$con = mysqli_connect('127.0.0.1', 'root', 'raymond1')
    or die('Unable to connect to the Database' . mysqli_error($link));
mysqli_select_db($con, 'kirwa_437')
    or die('Unable to select database' . mysqli_error($link));
date_default_timezone_set('Africa/Kigali');
