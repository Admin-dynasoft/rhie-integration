<?php

/*
|--------------------------------------------------------------------------
| CENTRAL DATABASE
|--------------------------------------------------------------------------
*/
define('MS_HOST', '104.251.216.154');
define('MS_USER', 'remote');
define('MS_PASS', 'Raymond@1234');
define('MS_DB',   'medisoft_hie');

/*
|--------------------------------------------------------------------------
| CENTRAL PDO CONNECTION
|--------------------------------------------------------------------------
*/
function getCentralPDOConnection()
{
	try {

		$dsn = "mysql:host=" . MS_HOST . "; dbname=" . MS_DB . "; charset=utf8mb4";
		return new PDO($dsn, MS_USER, MS_PASS, [ PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,	PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
	} catch (Throwable $e) {

		echo "Central DB Error: " . $e->getMessage() . PHP_EOL;
		return null;
	}
}

/*
|--------------------------------------------------------------------------
| GET ALL FACILITIES
|--------------------------------------------------------------------------
*/
function getAllFacilities()
{
	try {

		$pdo = getCentralPDOConnection();

		if (!$pdo) {
			return [];
		}

		$sql = "SELECT id, db_name, fosaid, db_host, db_user, db_password 
		FROM health_facilities 
		WHERE db_name IS NOT NULL 
		AND db_name != '' 
		AND fosaid IS NOT NULL ORDER BY id ASC";
		$stmt = $pdo->prepare($sql);
		$stmt->execute();
		return $stmt->fetchAll();
	} catch (Throwable $e) {

		echo "Failed fetching facilities: " . $e->getMessage() . PHP_EOL;
		return [];
	}
}

/*
|--------------------------------------------------------------------------
| FACILITY PDO CONNECTION
|--------------------------------------------------------------------------
*/
function getFacilityPDOConnection($facility_id)
{
	try {

		$central = getCentralPDOConnection();

		if (!$central) {
			return null;
		}

		$sql = "SELECT id, db_name, fosaid, db_host, db_user, db_password 
		FROM health_facilities 
		WHERE id = ? LIMIT 1 ";
		$stmt = $central->prepare($sql);
		$stmt->execute([$facility_id]);
		$facility = $stmt->fetch();

		if (!$facility) {
			echo "Facility not found: {$facility_id}" . PHP_EOL;
			return null;
		}

		$host = !empty($facility['db_host']) ? $facility['db_host'] : '127.0.0.1';
		$dbname = $facility['db_name'];
		$user = !empty($facility['db_user']) ? $facility['db_user'] : 'root';
		$pass = $facility['db_password'] ?? '';
		$dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";

		return new PDO($dsn, $user, $pass, [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
		]);
	} catch (Throwable $e) {

		echo "Facility Connection Error: " . $e->getMessage() . PHP_EOL;

		return null;
	}
}

function resolveFacilityIdFromDbName(?string $dbName = null): ?int
{
	$targetDb = $dbName;

	if ($targetDb === null && defined('DB_NAME')) {
		$targetDb = DB_NAME;
	}

	$facilities = getAllFacilities();

	if (empty($facilities)) {
		return null;
	}

	if ($targetDb !== null) {
		foreach ($facilities as $facility) {
			if (($facility['db_name'] ?? '') === $targetDb) {
				return (int) $facility['id'];
			}
		}
	}

	return (int) $facilities[0]['id'];
}
