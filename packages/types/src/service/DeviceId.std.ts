// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';

/**
 * Identifies a specific registered device within an account.
 * @public
 */
export type DeviceId = Tagged<number, 'DeviceId'>;

export namespace DeviceId {
  /** @public */
  export const MIN = 1 as DeviceId;

  /** @public */
  export const MAX = 127 as DeviceId;

  /** @public */
  export const Schema: z.ZodMiniType<DeviceId, number> = z.pipe(
    z.number().check(z.int(), z.minimum(MIN), z.maximum(MAX)),
    z.custom<DeviceId>()
  );

  /** @public */
  export function isValid(input: number): input is DeviceId {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromNumber(input: number): DeviceId {
    return Schema.parse(input);
  }
}
