// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  ConversationRenderInfoType,
} from '../model-types.d';
import { combineNames } from './combineNames';
import { getRegionCodeForNumber } from './libphonenumberUtil';
import { isDirectConversation } from './whatTypeOfConversation';
import { getE164 } from './getE164';

type TitleOptions = {
  isShort?: boolean;
  ignoreNickname?: boolean;
};

export function getTitle(
  attributes: ConversationRenderInfoType,
  options?: TitleOptions
): string {
  const title = getTitleNoDefault(attributes, options);
  if (title) {
    return title;
  }

  if (isDirectConversation(attributes)) {
    return window.i18n('icu:unknownContact');
  }
  return window.i18n('icu:unknownGroup');
}

export function getTitleNoDefault(
  attributes: ConversationRenderInfoType,
  { isShort = false, ignoreNickname = false }: TitleOptions = {}
): string | undefined {
  if (!isDirectConversation(attributes)) {
    return attributes.name;
  }

  const { username } = attributes;

  let nicknameValue: string | undefined;
  if (!ignoreNickname) {
    nicknameValue =
      (isShort ? attributes.nicknameGivenName : undefined) ||
      getNicknameName(attributes);
  }

  return (
    nicknameValue ||
    (isShort ? attributes.systemGivenName : undefined) ||
    getSystemName(attributes) ||
    (isShort ? attributes.profileName : undefined) ||
    getProfileName(attributes) ||
    getNumber(attributes) ||
    username
  );
}

// Note that the used attributes field should match the ones we listen for
// change on in ConversationModel (see `ConversationModel#maybeClearUsername`)
export function canHaveUsername(
  attributes: Pick<
    ConversationAttributesType,
    | 'id'
    | 'type'
    | 'name'
    | 'profileName'
    | 'profileFamilyName'
    | 'e164'
    | 'systemGivenName'
    | 'systemFamilyName'
    | 'systemNickname'
    | 'nicknameGivenName'
    | 'nicknameFamilyName'
    | 'type'
  >,
  ourConversationId: string | undefined
): boolean {
  if (!isDirectConversation(attributes)) {
    return false;
  }

  if (ourConversationId === attributes.id) {
    return true;
  }

  return (
    !getNicknameName(attributes) &&
    !getSystemName(attributes) &&
    !getProfileName(attributes) &&
    !getNumber(attributes)
  );
}

export function getProfileName(
  attributes: Pick<
    ConversationAttributesType,
    'profileName' | 'profileFamilyName' | 'type'
  >
): string | undefined {
  if (isDirectConversation(attributes)) {
    return combineNames(attributes.profileName, attributes.profileFamilyName);
  }

  return undefined;
}

export function getNicknameName(
  attributes: Pick<
    ConversationAttributesType,
    'nicknameGivenName' | 'nicknameFamilyName' | 'type'
  >
): string | undefined {
  if (isDirectConversation(attributes)) {
    return combineNames(
      attributes.nicknameGivenName ?? undefined,
      attributes.nicknameFamilyName ?? undefined
    );
  }
  return undefined;
}

export function getSystemName(
  attributes: Pick<
    ConversationAttributesType,
    'systemGivenName' | 'systemFamilyName' | 'systemNickname' | 'type'
  >
): string | undefined {
  if (isDirectConversation(attributes)) {
    return (
      attributes.systemNickname ||
      combineNames(attributes.systemGivenName, attributes.systemFamilyName)
    );
  }

  return undefined;
}

export function getNumber(
  attributes: Pick<
    ConversationAttributesType,
    'e164' | 'type' | 'sharingPhoneNumber' | 'profileKey'
  >
): string | undefined {
  if (!isDirectConversation(attributes)) {
    return '';
  }

  const e164 = getE164(attributes);
  if (!e164) {
    return '';
  }

  return renderNumber(e164);
}

export function renderNumber(e164: string): string | undefined {
  try {
    const parsedNumber = window.libphonenumberInstance.parse(e164);
    const regionCode = getRegionCodeForNumber(e164);
    if (regionCode === window.storage.get('regionCode')) {
      return window.libphonenumberInstance.format(
        parsedNumber,
        window.libphonenumberFormat.NATIONAL
      );
    }
    return window.libphonenumberInstance.format(
      parsedNumber,
      window.libphonenumberFormat.INTERNATIONAL
    );
  } catch (e) {
    return undefined;
  }
}

export function hasNumberTitle(
  attributes: Pick<
    ConversationAttributesType,
    'e164' | 'type' | 'sharingPhoneNumber' | 'profileKey'
  >
): boolean {
  return (
    !getNicknameName(attributes) &&
    !getSystemName(attributes) &&
    !getProfileName(attributes) &&
    Boolean(getNumber(attributes))
  );
}

export function hasUsernameTitle(
  attributes: Pick<
    ConversationAttributesType,
    'e164' | 'type' | 'sharingPhoneNumber' | 'profileKey' | 'username'
  >
): boolean {
  return (
    !getNicknameName(attributes) &&
    !getSystemName(attributes) &&
    !getProfileName(attributes) &&
    !getNumber(attributes) &&
    Boolean(attributes.username)
  );
}
