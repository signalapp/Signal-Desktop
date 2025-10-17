// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Bytes from '../Bytes.std.js';

export function pemToDer(pem: string): Uint8Array {
  const pemContent = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const derBuffer = Bytes.fromBase64(pemContent);
  return derBuffer;
}
