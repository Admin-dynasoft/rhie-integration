<?php
// link.php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

define("DB_HOST", "127.0.0.1"); // set database host 
define("DB_USER", "root"); // set database user
define("DB_PASS", "raymond1"); // set database password
define("DB_NAME", "kirwa_437"); // set database name

$dbh = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS, array(PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES 'utf8'"));
// $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$link = mysqli_connect(DB_HOST, DB_USER, DB_PASS) or die("Couldn't make connection." . mysqli_connect_error());
$db = mysqli_select_db($link, DB_NAME) or die("Couldn't select database" . mysqli_error($link));
date_default_timezone_set('Africa/Kigali');
