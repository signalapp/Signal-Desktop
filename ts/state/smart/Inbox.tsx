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

function renderConversationView() {
  return <SmartConversationView />;
}

function renderCustomizingPreferredReactionsModal() {
  return <SmartCustomizingPreferredReactionsModal />;
}

function renderLeftPane() {
  return <SmartLeftPane />;
}

export function SmartInbox(): JSX.Element {
  const i18n = useSelector(getIntl);
  const isCustomizingPreferredReactions = useSelector(
    getIsCustomizingPreferredReactions
  );
  const { hasInitialLoadCompleted } = useSelector<StateType, AppStateType>(
    state => state.app
  );
  const { selectedConversationId, selectedMessage, selectedMessageSource } =
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
      scrollToMessage={scrollToMessage}
      selectedConversationId={selectedConversationId}
      selectedMessage={selectedMessage}
      selectedMessageSource={selectedMessageSource}
      showConversation={showConversation}
      showWhatsNewModal={showWhatsNewModal}
    />
  );
}
