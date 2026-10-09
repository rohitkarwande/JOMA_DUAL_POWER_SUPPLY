/**
 * Power Supply Telemetry Display Value Formatters
 * Convention:
 *   0 - 30V  -> 0.001 precision (3 decimal places)
 *  30 - 60V  -> 0.01 precision  (2 decimal places)
 *  60V+      -> 0.1 precision   (1 decimal place)
 */

export function formatVoltage(v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(v) || !isFinite(v)) {
    return '0.000';
  }
  const abs = Math.abs(v);
  if (abs <= 30) {
    return v.toFixed(3);
  } else if (abs <= 60) {
    return v.toFixed(2);
  } else {
    return v.toFixed(1);
  }
}

export function formatCurrent(i: number | undefined | null): string {
  if (i === undefined || i === null || isNaN(i) || !isFinite(i)) {
    return '0.000';
  }
  const abs = Math.abs(i);
  if (abs <= 30) {
    return i.toFixed(3);
  } else if (abs <= 60) {
    return i.toFixed(2);
  } else {
    return i.toFixed(1);
  }
}
