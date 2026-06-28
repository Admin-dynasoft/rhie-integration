<?php

header("Content-Type: application/json");

$upid = $_GET['upid'] ?? '';

if (!$upid) {
    echo json_encode(["error" => "Missing UPID"]);
    exit;
}

$url = "https://devhie.moh.gov.rw:5000/shr/Encounter/\$list-transfers?patient=" . urlencode($upid);

$ch = curl_init($url);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Basic TVJTX01FRElTT0ZUOk1lZGlzb2Z0QGhpZTIwMjU="
]);

$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo json_encode(["error" => curl_error($ch)]);
    exit;
}

curl_close($ch);

echo $response;