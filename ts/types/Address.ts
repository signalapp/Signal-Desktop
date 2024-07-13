// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from './ServiceId';

export type AddressStringType = `${ServiceIdString}.${number}`;

export class Address {
  constructor(
    public readonly serviceId: ServiceIdString,
    public readonly deviceId: number
  ) {}

  public toString(): AddressStringType {
    return `${this.serviceId}.${this.deviceId}`;
  }

  public static create(serviceId: ServiceIdString, deviceId: number): Address {
    return new Address(serviceId, deviceId);
  }
}
