<!-- Copyright 2014 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# @signalapp/types

This package provides shared opaque and utility types and related helper
functions for use across different Signal libraries and desktop apps.

```ts
import { Aci, SentTimestampMs, DurationSecs } from '@signalapp/types';

export type PinnedMessage = Readonly<{
  targetSentTimestamp: SentTimestampMs;
  targetAuthorAci: Aci;
  pinDuration: DurationSecs;
}>;
```

## API

```ts
import type { Tagged } from 'type-fest';

// Result
type Result<T, E = string> = Result.Ok<T> | Result.Err<E>;
type Result.Ok<T> = Readonly<{ ok: true; value: T; error?: never; }>;
type Result.Err<E = string> = Readonly<{ ok: false; value?: never; error: E; }>;

// Numbers
type Uint8 = Tagged<number, 'Uint8'>;
type Uint16 = Tagged<number, 'Uint16'>;
type Uint32 = Tagged<number, 'Uint32'>;
type BigUint64 = Tagged<bigint, 'BigUint64'>;
type BigUint128 = Tagged<bigint, 'BigUint128'>;
type Int8 = Tagged<number, 'Int8'>;
type Int16 = Tagged<number, 'Int16'>;
type Int32 = Tagged<number, 'Int32'>;
type BigInt64 = Tagged<bigint, 'BigInt64'>;
type BigInt128 = Tagged<bigint, 'BigInt128'>;
type Float16 = Tagged<number, 'Float16'>;
type Float32 = Tagged<number, 'Float32'>;
type Float64 = Tagged<number, 'Float64'>;

// Units
type UnitBytes = Tagged<Float64, 'UnitBytes'>;;
type UnitKilobytes = Tagged<Float64, 'UnitKilobytes'>;
type UnitKibibytes = Tagged<Float64, 'UnitKibibytes'>;

// Datetime
type TimestampMs = Tagged<number, 'TimestampMs'>;
type TimestampSecs = Tagged<number, 'TimestampSecs'>;
type DurationMs = Tagged<Uint32, 'DurationMs'>;
type DurationSecs = Tagged<Uint32, 'DurationSecs'>;
type DurationDays = Tagged<Uint32, 'DurationDays'>;
type PlainTimeHourMin = Tagged<Uint32, 'PlainTimeHourMin'>;

// Encodings
type Bytes = Uint8Array<ArrayBuffer>;
type Bytes.Of<T> = Tagged<Bytes, 'Bytes.Of', T>;
type Base64 = Tagged<string, 'Base64'>;
type Base64.Of<T> = Tagged<Base64, 'Base64.Of', T>;
type Base64Url = Tagged<string, 'Base64Url'>;
type Base64Url.Of<T> = Tagged<Base64Url, 'Base64URL.Of', T>;
type Hex = Tagged<string, 'Hex'>;
type Hex.Of<T> = Tagged<Hex, 'Hex.Of', T>;
type Json = Tagged<string, 'Json'>;
type Json.Of<T extends JsonValue> = Tagged<Json, 'Json.Of', T>;
type JsonPrimitive = null | boolean | number | string;
type JsonArray = Array<JsonValue> | ReadonlyArray<JsonValue>;
type JsonObject = { [Key in string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;
type Utf8.Of<T extends string> = Tagged<T, 'Utf8.Of'>;

// Formats
type HexColor = Tagged<`#${string}`, 'HexColor'>;
type HttpUrl = Tagged<string, 'HttpUrl'>;
type LanguageTag = Tagged<string, 'LanguageTag'>;
type MimeType = Tagged<`${string}/${string}`, 'MimeType'>;
type Semver = Tagged<string, 'Semver'>;
type Uuid = Tagged<string, 'Uuid'>;

// Service
type E164 = E164.Decoded;
type E164.Opaque = Tagged<`+${string}`, 'E164'>;
type E164.Encoded = Utf8.Of<E164.Opaque>;
type E164.Decoded = Bytes.Of<E164.Opaque>;

type Aci = Aci.Decoded;
type Aci.Opaque = Tagged<Uuid, 'Aci'>;
type Aci.Decoded = Utf8.Of<Aci.Opaque>;
type Aci.Encoded = Bytes.Of<Aci.Opaque>;

type Pni = Utf8.Of<Pni.Opaque>;
type Pni.Opaque = Tagged<`PNI:${Uuid}`, 'Pni'>;
type Pni.Decoded = Utf8.Of<Pni.Opaque>;
type Pni.Encoded = Bytes.Of<Pni.Opaque>;

type UntaggedPni = UntaggedPni.Decoded;
type UntaggedPni.Opaque = Tagged<Uuid, 'UntaggedPni'>;
type UntaggedPni.Decoded = Utf8.Of<UntaggedPni.Opaque>;
type UntaggedPni.Encoded = Bytes.Of<UntaggedPni.Opaque>;

type ServiceId = ServiceId.Decoded;
type ServiceId.Decoded = Aci | Pni;
type ServiceId.Encoded = Bytes.Of<Decoded>;

type DeviceId = Tagged<Uint32, 'DeviceId'>;

type Address = Address.Decoded;
type Address.Opaque = Tagged<`${ServiceId}.${DeviceId}`, 'Address'>;
type Address.Decoded = Utf8.Of<Address.Opaque>;
type Address.Encoded = Bytes.Of<Address.Opaque>;

type AddressInfo = Tagged<AddressInfo.Params, 'AddressInfo'>;
type AddressInfo.Params = Readonly<{ serviceId: ServiceId; deviceId: DeviceId; }>;

type DistributionId = Utf8.Of<DistributionId.Opaque>;
type DistributionId.Opaque = Tagged<Uuid, 'DistributionId'>;

type DistributionId = DistributionId.Decoded;
type DistributionId.Opaque = Tagged<Uuid, 'DistributionId'>;
type DistributionId.Decoded = Utf8.Of<DistributionId.Opaque>;
type DistributionId.Encoded = Bytes.Of<DistributionId.Opaque>;

type GroupId = GroupId.Decoded;
type GroupId.Opaque = Tagged<unknown, 'GroupId'>;
type GroupId.Decoded = Base64.Of<GroupId.Opaque>;
type GroupId.Encoded = Bytes.Of<GroupId.Opaque>;

type DistributionListId = DistributionListId.Decoded;
type DistributionListId.Opaque = Tagged<Uuid, 'DistributionListId'>;
type DistributionListId.Decoded = Utf8.Of<DistributionListId.Opaque>;
type DistributionListId.Encoded = Bytes.Of<DistributionListId.Opaque>;

type SentTimestampMs = Tagged<TimestampMs, 'SentTimestampMs'>;
type ServerTimestampMs = Tagged<TimestampMs, 'ServerTimestampMs'>;
type ReceivedTimestampMs = Tagged<TimestampMs, 'ReceivedTimestampMs'>;

type StorageManifestVersion = Tagged<BigUint64, 'StorageManifestVersion'>;

type StorageItemKey = StorageItemKey.Decoded;
type StorageItemKey.Opaque = Tagged<unknown, 'StorageItemKey'>;
type StorageItemKey.Decoded = Base64.Of<Opaque>;
type StorageItemKey.Encoded = Bytes.Of<Opaque>;
```

### Schemas

Almost all of these types provide Zod schemas:

```ts
import { Aci, SentTimestampMs, DurationSecs } from '@signalapp/types';

export const PinnedMessageSchema = z.object({
  targetSentTimestamp: SentTimestampMs.Schema,
  targetAuthorAci: Aci.Schema,
  pinDuration: DurationSecs.Schema,
});
```

### Helpers

Types have helpers for casting loosely typed data to strict types:

> Note: You should prefer to use the most specific `from*` method that you can,
> it will generally have less runtime cost checking the type is valid.

```ts
Aci.isValid(input: string): input is Aci; // boolean
Aci.fromUuid(input: Uuid): Aci; // throws if invalid
Aci.fromString(input: string): Aci; // throws if invalid
```

### Encodings

Encodings have special `<Encoding>.Of<T>` types to represent internal opaque
types:

```ts
// Maybe this just represents some random number generation that we should not be aware of
export type MyOpaqueType = Tagged<unknown, 'MyOpaqueType'>;

export function decode(input: Bytes.Of<MyOpaqueType>): Base64.Of<MyOpaqueType> {
  return Base64.fromBytes(input);
}

export function encode(input: Bytes.Of<MyOpaqueType>): Base64.Of<MyOpaqueType> {
  return Base64.toBytes(input);
}
```

Many of the "service" types use these `<Encoding>.Of` types to wrap their own
internal `Opaque` type with expected encodings along with `encode` and `decode`
helpers:

```ts
export type StorageItemKey = StorageItemKey.Decoded;

export namespace StorageItemKey {
  type Opaque = Tagged<unknown, 'StorageItemKey'>;

  export type Decoded = Base64.Of<Opaque>;
  export type Encoded = Bytes.Of<Opaque>;

  export function decode(input: Encoded): StorageItemKey {
    return Base64.fromBytes(input);
  }

  export function encode(input: StorageItemKey): Encoded {
    return Base64.toBytes(input);
  }
}
```

## Future Ideas

- General:
  - [ ] `NonEmpty<T extends { length: number }>`
  - [ ] `NonZero<T extends number | bigint>`
- Units:
  - [ ] `Dimension`
  - [ ] `Width`
  - [ ] `Height`
  - [ ] `BlurHash`
  - [ ] `Email`
- File System:
  - [ ] `FileName`
  - [ ] `FilePath`
  - [ ] `FileExtension`
- Net:
  - [ ] `BasicAuth`
  - [ ] `IpV4`
  - [ ] `IpV6`
  - [ ] `IpAddr`
  - [ ] `Domain/Hostname`
  - [ ] `Protocol`
  - [ ] `Port`
- Service:
  - [ ] `Username`
  - [ ] `UserText` / `TrustedText`
