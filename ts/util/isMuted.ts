export function isMuted(muteExpiresAt: undefined | number): boolean {
  return Boolean(muteExpiresAt && Date.now() < muteExpiresAt);
}
