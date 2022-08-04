// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUUID } from 'uuid';

import { strictAssert } from '../util/assert';

export type UUIDStringType =
  `${string}-${string}-${string}-${string}-${string}`;

export enum UUIDKind {
  ACI = 'ACI',
  PNI = 'PNI',
  Unknown = 'Unknown',
}

export const UUID_BYTE_SIZE = 16;

export const isValidUuid = (value: unknown): value is UUIDStringType =>
  typeof value === 'string' &&
  /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(
    value
  );

export class UUID {
  constructor(protected readonly value: string) {
    strictAssert(isValidUuid(value), `Invalid UUID: ${value}`);
  }

  public toString(): UUIDStringType {
    return this.value as UUIDStringType;
  }

  public isEqual(other: UUID): boolean {
    return this.value === other.value;
  }

  public static parse(value: string): UUID {
    return new UUID(value);
  }

  public static lookup(identifier: string): UUID | undefined {
    const conversation = window.ConversationController.get(identifier);
    const uuid = conversation?.get('uuid');
    if (uuid === undefined) {
      return undefined;
    }

    return new UUID(uuid);
  }

  public static checkedLookup(identifier: string): UUID {
    const uuid = UUID.lookup(identifier);
    strictAssert(
      uuid !== undefined,
      `Conversation ${identifier} not found or has no uuid`
    );
    return uuid;
  }

  public static generate(): UUID {
    return new UUID(generateUUID());
  }

  public static cast(value: UUIDStringType): never;
  public static cast(value: string): UUIDStringType;

  public static cast(value: string): UUIDStringType {
    return new UUID(value.toLowerCase()).toString();
  }

  // For testing
  public static fromPrefix(value: string): UUID {
    let padded = value;
    while (padded.length < 8) {
      padded += '0';
    }
    return new UUID(`${padded}-0000-4000-8000-${'0'.repeat(12)}`);
  }
}
