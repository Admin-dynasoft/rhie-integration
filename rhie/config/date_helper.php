<?php

if (!function_exists('rhieFormatDateTime')) {

  /**
   * Convert a date/time to ISO 8601 using the local timezone.
   *
   * @param string|null $datetime
   * @param string $timezone
   * @return string|null
   */
  function rhieFormatDateTime(?string $datetime, string $timezone = 'Africa/Kigali'): ?string
  {
    if (empty($datetime)) {
      return null;
    }

    try {
      $date = new DateTime($datetime, new DateTimeZone($timezone));
      return $date->format(DateTimeInterface::ATOM);
    } catch (Throwable $e) {
      return null;
    }
  }
}

function rhieFormatDateTimeOffset(
    ?DateTimeInterface $date,
    string $interval = 'PT0H'
): ?string {
    if ($date === null) {
        return null;
    }

    $dt = clone $date;

    if ($interval !== 'PT0H') {
        $dt->add(new DateInterval($interval));
    }

    return $dt->format(DateTimeInterface::ATOM);
}