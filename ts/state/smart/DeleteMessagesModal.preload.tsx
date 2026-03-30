// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer.preload.ts';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import DeleteMessagesModal from '../../components/DeleteMessagesModal.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { getMessagesCanDeleteForEveryone } from '../selectors/message.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useToastActions } from '../ducks/toast.preload.ts';
import {
  getConversationSelector,
  getLastSelectedMessage,
} from '../selectors/conversations.dom.ts';
import { getDeleteMessagesProps } from '../selectors/globalModals.std.ts';
import { getHasSeenAdminDeleteEducationDialog } from '../selectors/items.dom.ts';
import { useItemsActions } from '../ducks/items.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';

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
