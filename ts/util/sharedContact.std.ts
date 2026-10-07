// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { AciString } from '../types/ServiceId.std.ts';
import type {
  EmbeddedContactForUIType,
  EmbeddedContactType,
} from '../types/EmbeddedContact.std.ts';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.ts';

export type SharedContactRecipientType = Readonly<{
  conversationId: string;
  isUnregistered: boolean;
}>;

export type SharedContactLookupsType = Readonly<{
  getRecipientByServiceId: (
    serviceId: AciString
  ) => SharedContactRecipientType | undefined;
  getRecipientByE164: (e164: string) => SharedContactRecipientType | undefined;
}>;

export type SharedContactResolutionType = Readonly<
  | { type: 'existing'; conversationId: string }
  | { type: 'aci'; aci: AciString }
  | { type: 'not-on-signal' }
>;

const NOT_ON_SIGNAL = { type: 'not-on-signal' } as const;

/**
 * How to start a conversation with a shared contact, without
 * creating a conversation locally
 */
export function resolveSharedContact(
  contact: ReadonlyDeep<Pick<EmbeddedContactType, 'aci' | 'number'>>,
  { getRecipientByServiceId, getRecipientByE164 }: SharedContactLookupsType
): SharedContactResolutionType {
  if (contact.aci) {
    const existing = getRecipientByServiceId(contact.aci);
    if (existing == null) {
      return { type: 'aci', aci: contact.aci };
    }
    return existing.isUnregistered
      ? NOT_ON_SIGNAL
      : { type: 'existing', conversationId: existing.conversationId };
  }

  for (const { value: e164 } of contact.number ?? []) {
    const existing = getRecipientByE164(e164);
    if (existing != null && !existing.isUnregistered) {
      return { type: 'existing', conversationId: existing.conversationId };
    }
  }

  return NOT_ON_SIGNAL;
}

export function canMessageSharedContact(
  contact: ReadonlyDeep<Pick<EmbeddedContactForUIType, 'resolution'>>
): boolean {
  return contact.resolution.type !== 'not-on-signal';
}

export function formatEmbeddedContactForUI(
  contact: ReadonlyDeep<EmbeddedContactType>,
  resolution: SharedContactResolutionType
): ReadonlyDeep<EmbeddedContactForUIType> {
  const { avatar } = contact;
  let avatarForUI: EmbeddedContactForUIType['avatar'];
  if (avatar && avatar.avatar) {
    if (avatar.avatar.error) {
      avatarForUI = undefined;
    } else {
      avatarForUI = {
        ...avatar,
        avatar: {
          ...avatar.avatar,
          url: avatar.avatar.path
            ? getLocalAttachmentUrl(avatar.avatar)
            : undefined,

          // `error` case is handled above
          isPermanentlyUndownloadable: false,
        },
      };
    }
  }

  return {
    ...contact,
    avatar: avatarForUI,
    resolution,
  };
}
