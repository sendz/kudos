// frontend/src/utils/time.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

// Relative timestamps for notification rows ("2 hours ago"). Intl handles the
// wording and the translation; if a locale is unknown it falls back to English.

const UNITS = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatRelativeTime(value, locale = "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  let formatter;
  try {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  } catch {
    formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }

  // Seconds until the value, negative when it is in the past.
  const diff = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);

  if (abs < 45) return formatter.format(0, "second");

  for (const [unit, seconds] of UNITS) {
    if (abs >= seconds) {
      return formatter.format(Math.round(diff / seconds), unit);
    }
  }

  return formatter.format(Math.round(diff / 60), "minute");
}
