// ts/textsecure/pqSharedDir.ts
import os from 'os';
import path from 'path';

/**
 * Shared directory used to exchange PQ public keys locally between two
 * Signal Desktop instances during testing.
 *
 * You can override via environment variable:
 *   SIGNAL_PQ_SHARED_DIR=/some/path
 */
export const PQ_SHARED_DIR =
  process.env.SIGNAL_PQ_SHARED_DIR ??
  path.join(os.homedir(), 'SignalPQSharedKeys');

/**
 * Very small sanitization so we don't create weird filenames.
 */
export function sanitizeServiceId(serviceId: string): string {
  return String(serviceId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
}

export function keyPathForServiceId(serviceId: string): string {
  const safe = sanitizeServiceId(serviceId);
  return path.join(PQ_SHARED_DIR, `${safe}.mlkem1184.pub`);
}
