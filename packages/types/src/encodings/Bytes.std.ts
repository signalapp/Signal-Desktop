// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';

export type MaybeSharedBytes = Uint8Array<ArrayBuffer | SharedArrayBuffer>;

/**
 * A `Uint8Array` backed by a standard (non-shared) `ArrayBuffer`.
 * @public
 */
export type Bytes = Uint8Array<ArrayBuffer>;

export namespace Bytes {
  /** @public */
  export type Of<T> = Tagged<Bytes, 'Bytes.Of', T>;

  /** @public */
  export const Schema: z.ZodMiniType<Bytes, MaybeSharedBytes> = z.pipe(
    z.instanceof(Uint8Array),
    z.custom<Bytes>(input => {
      return input.buffer instanceof ArrayBuffer;
    })
  );

  /** @public */
  export function isValid(input: MaybeSharedBytes): input is Bytes {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromMaybeSharedBytes(input: MaybeSharedBytes): Bytes {
    return Schema.parse(input);
  }
}
