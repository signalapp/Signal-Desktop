// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import type { ServiceId } from './ServiceId.std.ts';
import type { DeviceId } from './DeviceId.std.ts';
import { Utf8 } from '../encodings/Utf8.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';
import { parseAddress } from '../_utils/address.std.ts';
import type { AddressInfo } from './AddressInfo.std.ts';
import { checkWithParser } from '../_utils/schemas.std.ts';

/**
 * Address serialized as `"${serviceId}.${deviceId}"`.
 * @public
 */
export type Address = Address.Decoded;

export namespace Address {
  type Opaque = Tagged<`${ServiceId}.${DeviceId}`, 'Address'>;

  /** @public */
  export type Decoded = Utf8.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<Address, string> = z.pipe(
    z.string().check(checkWithParser(parseAddress)),
    z.custom<Address>()
  );

  /** @public */
  export function isValid(input: string): input is Address {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): Address {
    return Schema.parse(input);
  }

  /** @public */
  export function fromAddressInfo(input: AddressInfo): Address {
    return `${input.serviceId}.${input.deviceId}` as Address;
  }

  /** @public */
  export function decode(input: Encoded): Address {
    return Utf8.fromBytes(input);
  }

  /** @public */
  export function encode(input: Address): Encoded {
    return Utf8.toBytes(input);
  }
}
