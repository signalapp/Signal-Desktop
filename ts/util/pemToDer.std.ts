// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fromBase64 } from '../Bytes.std.ts';

export function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const pemContent = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const derBuffer = fromBase64(pemContent);
  return derBuffer;
}
