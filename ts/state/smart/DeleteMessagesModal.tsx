// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';
import DeleteMessagesModal from '../../components/DeleteMessagesModal';
import { strictAssert } from '../../util/assert';
import { canDeleteMessagesForEveryone } from '../selectors/message';
import { useConversationsActions } from '../ducks/conversations';
import { useToastActions } from '../ducks/toast';
import {
  getConversationSelector,
  getLastSelectedMessage,
} from '../selectors/conversations';
import { getDeleteMessagesProps } from '../selectors/globalModals';
import { useItemsActions } from '../ducks/items';
import { getLocalDeleteWarningShown } from '../selectors/items';
import { getDeleteSyncSendEnabled } from '../selectors/items-extra';
import { LocalDeleteWarningModal } from '../../components/LocalDeleteWarningModal';

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
    const isDeleteSyncSendEnabled = useSelector(getDeleteSyncSendEnabled);
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
    if (!localDeleteWarningShown && isDeleteSyncSendEnabled) {
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
        isDeleteSyncSendEnabled={isDeleteSyncSendEnabled}
        messageCount={messageCount}
        onClose={handleClose}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        showToast={showToast}
      />
    );
  }
);
