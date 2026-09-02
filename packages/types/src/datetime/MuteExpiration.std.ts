// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { MAX_SAFE_DATE } from '../_utils/datetime.std.ts';
import { bigIntToNumber } from '../_utils/numbers.std.ts';
import { BigInt64 } from '../numbers/BigInt64.std.ts';
import type { Float64 } from '../numbers/Float64.std.ts';
import type { TimestampMs } from './TimestampMs.std.ts';
import type { DurationMs } from './DurationMs.std.ts';

export type MuteExpiration = Tagged<Float64, 'MuteExpiration'>;

export namespace MuteExpiration {
  /** @public */
  export const UNMUTED = 0 as MuteExpiration;

  /**
   * "Muted forever" as we store it locally
   * @public
   */
  export const ALWAYS = Number.MAX_SAFE_INTEGER as MuteExpiration;

  /** "Muted forever" as stored in protos */
  const ALWAYS_PROTO = BigInt64.MAX;

  /** @public */
  export const Schema: z.ZodMiniType<MuteExpiration, number> = z.pipe(
    z.number().check(z.int(), z.minimum(UNMUTED), z.maximum(ALWAYS)),
    z.custom<MuteExpiration>()
  );

  /** @public */
  export function isValid(input: number): input is MuteExpiration {
    return Schema.safeParse(input).success;
  }

  /**
   * Returns MuteExpiration (clamping input if needed)
   * @public
   * */
  export function fromNumber(input: number): MuteExpiration {
    if (input <= 0) {
      return UNMUTED;
    }
    return Schema.parse(Math.min(input, ALWAYS));
  }

  /** @public */
  export function fromTimestamp(input: TimestampMs): MuteExpiration {
    return fromNumber(input);
  }

  /** @public */
  export function fromDuration(input: DurationMs): MuteExpiration {
    return fromNumber(Date.now() + input);
  }

  /** @public */
  export function fromProto(input: bigint | null): MuteExpiration {
    if (input == null || input <= 0n) {
      return UNMUTED;
    }
    if (input >= MAX_SAFE_DATE) {
      return ALWAYS;
    }
    return fromNumber(bigIntToNumber(input));
  }

  /** @public */
  export function toProto(input: MuteExpiration | null | undefined): bigint {
    if (input == null || input <= UNMUTED) {
      return 0n;
    }
    if (input >= MAX_SAFE_DATE) {
      return ALWAYS_PROTO;
    }
    return BigInt64.fromNumber(input);
  }

  /** @public */
  export function isAlways(input: MuteExpiration): boolean {
    return input >= ALWAYS;
  }

  /** @public */
  export function isActive(input: MuteExpiration): boolean {
    return Date.now() < input;
  }
}
