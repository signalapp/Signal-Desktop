// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Uuid } from '../formats/Uuid.std.ts';
import { Utf8 } from '../encodings/Utf8.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type ServerGuid = ServerGuid.Decoded;

export namespace ServerGuid {
  type Opaque = Tagged<Uuid, 'ServerGuid'>;

  /** @public */
  export type Decoded = Utf8.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<ServerGuid, string> = z.pipe(
    Uuid.Schema,
    z.custom<ServerGuid>()
  );

  /** @public */
  export function isValid(input: Uuid): input is ServerGuid {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromUuid(input: Uuid): ServerGuid {
    return Schema.parse(input);
  }

  /** @public */
  export function fromString(input: string): ServerGuid {
    return fromUuid(Uuid.fromString(input));
  }

  /** @public */
  export function decode(input: Encoded): ServerGuid {
    return Utf8.fromBytes(input);
  }

  /** @public */
  export function encode(input: ServerGuid): Encoded {
    return Utf8.toBytes(input);
  }
}
