// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import { AboutContactModal } from '../../components/conversation/AboutContactModal';
import { isSignalConnection } from '../../util/getSignalConnections';
import { getIntl } from '../selectors/user';
import { getGlobalModalsState } from '../selectors/globalModals';
import { getConversationSelector } from '../selectors/conversations';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';

export function SmartAboutContactModal(): JSX.Element | null {
  const i18n = useSelector(getIntl);
  const globalModals = useSelector(getGlobalModalsState);
  const { aboutContactModalContactId: contactId } = globalModals;
  const getConversation = useSelector(getConversationSelector);

  const { updateSharedGroups, unblurAvatar } = useConversationsActions();

  const {
    toggleAboutContactModal,
    toggleSignalConnectionsModal,
    toggleSafetyNumberModal,
  } = useGlobalModalActions();

  if (!contactId) {
    return null;
  }

  const conversation = getConversation(contactId);

  return (
    <AboutContactModal
      i18n={i18n}
      conversation={conversation}
      updateSharedGroups={updateSharedGroups}
      unblurAvatar={unblurAvatar}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      isSignalConnection={isSignalConnection(conversation)}
      onClose={toggleAboutContactModal}
    />
  );
}
