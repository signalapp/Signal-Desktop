// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from './ServiceId.std.ts';

export type AddressStringType = `${ServiceIdString}.${number}`;

export class Address {
  public readonly serviceId: ServiceIdString;
  public readonly deviceId: number;

  constructor(serviceId: ServiceIdString, deviceId: number) {
    this.serviceId = serviceId;
    this.deviceId = deviceId;
  }

  public toString(): AddressStringType {
    return `${this.serviceId}.${this.deviceId}`;
  }

  public static create(serviceId: ServiceIdString, deviceId: number): Address {
    return new Address(serviceId, deviceId);
  }
}
