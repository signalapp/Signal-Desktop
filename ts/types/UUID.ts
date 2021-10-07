// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert';
import { isValidGuid } from '../util/isValidGuid';

export type UUIDStringType = `${string}-${string}-${string}-${string}-${string}`;

export class UUID {
  constructor(protected readonly value: string) {
    strictAssert(isValidGuid(value), `Invalid UUID: ${value}`);
  }

  public toString(): UUIDStringType {
    return (this.value as unknown) as UUIDStringType;
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
}
