// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';
import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import {
  Timeline,
  WarningType as TimelineWarningType,
} from '../../components/conversation/Timeline';
import { StateType } from '../reducer';
import { ConversationType } from '../ducks/conversations';

import { getIntl } from '../selectors/user';
import {
  getConversationMessagesSelector,
  getConversationSelector,
  getConversationsByTitleSelector,
  getInvitedContactsForNewlyCreatedGroup,
  getSelectedMessage,
} from '../selectors/conversations';

import { SmartTimelineItem } from './TimelineItem';
import { SmartTypingBubble } from './TypingBubble';
import { SmartLastSeenIndicator } from './LastSeenIndicator';
import { SmartHeroRow } from './HeroRow';
import { SmartTimelineLoadingRow } from './TimelineLoadingRow';
import { renderAudioAttachment } from './renderAudioAttachment';
import { renderEmojiPicker } from './renderEmojiPicker';

import { assert } from '../../util/assert';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredSmartTimelineItem = SmartTimelineItem as any;
const FilteredSmartTypingBubble = SmartTypingBubble as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

type ExternalProps = {
  id: string;

  // Note: most action creators are not wired into redux; for now they
  //   are provided by ConversationView in setupTimeline().
};

function renderItem(
  messageId: string,
  conversationId: string,
  actionProps: Record<string, unknown>
): JSX.Element {
  return (
    <FilteredSmartTimelineItem
      {...actionProps}
      conversationId={conversationId}
      id={messageId}
      renderEmojiPicker={renderEmojiPicker}
      renderAudioAttachment={renderAudioAttachment}
    />
  );
}

function renderLastSeenIndicator(id: string): JSX.Element {
  return <SmartLastSeenIndicator id={id} />;
}
function renderHeroRow(
  id: string,
  onHeightChange: () => unknown,
  unblurAvatar: () => void,
  updateSharedGroups: () => unknown
): JSX.Element {
  return (
    <SmartHeroRow
      id={id}
      onHeightChange={onHeightChange}
      unblurAvatar={unblurAvatar}
      updateSharedGroups={updateSharedGroups}
    />
  );
}
function renderLoadingRow(id: string): JSX.Element {
  return <SmartTimelineLoadingRow id={id} />;
}
function renderTypingBubble(id: string): JSX.Element {
  return <FilteredSmartTypingBubble id={id} />;
}

const getWarning = (
  conversation: Readonly<ConversationType>,
  state: Readonly<StateType>
): undefined | TimelineWarningType => {
  if (
    conversation.type === 'direct' &&
    !conversation.acceptedMessageRequest &&
    !conversation.isBlocked
  ) {
    const getConversationsWithTitle = getConversationsByTitleSelector(state);
    const conversationsWithSameTitle = getConversationsWithTitle(
      conversation.title
    );
    assert(
      conversationsWithSameTitle.length,
      'Expected at least 1 conversation with the same title (this one)'
    );

    const safeConversation = conversationsWithSameTitle.find(
      otherConversation =>
        otherConversation.acceptedMessageRequest &&
        otherConversation.type === 'direct' &&
        otherConversation.id !== conversation.id
    );

    return safeConversation ? { safeConversation } : undefined;
  }

  return undefined;
};

const getContactSpoofingReview = (
  selectedConversationId: string,
  state: Readonly<StateType>
):
  | undefined
  | {
      possiblyUnsafeConversation: ConversationType;
      safeConversation: ConversationType;
    } => {
  const { contactSpoofingReview } = state.conversations;
  if (!contactSpoofingReview) {
    return undefined;
  }

  const conversationSelector = getConversationSelector(state);
  return {
    possiblyUnsafeConversation: conversationSelector(selectedConversationId),
    safeConversation: conversationSelector(
      contactSpoofingReview.safeConversationId
    ),
  };
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id, ...actions } = props;

  const conversation = getConversationSelector(state)(id);
  const conversationMessages = getConversationMessagesSelector(state)(id);
  const selectedMessage = getSelectedMessage(state);

  return {
    id,
    ...pick(conversation, [
      'unreadCount',
      'typingContact',
      'isGroupV1AndDisabled',
    ]),
    isIncomingMessageRequest: Boolean(
      conversation.messageRequestsEnabled &&
        !conversation.acceptedMessageRequest
    ),
    ...conversationMessages,
    invitedContactsForNewlyCreatedGroup: getInvitedContactsForNewlyCreatedGroup(
      state
    ),
    selectedMessageId: selectedMessage ? selectedMessage.id : undefined,

    warning: getWarning(conversation, state),
    contactSpoofingReview: getContactSpoofingReview(id, state),

    i18n: getIntl(state),
    renderItem,
    renderLastSeenIndicator,
    renderHeroRow,
    renderLoadingRow,
    renderTypingBubble,
    ...actions,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SmartTimeline = smart(Timeline as any);
