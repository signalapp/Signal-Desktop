// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'buffer';

export class Bytes {
  public fromBase64(value: string): Uint8Array {
    return Buffer.from(value, 'base64');
  }

  public fromBase64url(value: string): Uint8Array {
    return Buffer.from(value, 'base64url');
  }

  public fromHex(value: string): Uint8Array {
    return Buffer.from(value, 'hex');
  }

  // TODO(indutny): deprecate it
  public fromBinary(value: string): Uint8Array {
    return Buffer.from(value, 'binary');
  }

  public fromString(value: string): Uint8Array {
    return Buffer.from(value);
  }

  public toBase64(data: Uint8Array): string {
    return Buffer.from(data).toString('base64');
  }

  public toBase64url(data: Uint8Array): string {
    return Buffer.from(data).toString('base64url');
  }

  public toHex(data: Uint8Array): string {
    return Buffer.from(data).toString('hex');
  }

  // TODO(indutny): deprecate it
  public toBinary(data: Uint8Array): string {
    return Buffer.from(data).toString('binary');
  }

  public toString(data: Uint8Array): string {
    return Buffer.from(data).toString();
  }

  public byteLength(value: string): number {
    return Buffer.byteLength(value);
  }

  public concatenate(list: ReadonlyArray<Uint8Array>): Uint8Array {
    return Buffer.concat(list);
  }

  public isEmpty(data: Uint8Array | null | undefined): boolean {
    if (!data) {
      return true;
    }
    return data.length === 0;
  }

  public isNotEmpty(data: Uint8Array | null | undefined): data is Uint8Array {
    return !this.isEmpty(data);
  }

  public areEqual(
    a: Uint8Array | null | undefined,
    b: Uint8Array | null | undefined
  ): boolean {
    if (!a || !b) {
      return !a && !b;
    }

    return Buffer.compare(a, b) === 0;
  }

  public readBigUint64BE(value: Uint8Array): bigint {
    const buffer = Buffer.from(value);
    return buffer.readBigUint64BE();
  }
}
