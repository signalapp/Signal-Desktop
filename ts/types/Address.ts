// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert';

import type { UUIDStringType } from './UUID';
import { UUID } from './UUID';

export type AddressStringType = `${UUIDStringType}.${number}`;

const ADDRESS_REGEXP = /^([0-9a-f-]+).(\d+)$/i;

export class Address {
  constructor(public readonly uuid: UUID, public readonly deviceId: number) {}

  public toString(): AddressStringType {
    return `${this.uuid.toString()}.${this.deviceId}`;
  }

  public static parse(value: string): Address {
    const match = value.match(ADDRESS_REGEXP);
    strictAssert(match !== null, `Invalid Address: ${value}`);
    const [whole, uuid, deviceId] = match;
    strictAssert(whole === value, 'Integrity check');
    return Address.create(uuid, parseInt(deviceId, 10));
  }

  public static create(uuid: string, deviceId: number): Address {
    return new Address(new UUID(uuid), deviceId);
  }
}
