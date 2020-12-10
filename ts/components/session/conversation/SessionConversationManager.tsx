export function getTimestamp(asInt = false) {
  const timestamp = Date.now() / 1000;
  return asInt ? Math.floor(timestamp) : timestamp;
}
