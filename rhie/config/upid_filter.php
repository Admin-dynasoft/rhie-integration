<?php

function rhieSanitizeUpid(?string $upid): ?string
{
    if ($upid === null) {
        return null;
    }

    $clean = trim($upid);
    $clean = preg_replace('/\s+/', '', $clean);
    $clean = preg_replace('/[[:^print:]]/', '', $clean);
    $clean = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '', $clean);

    return $clean === '' ? null : $clean;
}

function rhieUpidIsExcluded(?string $upid): bool
{
    $upid = rhieSanitizeUpid($upid);

    return $upid !== null && stripos($upid, 'UP') === 0;
}

function rhieUpidSqlExclude(string $column): string
{
    return "AND {$column} NOT LIKE 'UP%'";
}
