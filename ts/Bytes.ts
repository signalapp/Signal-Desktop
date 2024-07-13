// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Bytes } from './context/Bytes';

const bytes = globalThis.window?.SignalContext?.bytes || new Bytes();

export function fromBase64(value: string): Uint8Array {
  return bytes.fromBase64(value);
}
export function fromBase64url(value: string): Uint8Array {
  return bytes.fromBase64url(value);
}

export function fromHex(value: string): Uint8Array {
  return bytes.fromHex(value);
}

// TODO(indutny): deprecate it
export function fromBinary(value: string): Uint8Array {
  return bytes.fromBinary(value);
}

export function fromString(value: string): Uint8Array {
  return bytes.fromString(value);
}

export function toBase64(data: Uint8Array): string {
  return bytes.toBase64(data);
}

export function toBase64url(data: Uint8Array): string {
  return bytes.toBase64url(data);
}

export function toHex(data: Uint8Array): string {
  return bytes.toHex(data);
}

// TODO(indutny): deprecate it
export function toBinary(data: Uint8Array): string {
  return bytes.toBinary(data);
}

export function toString(data: Uint8Array): string {
  return bytes.toString(data);
}

export function byteLength(value: string): number {
  return bytes.byteLength(value);
}

export function concatenate(list: ReadonlyArray<Uint8Array>): Uint8Array {
  return bytes.concatenate(list);
}

export function isEmpty(data: Uint8Array | null | undefined): boolean {
  return bytes.isEmpty(data);
}

export function isNotEmpty(
  data: Uint8Array | null | undefined
): data is Uint8Array {
  return !bytes.isEmpty(data);
}

export function areEqual(
  a: Uint8Array | null | undefined,
  b: Uint8Array | null | undefined
): boolean {
  return bytes.areEqual(a, b);
}

export function readBigUint64BE(value: Uint8Array): bigint {
  return bytes.readBigUint64BE(value);
}
