// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import type {
  AciString,
  PniString,
  ServiceIdString,
} from '../types/ServiceId.std.js';
import {
  normalizeServiceId,
  normalizePni,
  isUntaggedPniString,
  toTaggedPni,
  fromServiceIdObject,
  fromAciObject,
  fromPniObject,
} from '../types/ServiceId.std.js';
import * as Bytes from '../Bytes.std.js';
import { normalizeAci } from './normalizeAci.std.js';

export function toServiceIdObject(serviceId: ServiceIdString): ServiceId {
  return ServiceId.parseFromServiceIdString(serviceId);
}

export function toAciObject(aci: AciString): Aci {
  return Aci.parseFromServiceIdString(aci);
}

export function toPniObject(pni: PniString): Pni {
  return Pni.parseFromServiceIdString(pni);
}

export function fromServiceIdBinaryOrString(
  bytes: Uint8Array,
  fallback: string | undefined | null,
  context: string
): ServiceIdString;

export function fromServiceIdBinaryOrString(
  bytes: Uint8Array | undefined | null,
  fallback: string | undefined | null,
  context: string
): ServiceIdString | undefined;

export function fromServiceIdBinaryOrString(
  bytes: Uint8Array | undefined | null,
  fallback: string | undefined | null,
  context: string
): ServiceIdString | undefined {
  if (Bytes.isNotEmpty(bytes)) {
    return fromServiceIdObject(ServiceId.parseFromServiceIdBinary(bytes));
  }
  if (fallback) {
    return normalizeServiceId(fallback, context);
  }
  return undefined;
}

export function fromAciUuidBytes(bytes: Uint8Array): AciString;

export function fromAciUuidBytes(
  bytes: Uint8Array | undefined | null
): AciString | undefined;

export function fromAciUuidBytes(
  bytes: Uint8Array | undefined | null
): AciString | undefined {
  if (Bytes.isNotEmpty(bytes)) {
    return fromAciObject(Aci.fromUuidBytes(bytes));
  }
  return undefined;
}

export function fromAciUuidBytesOrString(
  bytes: Uint8Array,
  fallback: string | undefined | null,
  context: string
): AciString;

export function fromAciUuidBytesOrString(
  bytes: Uint8Array | undefined | null,
  fallback: string | undefined | null,
  context: string
): AciString | undefined;

export function fromAciUuidBytesOrString(
  bytes: Uint8Array | undefined | null,
  fallback: string | undefined | null,
  context: string
): AciString | undefined {
  if (Bytes.isNotEmpty(bytes)) {
    return fromAciUuidBytes(bytes);
  }
  if (fallback) {
    return normalizeAci(fallback, context);
  }
  return undefined;
}

export function fromPniUuidBytesOrUntaggedString(
  bytes: Uint8Array | undefined | null,
  fallback: string | undefined | null,
  context: string
): PniString | undefined {
  if (Bytes.isNotEmpty(bytes)) {
    return fromPniObject(Pni.fromUuidBytes(bytes));
  }
  if (fallback && isUntaggedPniString(fallback)) {
    return normalizePni(toTaggedPni(fallback), context);
  }
  return undefined;
}
