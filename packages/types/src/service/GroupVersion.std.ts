// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Uint32 } from '../numbers/Uint32.std.ts';

/**
 * An incrementing integer representing the order of snapshots of group state
 * @public
 */
export type GroupVersion = Tagged<Uint32, 'GroupVersion'>;

export namespace GroupVersion {
  /** @public */
  export const Schema: z.ZodMiniType<GroupVersion, number> = z.pipe(
    Uint32.Schema,
    z.custom<GroupVersion>()
  );

  /** @public */
  export function isValid(input: number): input is GroupVersion {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromUint32(input: Uint32): GroupVersion {
    return Schema.parse(input);
  }

  /** @public */
  export function fromNumber(input: number): GroupVersion {
    return fromUint32(Uint32.fromNumber(input));
  }
}
