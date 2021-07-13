// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { bytes } = window.SignalContext;

export function fromBase64(value: string): Uint8Array {
  return bytes.fromBase64(value);
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

export function concatenate(list: Array<Uint8Array>): Uint8Array {
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
