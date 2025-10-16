// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { PLACEHOLDER_CONTACT_ID } from '../state/selectors/conversations.dom.js';
import { format, isValidNumber } from '../types/PhoneNumber.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const PLACEHOLDER_CONTACT: ConversationType = {
  acceptedMessageRequest: false,
  badges: [],
  id: PLACEHOLDER_CONTACT_ID,
  isMe: false,
  sharedGroupNames: [],
  title: window.SignalContext.i18n('icu:unknownContact'),
  type: 'direct',
};

export function findAndFormatContact(identifier?: string): ConversationType {
  if (!identifier) {
    return PLACEHOLDER_CONTACT;
  }

  const contactModel = window.ConversationController.get(
    identifier.toLowerCase()
  );
  if (contactModel) {
    return contactModel.format();
  }

  const regionCode = itemStorage.get('regionCode');

  if (!isValidNumber(identifier, { regionCode })) {
    return PLACEHOLDER_CONTACT;
  }

  const phoneNumber = format(identifier, { ourRegionCode: regionCode });

  return {
    acceptedMessageRequest: false,
    badges: [],
    id: 'phone-only',
    isMe: false,
    phoneNumber,
    sharedGroupNames: [],
    title: phoneNumber,
    type: 'direct',
  };
}
