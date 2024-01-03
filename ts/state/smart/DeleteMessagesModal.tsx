// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { DeleteMessagesPropsType } from '../ducks/globalModals';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';
import DeleteMessagesModal from '../../components/DeleteMessagesModal';
import { strictAssert } from '../../util/assert';
import { canDeleteMessagesForEveryone } from '../selectors/message';
import { useConversationsActions } from '../ducks/conversations';
import { useToastActions } from '../ducks/toast';
import { getConversationSelector } from '../selectors/conversations';

export function SmartDeleteMessagesModal(): JSX.Element | null {
  const deleteMessagesProps = useSelector<
    StateType,
    DeleteMessagesPropsType | undefined
  >(state => state.globalModals.deleteMessagesProps);
  strictAssert(
    deleteMessagesProps != null,
    'Cannot render delete messages modal without messages'
  );
  const { conversationId, messageIds, onDelete } = deleteMessagesProps;
  const isMe = useSelector((state: StateType) => {
    return getConversationSelector(state)(conversationId).isMe;
  });

  const canDeleteForEveryone = useSelector((state: StateType) => {
    return canDeleteMessagesForEveryone(state, { messageIds, isMe });
  });
  const lastSelectedMessage = useSelector((state: StateType) => {
    return state.conversations.lastSelectedMessage;
  });
  const i18n = useSelector(getIntl);
  const { toggleDeleteMessagesModal } = useGlobalModalActions();
  const { deleteMessages, deleteMessagesForEveryone } =
    useConversationsActions();
  const { showToast } = useToastActions();

  return (
    <DeleteMessagesModal
      isMe={isMe}
      canDeleteForEveryone={canDeleteForEveryone}
      i18n={i18n}
      messageCount={deleteMessagesProps.messageIds.length}
      onClose={() => {
        toggleDeleteMessagesModal(undefined);
      }}
      onDeleteForMe={() => {
        deleteMessages({
          conversationId,
          messageIds,
          lastSelectedMessage,
        });
        onDelete?.();
      }}
      onDeleteForEveryone={() => {
        deleteMessagesForEveryone(messageIds);
        onDelete?.();
      }}
      showToast={showToast}
    />
  );
}
