// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { AppStateType } from '../ducks/app';
import type { ConversationsStateType } from '../ducks/conversations';
import type { StateType } from '../reducer';
import { Inbox } from '../../components/Inbox';
import { getIntl } from '../selectors/user';
import { SmartConversationView } from './ConversationView';
import { SmartCustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal';
import { SmartLeftPane } from './LeftPane';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { getIsCustomizingPreferredReactions } from '../selectors/preferredReactions';
import { SmartMiniPlayer } from './MiniPlayer';

function renderConversationView() {
  return <SmartConversationView />;
}

function renderCustomizingPreferredReactionsModal() {
  return <SmartCustomizingPreferredReactionsModal />;
}

function renderMiniPlayer(options: { shouldFlow: boolean }) {
  return <SmartMiniPlayer {...options} />;
}

function renderLeftPane() {
  return <SmartLeftPane />;
}

export function SmartInbox(): JSX.Element {
  const i18n = useSelector(getIntl);
  const isCustomizingPreferredReactions = useSelector(
    getIsCustomizingPreferredReactions
  );
  const envelopeTimestamp = useSelector<StateType, number | undefined>(
    state => state.inbox.envelopeTimestamp
  );
  const firstEnvelopeTimestamp = useSelector<StateType, number | undefined>(
    state => state.inbox.firstEnvelopeTimestamp
  );
  const { hasInitialLoadCompleted } = useSelector<StateType, AppStateType>(
    state => state.app
  );
  const { selectedConversationId, targetedMessage, targetedMessageSource } =
    useSelector<StateType, ConversationsStateType>(
      state => state.conversations
    );
  const {
    onConversationClosed,
    onConversationOpened,
    scrollToMessage,
    showConversation,
  } = useConversationsActions();
  const { showWhatsNewModal } = useGlobalModalActions();

  return (
    <Inbox
      envelopeTimestamp={envelopeTimestamp}
      firstEnvelopeTimestamp={firstEnvelopeTimestamp}
      hasInitialLoadCompleted={hasInitialLoadCompleted}
      i18n={i18n}
      isCustomizingPreferredReactions={isCustomizingPreferredReactions}
      onConversationClosed={onConversationClosed}
      onConversationOpened={onConversationOpened}
      renderConversationView={renderConversationView}
      renderCustomizingPreferredReactionsModal={
        renderCustomizingPreferredReactionsModal
      }
      renderLeftPane={renderLeftPane}
      renderMiniPlayer={renderMiniPlayer}
      scrollToMessage={scrollToMessage}
      selectedConversationId={selectedConversationId}
      targetedMessage={targetedMessage}
      targetedMessageSource={targetedMessageSource}
      showConversation={showConversation}
      showWhatsNewModal={showWhatsNewModal}
    />
  );
}
