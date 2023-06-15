// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import { ConversationPanel } from './ConversationPanel';
import { ConversationView } from '../../components/conversation/ConversationView';
import { SmartCompositionArea } from './CompositionArea';
import { SmartConversationHeader } from './ConversationHeader';
import { SmartTimeline } from './Timeline';
import {
  getSelectedConversationId,
  getSelectedMessageIds,
} from '../selectors/conversations';
import { useComposerActions } from '../ducks/composer';
import { useConversationsActions } from '../ducks/conversations';

export function SmartConversationView(): JSX.Element {
  const conversationId = useSelector(getSelectedConversationId);

  if (!conversationId) {
    throw new Error('SmartConversationView: No selected conversation');
  }

  const { toggleSelectMode } = useConversationsActions();
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const isSelectMode = selectedMessageIds != null;

  const { processAttachments } = useComposerActions();

  const hasOpenModal = useSelector((state: StateType) => {
    return (
      state.globalModals.forwardMessagesProps != null ||
      state.globalModals.deleteMessagesProps != null ||
      state.globalModals.hasConfirmationModal
    );
  });

  return (
    <ConversationView
      conversationId={conversationId}
      hasOpenModal={hasOpenModal}
      isSelectMode={isSelectMode}
      onExitSelectMode={() => {
        toggleSelectMode(false);
      }}
      processAttachments={processAttachments}
      renderCompositionArea={() => <SmartCompositionArea id={conversationId} />}
      renderConversationHeader={() => (
        <SmartConversationHeader id={conversationId} />
      )}
      renderTimeline={() => (
        <SmartTimeline key={conversationId} id={conversationId} />
      )}
      renderPanel={() => <ConversationPanel conversationId={conversationId} />}
    />
  );
}
