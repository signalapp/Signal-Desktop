// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationAttributesType,
  ConversationRenderInfoType,
} from '../model-types.d';
import { combineNames } from './combineNames';
import { getRegionCodeForNumber } from './libphonenumberUtil';
import { isDirectConversation } from './whatTypeOfConversation';

export function getTitle(
  attributes: ConversationRenderInfoType,
  options?: { isShort?: boolean }
): string {
  const title = getTitleNoDefault(attributes, options);
  if (title) {
    return title;
  }

  if (isDirectConversation(attributes)) {
    return window.i18n('unknownContact');
  }
  return window.i18n('unknownGroup');
}

export function getTitleNoDefault(
  attributes: ConversationRenderInfoType,
  { isShort = false }: { isShort?: boolean } = {}
): string | undefined {
  if (!isDirectConversation(attributes)) {
    return attributes.name;
  }

  const { username } = attributes;

  return (
    (isShort ? attributes.systemGivenName : undefined) ||
    attributes.name ||
    (isShort ? attributes.profileName : undefined) ||
    getProfileName(attributes) ||
    getNumber(attributes) ||
    (username && window.i18n('at-username', { username }))
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

export function getNumber(
  attributes: Pick<ConversationAttributesType, 'e164' | 'type'>
): string {
  if (!isDirectConversation(attributes)) {
    return '';
  }

  const { e164 } = attributes;
  if (!e164) {
    return '';
  }

  return renderNumber(e164);
}

export function renderNumber(e164: string): string {
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
    return e164;
  }
}
