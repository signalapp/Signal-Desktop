// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { ContactAvatarType } from '../types/Avatar.std.ts';
import {
  getDisplayName,
  type EmbeddedContactName,
  type EmbeddedContactNickname,
} from '../types/EmbeddedContact.std.ts';
import { format as formatPhoneNumber } from '../types/PhoneNumber.std.ts';
import type { AciString, ServiceIdString } from '../types/ServiceId.std.ts';
import { getE164 } from './getE164.std.ts';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.ts';
import { isAciString } from './isAciString.std.ts';
import { isConversationEverUnregistered } from './isConversationEverUnregistered.std.ts';
import { isNotNil } from './isNotNil.std.ts';

export type ShareContactAvatarType = Readonly<{
  url: string;
  isProfile: boolean;
  // The file that was displayed, so that's what gets sent
  attachment: ContactAvatarType;
}>;

export type ShareContactDraftType = Readonly<{
  aci: AciString | null;
  // `null` means the default (initials) avatar
  avatar: ShareContactAvatarType | null;
  // System contact avatar first, then profile avatar
  avatarOptions: ReadonlyArray<ShareContactAvatarType>;
  name: EmbeddedContactName | null;
  e164: string | null;
  organization: string | null;
  nickname: EmbeddedContactNickname | null;
  note: string | null;
}>;

export type ShareContactType = Omit<ShareContactDraftType, 'avatarOptions'>;

// The avatar (if it exists) and name are always sent (but can be edited)
export type ShareContactSelectionType = Readonly<{
  e164: boolean;
  nickname: boolean;
  note: boolean;
}>;

// If e164 but no name, set the formatted number as the given name
export function withE164AsMissingName(
  draft: ShareContactDraftType,
  ourRegionCode: string | undefined
): ShareContactDraftType {
  if (draft.name != null || draft.e164 == null) {
    return draft;
  }
  return {
    ...draft,
    name: {
      givenName: formatPhoneNumber(draft.e164, { ourRegionCode }),
    },
  };
}

export function getDefaultShareContactSelection(
  draft: ShareContactDraftType
): ShareContactSelectionType {
  return {
    e164: draft.e164 != null,
    nickname: false,
    note: false,
  };
}

export function applyShareContactSelection(
  draft: ShareContactDraftType,
  selection: ShareContactSelectionType
): ShareContactType {
  return {
    aci: draft.aci,
    avatar: draft.avatar,
    name: draft.name,
    e164: selection.e164 ? draft.e164 : null,
    nickname: selection.nickname ? draft.nickname : null,
    note: selection.note ? draft.note : null,
    organization: draft.organization,
  };
}

// `aci` is only set for registered contacts
export function canShareContact(contact: ShareContactType): boolean {
  const displayName = getDisplayName(contact);

  return (
    (displayName && displayName.length > 0 && contact.aci != null) ||
    contact.e164 != null
  );
}

function getRegisteredAci(
  conversation: Readonly<{
    serviceId?: ServiceIdString;
    discoveredUnregisteredAt?: number;
  }>
): AciString | null {
  if (
    !isAciString(conversation.serviceId) ||
    isConversationEverUnregistered(conversation)
  ) {
    return null;
  }
  return conversation.serviceId;
}

function getName(
  attributes: ConversationAttributesType
): EmbeddedContactName | null {
  const {
    systemGivenName,
    systemFamilyName,
    systemNickname,
    profileName,
    profileFamilyName,
  } = attributes;

  if (systemGivenName || systemFamilyName) {
    return {
      givenName: systemGivenName || undefined,
      familyName: systemFamilyName || undefined,
    };
  }
  if (systemNickname) {
    return { givenName: systemNickname };
  }
  if (profileName || profileFamilyName) {
    return {
      givenName: profileName || undefined,
      familyName: profileFamilyName || undefined,
    };
  }
  return null;
}

function getNickname(
  attributes: ConversationAttributesType
): EmbeddedContactNickname | null {
  const { nicknameGivenName, nicknameFamilyName } = attributes;
  if (!nicknameGivenName && !nicknameFamilyName) {
    return null;
  }
  return {
    givenName: nicknameGivenName || undefined,
    familyName: nicknameFamilyName || undefined,
  };
}

function toShareContactAvatar(
  attachment: ContactAvatarType | undefined,
  isProfile: boolean
): ShareContactAvatarType | null {
  if (!attachment?.path) {
    return null;
  }
  return {
    url: getLocalAttachmentUrl(attachment),
    isProfile,
    attachment,
  };
}

// When sharing contacts, we prefer the system contact avatar over the
// profile avatar, regardless of the user's display preference
function getAvatarOptions(
  attributes: ConversationAttributesType
): ReadonlyArray<ShareContactAvatarType> {
  return [
    toShareContactAvatar(attributes.avatar ?? undefined, false),
    toShareContactAvatar(attributes.profileAvatar ?? undefined, true),
  ].filter(isNotNil);
}

export function getShareContactDraft(
  attributes: ConversationAttributesType
): ShareContactDraftType {
  const avatarOptions = getAvatarOptions(attributes);
  return {
    aci: getRegisteredAci(attributes),
    avatar: avatarOptions.at(0) ?? null,
    avatarOptions,
    name: getName(attributes),
    e164: getE164(attributes) ?? null,
    nickname: getNickname(attributes),
    note: attributes.note || null,
    organization: null,
  };
}

// Mirrors `canShareContact(getShareContactDraft(...))` for redux conversations
export function canShareContactFromConversation(
  conversation: ConversationType
): boolean {
  if (getE164(conversation) != null) {
    return true;
  }

  const hasName = Boolean(
    conversation.systemGivenName ||
    conversation.systemFamilyName ||
    conversation.systemNickname ||
    conversation.profileName
  );

  return hasName && getRegisteredAci(conversation) != null;
}
