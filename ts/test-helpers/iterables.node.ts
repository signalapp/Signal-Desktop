// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'node:buffer';

export async function text(
  iterable: AsyncIterable<Uint8Array<ArrayBuffer>>
): Promise<string> {
  const chunks = new Array<Uint8Array<ArrayBuffer>>();
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}
