// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { getUserACI } from './user';
import { getConversationSelector } from './conversations';

import type { AciString } from '../../types/ServiceId';
import type { GetConversationByIdType } from './conversations';

export const getDeleteSyncSendEnabled = createSelector(
  getUserACI,
  getConversationSelector,
  (
    aci: AciString | undefined,
    conversationSelector: GetConversationByIdType
  ): boolean => {
    if (!aci) {
      return false;
    }
    const ourConversation = conversationSelector(aci);
    if (!ourConversation) {
      return false;
    }

    const { capabilities } = ourConversation;
    if (!capabilities || !capabilities.deleteSync) {
      return false;
    }

    return true;
  }
);
