// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer.preload.js';
import { getIntl } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import DeleteMessagesModal from '../../components/DeleteMessagesModal.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import { canDeleteMessagesForEveryone } from '../selectors/message.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useToastActions } from '../ducks/toast.preload.js';
import {
  getConversationSelector,
  getLastSelectedMessage,
} from '../selectors/conversations.dom.js';
import { getDeleteMessagesProps } from '../selectors/globalModals.std.js';
import { useItemsActions } from '../ducks/items.preload.js';
import { getLocalDeleteWarningShown } from '../selectors/items.dom.js';
import { LocalDeleteWarningModal } from '../../components/LocalDeleteWarningModal.dom.js';

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

    const getCanDeleteForEveryone = useCallback(
      (state: StateType) => {
        return canDeleteMessagesForEveryone(state, { messageIds, isMe });
      },
      [messageIds, isMe]
    );
    const canDeleteForEveryone = useSelector(getCanDeleteForEveryone);
    const lastSelectedMessage = useSelector(getLastSelectedMessage);
    const i18n = useSelector(getIntl);
    const { toggleDeleteMessagesModal } = useGlobalModalActions();
    const { deleteMessages, deleteMessagesForEveryone } =
      useConversationsActions();
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

    const localDeleteWarningShown = useSelector(getLocalDeleteWarningShown);
    const { putItem } = useItemsActions();
    if (!localDeleteWarningShown) {
      return (
        <LocalDeleteWarningModal
          i18n={i18n}
          onClose={() => {
            putItem('localDeleteWarningShown', true);
          }}
        />
      );
    }

    return (
      <DeleteMessagesModal
        isMe={isMe}
        canDeleteForEveryone={canDeleteForEveryone}
        i18n={i18n}
        messageCount={messageCount}
        onClose={handleClose}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        showToast={showToast}
      />
    );
  }
);
