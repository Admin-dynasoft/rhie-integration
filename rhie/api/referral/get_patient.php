<?php

header("Content-Type: application/json");

// GET UPID
$upid = $_GET['upid'] ?? '';

if (!$upid) {
    echo json_encode(["error" => "Missing UPID"]);
    exit;
}

// HIE URL
$url = "https://devhie.moh.gov.rw:5000/clientregistry/Patient?identifier=" . urlencode($upid);

// CURL
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

// Return same response
echo $response;