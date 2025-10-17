// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.js';
import { getGlobalModalsState } from '../selectors/globalModals.std.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from '../../components/conversation/MessageRequestActionsConfirmation.dom.js';
import { useContactNameData } from '../../components/conversation/ContactName.dom.js';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';

export const SmartMessageRequestActionsConfirmation = memo(
  function SmartMessageRequestActionsConfirmation() {
    const i18n = useSelector(getIntl);
    const globalModals = useSelector(getGlobalModalsState);
    const { messageRequestActionsConfirmationProps } = globalModals;
    strictAssert(
      messageRequestActionsConfirmationProps,
      'messageRequestActionsConfirmationProps are required'
    );
    const { conversationId, state } = messageRequestActionsConfirmationProps;
    strictAssert(state !== MessageRequestState.default, 'state is required');
    const getConversation = useSelector(getConversationSelector);
    const conversation = getConversation(conversationId);
    const addedBy = useMemo(() => {
      if (conversation.type === 'group') {
        return getAddedByForOurPendingInvitation(conversation);
      }
      return null;
    }, [conversation]);

    const conversationName = useContactNameData(conversation);
    strictAssert(conversationName, 'conversationName is required');
    const addedByName = useContactNameData(addedBy);

    const {
      acceptConversation,
      blockConversation,
      reportSpam,
      blockAndReportSpam,
      deleteConversation,
    } = useConversationsActions();
    const { toggleMessageRequestActionsConfirmation } = useGlobalModalActions();

    const handleChangeState = useCallback(
      (nextState: MessageRequestState) => {
        if (nextState === MessageRequestState.default) {
          toggleMessageRequestActionsConfirmation(null);
        } else {
          toggleMessageRequestActionsConfirmation({
            conversationId,
            state: nextState,
          });
        }
      },
      [conversationId, toggleMessageRequestActionsConfirmation]
    );

    return (
      <MessageRequestActionsConfirmation
        i18n={i18n}
        conversationId={conversation.id}
        conversationType={conversation.type}
        conversationName={conversationName}
        addedByName={addedByName}
        isBlocked={conversation.isBlocked ?? false}
        isReported={conversation.isReported ?? false}
        acceptConversation={acceptConversation}
        blockConversation={blockConversation}
        reportSpam={reportSpam}
        blockAndReportSpam={blockAndReportSpam}
        deleteConversation={deleteConversation}
        state={state}
        onChangeState={handleChangeState}
      />
    );
  }
);
