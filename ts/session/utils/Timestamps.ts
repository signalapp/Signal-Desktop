/**
 * Checks if the given value is a valid Unix timestamp.
 * @param value timestamp in milliseconds
 */
export function isValidUnixTimestamp(value: number): boolean {
  // The Unix timestamp is a way to track time as a running total of seconds.
  // It counts the number of seconds since January 1, 1970 (UTC).
  // Hence, it should be a non-negative number.
  if (typeof value !== 'number' || value < 0) {
    return false;
  }

  // Convert the Unix timestamp to a Date object and check if it's valid.
  const date = new Date(value * 1000);
  return date instanceof Date && !Number.isNaN(date);
}
