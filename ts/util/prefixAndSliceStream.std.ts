// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function* prefixAndSliceStream(
  iterable: AsyncIterable<Uint8Array<ArrayBuffer>>,
  start: number,
  end: number,
  prefix: Uint8Array<ArrayBuffer>
): AsyncIterable<Uint8Array<ArrayBuffer>> {
  if (start > end) {
    throw new Error('Invalid configuration, start > end');
  }

  yield prefix;

  let offset = 0;
  for await (const chunk of iterable) {
    const toWrite = chunk.subarray(
      Math.max(0, Math.min(chunk.byteLength, start - offset)),
      Math.max(0, Math.min(chunk.byteLength, end - offset))
    );
    offset += chunk.byteLength;
    yield toWrite;
  }
}
