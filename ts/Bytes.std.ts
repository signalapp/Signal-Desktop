// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  // Renderer/preload
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(value);
  }

  // Main
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(value, 'base64');
  }

  throw new Error('Unsupported');
}

export function fromHex(value: string): Uint8Array<ArrayBuffer> {
  // Renderer/preload
  if (Uint8Array.fromHex) {
    return Uint8Array.fromHex(value);
  }

  // Main
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(value, 'hex');
  }

  throw new Error('Unsupported');
}

// TODO(indutny): deprecate it
export function fromBinary(value: string): Uint8Array<ArrayBuffer> {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(value, 'binary');
  }

  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    // oxlint-disable-next-line no-bitwise
    out[i] = value.charCodeAt(i) & 0xff;
  }
  return out;
}

export function fromString(value: string): Uint8Array<ArrayBuffer> {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(value);
  }

  return encoder.encode(value);
}

export function toBase64(value: Uint8Array<ArrayBuffer>): string {
  // Renderer/preload
  if (value.toBase64) {
    return value.toBase64();
  }

  // Main
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(value).toString('base64');
  }

  throw new Error('Unsupported');
}

export function toBase64url(data: Uint8Array<ArrayBuffer>): string {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(data).toString('base64url');
  }

  return toBase64(data).replace(/\+/g, '-').replace(/\//g, '_');
}

export function toHex(value: Uint8Array<ArrayBuffer>): string {
  // Renderer/preload
  if (value.toHex) {
    return value.toHex();
  }

  // Main
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(value).toString('hex');
  }

  throw new Error('Unsupported');
}

// TODO(indutny): deprecate it
export function toBinary(data: Uint8Array<ArrayBuffer>): string {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(data).toString('binary');
  }

  return String.fromCharCode(...data);
}

export function toString(data: Uint8Array<ArrayBuffer>): string {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(data).toString();
  }

  return decoder.decode(data);
}

export function byteLength(value: string): number {
  if (globalThis.Buffer) {
    return globalThis.Buffer.byteLength(value);
  }
  return fromString(value).byteLength;
}

export function concatenate(
  list: ReadonlyArray<Uint8Array<ArrayBuffer>>
): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const chunk of list) {
    total += chunk.byteLength;
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of list) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

export function isEmpty(
  data: Uint8Array<ArrayBuffer> | null | undefined
): boolean {
  if (!data) {
    return true;
  }
  return data.length === 0;
}

export function isNotEmpty(
  data: Uint8Array<ArrayBuffer> | null | undefined
): data is Uint8Array<ArrayBuffer> {
  return !isEmpty(data);
}

export function areEqual(
  a: Uint8Array<ArrayBuffer> | null | undefined,
  b: Uint8Array<ArrayBuffer> | null | undefined
): boolean {
  if (!a || !b) {
    return !a && !b;
  }

  if (globalThis.Buffer) {
    return globalThis.Buffer.compare(a, b) === 0;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

export function readBigUint64BE(value: Uint8Array<ArrayBuffer>): bigint {
  if (value.length < 8) {
    throw new Error('Not enough bytes');
  }

  return (
    // oxlint-disable-next-line no-bitwise
    (BigInt(value[0] ?? 0) << 56n) |
    // oxlint-disable-next-line no-bitwise
    (BigInt(value[1] ?? 0) << 48n) |
    // oxlint-disable-next-line no-bitwise
    (BigInt(value[2] ?? 0) << 40n) |
    // oxlint-disable-next-line no-bitwise
    (BigInt(value[3] ?? 0) << 32n) |
    // oxlint-disable-next-line no-bitwise
    (BigInt(value[4] ?? 0) << 24n) |
    // oxlint-disable-next-line no-bitwise
    (BigInt(value[5] ?? 0) << 16n) |
    // oxlint-disable-next-line no-bitwise
    (BigInt(value[6] ?? 0) << 8n) |
    BigInt(value[7] ?? 0)
  );
}

export function isNonSharedUint8Array(
  value: unknown
): value is Uint8Array<ArrayBuffer> {
  return value instanceof Uint8Array && value.buffer instanceof ArrayBuffer;
}
