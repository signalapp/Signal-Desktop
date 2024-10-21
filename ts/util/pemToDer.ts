// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function pemToDer(pem: string): Buffer {
  const pemContent = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const derBuffer = Buffer.from(pemContent, 'base64');
  return derBuffer;
}
