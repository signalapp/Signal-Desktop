// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert';

import type { ServiceIdString } from './ServiceId';
import { isServiceIdString } from './ServiceId';

export type AddressStringType = `${ServiceIdString}.${number}`;

const ADDRESS_REGEXP = /^([:0-9a-f-]+).(\d+)$/i;

export class Address {
  constructor(
    public readonly serviceId: ServiceIdString,
    public readonly deviceId: number
  ) {}

  public toString(): AddressStringType {
    return `${this.serviceId}.${this.deviceId}`;
  }

  public static parse(value: string): Address {
    const match = value.match(ADDRESS_REGEXP);
    strictAssert(match != null, `Invalid Address: ${value}`);
    const [whole, serviceId, deviceId] = match;
    strictAssert(whole === value, 'Integrity check');
    strictAssert(isServiceIdString(serviceId), 'Their service id is incorrect');
    return Address.create(serviceId, parseInt(deviceId, 10));
  }

  public static create(serviceId: ServiceIdString, deviceId: number): Address {
    return new Address(serviceId, deviceId);
  }
}
