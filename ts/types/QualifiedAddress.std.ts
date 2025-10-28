// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert.std.js';

import type { ServiceIdString } from './ServiceId.std.js';
import { isServiceIdString } from './ServiceId.std.js';
import type { AddressStringType } from './Address.std.js';
import { Address } from './Address.std.js';

const QUALIFIED_ADDRESS_REGEXP =
  /^((?:PNI:)?[:0-9a-f-]+):((?:PNI:)?[:0-9a-f-]+).(\d+)$/i;

export type QualifiedAddressCreateOptionsType = Readonly<{
  ourServiceId: ServiceIdString;
  serviceId: ServiceIdString;
  deviceId: number;
}>;

export type QualifiedAddressStringType =
  `${ServiceIdString}:${AddressStringType}`;

export class QualifiedAddress {
  constructor(
    public readonly ourServiceId: ServiceIdString,
    public readonly address: Address
  ) {}

  public get serviceId(): ServiceIdString {
    return this.address.serviceId;
  }

  public get deviceId(): number {
    return this.address.deviceId;
  }

  public toString(): QualifiedAddressStringType {
    return `${this.ourServiceId}:${this.address.toString()}`;
  }

  public static parse(value: string): QualifiedAddress {
    const match = value.match(QUALIFIED_ADDRESS_REGEXP);
    strictAssert(match != null, `Invalid QualifiedAddress: ${value}`);
    const [whole, ourServiceId, serviceId, deviceId] = match;
    strictAssert(whole === value, 'Integrity check');
    strictAssert(
      isServiceIdString(ourServiceId),
      'Our service id is incorrect'
    );
    strictAssert(isServiceIdString(serviceId), 'Their service id is incorrect');

    return new QualifiedAddress(
      ourServiceId,
      Address.create(serviceId, parseInt(deviceId, 10))
    );
  }
}
