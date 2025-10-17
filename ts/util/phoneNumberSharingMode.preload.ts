// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

import {
  PhoneNumberSharingMode,
  parsePhoneNumberSharingMode,
} from '../types/PhoneNumberSharingMode.std.js';
import { missingCaseError } from './missingCaseError.std.js';
import { isDirectConversation, isMe } from './whatTypeOfConversation.dom.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export const isSharingPhoneNumberWithEverybody = (): boolean => {
  const phoneNumberSharingMode = parsePhoneNumberSharingMode(
    itemStorage.get('phoneNumberSharingMode')
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
