// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import { ConversationView } from '../../components/conversation/ConversationView';
import { useComposerActions } from '../ducks/composer';
import { useConversationsActions } from '../ducks/conversations';
import type { StateType } from '../reducer';
import {
  getActivePanel,
  getIsPanelAnimating,
  getSelectedConversationId,
  getSelectedMessageIds,
} from '../selectors/conversations';
import { SmartCompositionArea } from './CompositionArea';
import { SmartConversationHeader } from './ConversationHeader';
import { ConversationPanel } from './ConversationPanel';
import { SmartDocTimeline } from './DocTimeline';
import { SmartTimeline } from './Timeline';

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

  const shouldHideConversationView = useSelector((state: StateType) => {
    const activePanel = getActivePanel(state);
    const isAnimating = getIsPanelAnimating(state);
    return activePanel && !isAnimating;
  });

  const docView = useSelector((state: StateType) => {
    return state.docs.docViewEnabled;
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
      renderCompositionArea={() =>
        docView ? <div /> : <SmartCompositionArea id={conversationId} />
      }
      renderConversationHeader={() => (
        <SmartConversationHeader id={conversationId} />
      )}
      renderTimeline={() =>
        docView ? (
          <SmartDocTimeline key={conversationId} id={conversationId} />
        ) : (
          <SmartTimeline key={conversationId} id={conversationId} />
        )
      }
      renderPanel={() => <ConversationPanel conversationId={conversationId} />}
      shouldHideConversationView={shouldHideConversationView}
    />
  );
}
