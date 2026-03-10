// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer.preload.js';
import { getIntl } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import DeleteMessagesModal from '../../components/DeleteMessagesModal.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import { getMessagesCanDeleteForEveryone } from '../selectors/message.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useToastActions } from '../ducks/toast.preload.js';
import {
  getConversationSelector,
  getLastSelectedMessage,
} from '../selectors/conversations.dom.js';
import { getDeleteMessagesProps } from '../selectors/globalModals.std.js';
import { getHasSeenAdminDeleteEducationDialog } from '../selectors/items.dom.js';
import { useItemsActions } from '../ducks/items.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

export const SmartDeleteMessagesModal = memo(
  function SmartDeleteMessagesModal() {
    const deleteMessagesProps = useSelector(getDeleteMessagesProps);
    strictAssert(
      deleteMessagesProps != null,
      'Cannot render delete messages modal without messages'
    );
    const { conversationId, messageIds, onDelete } = deleteMessagesProps;
    const conversationSelector = useSelector(getConversationSelector);
    const conversation = conversationSelector(conversationId);
    const { isMe } = conversation;

    const getDeleteForEveryoneType = useCallback(
      (state: StateType) => {
        return getMessagesCanDeleteForEveryone(state, {
          messageIds,
          conversation,
          ourAci: itemStorage.user.getAci(),
        });
      },
      [messageIds, conversation]
    );
    const deleteForEveryoneResult = useSelector(getDeleteForEveryoneType);
    const lastSelectedMessage = useSelector(getLastSelectedMessage);
    const hasSeenAdminDeleteEducationDialog = useSelector(
      getHasSeenAdminDeleteEducationDialog
    );
    const i18n = useSelector(getIntl);
    const { toggleDeleteMessagesModal } = useGlobalModalActions();
    const { deleteMessages, deleteMessagesForEveryone } =
      useConversationsActions();
    const { onSeenAdminDeleteEducationDialog } = useItemsActions();
    const { showToast } = useToastActions();

    const messageCount = deleteMessagesProps.messageIds.length;

    const handleClose = useCallback(() => {
      toggleDeleteMessagesModal(undefined);
    }, [toggleDeleteMessagesModal]);

    const handleDeleteForMe = useCallback(() => {
      deleteMessages({
        conversationId,
        messageIds,
        lastSelectedMessage,
      });
      onDelete?.();
    }, [
      conversationId,
      deleteMessages,
      lastSelectedMessage,
      messageIds,
      onDelete,
    ]);

    const handleDeleteForEveryone = useCallback(() => {
      deleteMessagesForEveryone(messageIds);
      onDelete?.();
    }, [deleteMessagesForEveryone, messageIds, onDelete]);

    const { canDeleteForEveryone, needsAdminDelete, isDeletingOwnMessages } =
      deleteForEveryoneResult;

    return (
      <DeleteMessagesModal
        isMe={isMe}
        canDeleteForEveryone={canDeleteForEveryone}
        needsAdminDelete={needsAdminDelete}
        isDeletingOwnMessages={isDeletingOwnMessages}
        hasSeenAdminDeleteEducationDialog={hasSeenAdminDeleteEducationDialog}
        i18n={i18n}
        messageCount={messageCount}
        onClose={handleClose}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        onSeenAdminDeleteEducationDialog={onSeenAdminDeleteEducationDialog}
        showToast={showToast}
      />
    );
  }
);
