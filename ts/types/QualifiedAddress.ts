// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert';

import type { UUIDStringType } from './UUID';
import { UUID } from './UUID';
import type { AddressStringType } from './Address';
import { Address } from './Address';

const QUALIFIED_ADDRESS_REGEXP = /^([0-9a-f-]+):([0-9a-f-]+).(\d+)$/i;

export type QualifiedAddressCreateOptionsType = Readonly<{
  ourUuid: string;
  uuid: string;
  deviceId: number;
}>;

export type QualifiedAddressStringType =
  `${UUIDStringType}:${AddressStringType}`;

export class QualifiedAddress {
  constructor(
    public readonly ourUuid: UUID,
    public readonly address: Address
  ) {}

  public get uuid(): UUID {
    return this.address.uuid;
  }

  public get deviceId(): number {
    return this.address.deviceId;
  }

  public toString(): QualifiedAddressStringType {
    return `${this.ourUuid.toString()}:${this.address.toString()}`;
  }

  public static parse(value: string): QualifiedAddress {
    const match = value.match(QUALIFIED_ADDRESS_REGEXP);
    strictAssert(match !== null, `Invalid QualifiedAddress: ${value}`);
    const [whole, ourUuid, uuid, deviceId] = match;
    strictAssert(whole === value, 'Integrity check');

    return new QualifiedAddress(
      new UUID(ourUuid),
      Address.create(uuid, parseInt(deviceId, 10))
    );
  }
}
