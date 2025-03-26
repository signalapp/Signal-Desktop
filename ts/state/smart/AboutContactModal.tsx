// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { AboutContactModal } from '../../components/conversation/AboutContactModal';
import { isSignalConnection } from '../../util/getSignalConnections';
import { getIntl } from '../selectors/user';
import { getGlobalModalsState } from '../selectors/globalModals';
import {
  getConversationSelector,
  getPendingAvatarDownloadSelector,
} from '../selectors/conversations';
import type { ConversationType } from '../ducks/conversations';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { strictAssert } from '../../util/assert';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation';

function isFromOrAddedByTrustedContact(
  conversation: ConversationType
): boolean {
  if (conversation.type === 'direct') {
    return Boolean(conversation.name) || Boolean(conversation.profileSharing);
  }

  const addedByConv = getAddedByForOurPendingInvitation(conversation);
  if (!addedByConv) {
    return false;
  }

  return Boolean(
    addedByConv.isMe || addedByConv.name || addedByConv.profileSharing
  );
}

export const SmartAboutContactModal = memo(function SmartAboutContactModal() {
  const i18n = useSelector(getIntl);
  const globalModals = useSelector(getGlobalModalsState);
  const { aboutContactModalContactId: contactId } = globalModals;
  const getConversation = useSelector(getConversationSelector);
  const isPendingAvatarDownload = useSelector(getPendingAvatarDownloadSelector);

  const { startAvatarDownload, updateSharedGroups } = useConversationsActions();

  const conversation = getConversation(contactId);
  const { id: conversationId } = conversation ?? {};

  const {
    toggleAboutContactModal,
    toggleSignalConnectionsModal,
    toggleSafetyNumberModal,
    toggleNotePreviewModal,
    toggleProfileNameWarningModal,
  } = useGlobalModalActions();

  const handleOpenNotePreviewModal = useCallback(() => {
    strictAssert(conversationId != null, 'conversationId is required');
    toggleNotePreviewModal({ conversationId });
  }, [toggleNotePreviewModal, conversationId]);

  if (conversation == null) {
    return null;
  }

  return (
    <AboutContactModal
      i18n={i18n}
      conversation={conversation}
      updateSharedGroups={updateSharedGroups}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      isSignalConnection={isSignalConnection(conversation)}
      fromOrAddedByTrustedContact={isFromOrAddedByTrustedContact(conversation)}
      onClose={toggleAboutContactModal}
      onOpenNotePreviewModal={handleOpenNotePreviewModal}
      toggleProfileNameWarningModal={toggleProfileNameWarningModal}
      pendingAvatarDownload={
        conversationId ? isPendingAvatarDownload(conversationId) : false
      }
      startAvatarDownload={
        conversationId ? () => startAvatarDownload(conversationId) : undefined
      }
    />
  );
});
