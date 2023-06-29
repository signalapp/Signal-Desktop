// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { UUIDKind } from '../types/UUID';
import type { UUIDStringType, TaggedUUIDStringType } from '../types/UUID';
import type { ConversationAttributesType } from '../model-types.d';
import { strictAssert } from './assert';

export type MinimalConversationType = Pick<
  ConversationAttributesType,
  'uuid' | 'pni'
>;

export function getConversationUuid(
  { uuid, pni }: MinimalConversationType,
  uuidKind = UUIDKind.ACI
): UUIDStringType | undefined {
  if (uuidKind === UUIDKind.PNI) {
    return pni;
  }

  strictAssert(
    uuidKind === UUIDKind.ACI,
    'getConversationUuid accepts either ACI or PNI uuid kind'
  );

  // When we know only PNI - we put PNI into both `uuid` and `pni` fields.
  if (pni === uuid) {
    return undefined;
  }

  return uuid;
}

export function getTaggedConversationUuid(
  attributes: MinimalConversationType
): TaggedUUIDStringType | undefined {
  const aci = getConversationUuid(attributes, UUIDKind.ACI);
  if (aci) {
    return { aci, pni: undefined };
  }

  const pni = getConversationUuid(attributes, UUIDKind.PNI);
  if (pni) {
    return { aci: undefined, pni };
  }

  return undefined;
}
