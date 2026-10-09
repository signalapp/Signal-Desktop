// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { FrameError } from './errors.std.ts';

// Frame layout: 1-byte kind, 4-byte big-endian payload length, payload.
// The length is checked against the limit as soon as the header arrives, so
// an oversized frame is rejected before its payload is buffered.

export const FrameKind = {
  Json: 0x01,
  // Reserved for binary attachment chunks; rejected in protocol version 1.
  Binary: 0x02,
} as const;
export type FrameKindType = (typeof FrameKind)[keyof typeof FrameKind];

const FRAME_HEADER_BYTES = 5;

export type FrameType = Readonly<{
  kind: FrameKindType;
  payload: Uint8Array<ArrayBuffer>;
}>;

export function encodeFrame(
  kind: FrameKindType,
  payload: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> {
  const frame = new Uint8Array(FRAME_HEADER_BYTES + payload.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint8(0, kind);
  view.setUint32(1, payload.byteLength, false);
  frame.set(payload, FRAME_HEADER_BYTES);
  return frame;
}

const encoder = new TextEncoder();

export function encodeJsonFrame(value: unknown): Uint8Array<ArrayBuffer> {
  return encodeFrame(FrameKind.Json, encoder.encode(JSON.stringify(value)));
}

export class FrameDecoder {
  readonly #maxPayloadBytes: number;
  readonly #allowedKinds: ReadonlySet<number>;
  #chunks: Array<Uint8Array<ArrayBuffer>> = [];
  #buffered = 0;

  constructor({
    maxPayloadBytes,
    allowedKinds,
  }: {
    maxPayloadBytes: number;
    allowedKinds: ReadonlyArray<FrameKindType>;
  }) {
    this.#maxPayloadBytes = maxPayloadBytes;
    this.#allowedKinds = new Set(allowedKinds);
  }

  // Returns every complete frame contained in the data received so far.
  // Throws FrameError on a protocol violation; the caller must then close the
  // connection, since the stream can no longer be resynchronized.
  push(chunk: Uint8Array<ArrayBuffer>): Array<FrameType> {
    if (chunk.byteLength > 0) {
      this.#chunks.push(chunk);
      this.#buffered += chunk.byteLength;
    }

    const frames = new Array<FrameType>();
    while (this.#buffered >= FRAME_HEADER_BYTES) {
      const header = this.#peek(FRAME_HEADER_BYTES);
      const view = new DataView(
        header.buffer,
        header.byteOffset,
        header.byteLength
      );
      const kind = view.getUint8(0);
      const length = view.getUint32(1, false);

      if (!this.#allowedKinds.has(kind)) {
        throw new FrameError(`Unsupported frame kind ${kind}`);
      }
      if (length > this.#maxPayloadBytes) {
        throw new FrameError(`Frame of ${length} bytes exceeds limit`);
      }
      if (this.#buffered < FRAME_HEADER_BYTES + length) {
        break;
      }

      const whole = this.#take(FRAME_HEADER_BYTES + length);
      frames.push({
        kind: kind as FrameKindType,
        payload: whole.subarray(FRAME_HEADER_BYTES),
      });
    }
    return frames;
  }

  get bufferedBytes(): number {
    return this.#buffered;
  }

  #peek(count: number): Uint8Array<ArrayBuffer> {
    return this.#coalesce().subarray(0, count);
  }

  #take(count: number): Uint8Array<ArrayBuffer> {
    const all = this.#coalesce();
    const result = all.slice(0, count);
    const rest = all.subarray(count);
    this.#chunks = rest.byteLength > 0 ? [rest] : [];
    this.#buffered -= count;
    return result;
  }

  // Joins buffered chunks into one and returns it. Usually a no-op: data
  // tends to arrive in a single chunk.
  #coalesce(): Uint8Array<ArrayBuffer> {
    const [first] = this.#chunks;
    if (first !== undefined && this.#chunks.length === 1) {
      return first;
    }
    const all = new Uint8Array(this.#buffered);
    let offset = 0;
    for (const chunk of this.#chunks) {
      all.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.#chunks = [all];
    return all;
  }
}
