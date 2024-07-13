// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';

import { makeEnumParser } from './enum';
import { missingCaseError } from './missingCaseError';
import { isDirectConversation, isMe } from './whatTypeOfConversation';

// These strings are saved to disk, so be careful when changing them.
export enum PhoneNumberSharingMode {
  Everybody = 'Everybody',
  ContactsOnly = 'ContactsOnly',
  Nobody = 'Nobody',
}

export const parsePhoneNumberSharingMode = makeEnumParser(
  PhoneNumberSharingMode,
  PhoneNumberSharingMode.Nobody
);

export const isSharingPhoneNumberWithEverybody = (): boolean => {
  const phoneNumberSharingMode = parsePhoneNumberSharingMode(
    window.storage.get('phoneNumberSharingMode')
  );

  switch (phoneNumberSharingMode) {
    case PhoneNumberSharingMode.Everybody:
      return true;
    case PhoneNumberSharingMode.ContactsOnly:
    case PhoneNumberSharingMode.Nobody:
      return false;
    default:
      throw missingCaseError(phoneNumberSharingMode);
  }
};

export const shouldSharePhoneNumberWith = (
  conversation: ConversationAttributesType
): boolean => {
  if (!isDirectConversation(conversation) || isMe(conversation)) {
    return false;
  }

  return isSharingPhoneNumberWithEverybody();
};
