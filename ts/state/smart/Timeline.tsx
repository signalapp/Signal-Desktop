// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEmpty, mapValues, pick } from 'lodash';
import type { RefObject } from 'react';
import React from 'react';
import { connect } from 'react-redux';

import type { ReadonlyDeep } from 'type-fest';
import { mapDispatchToProps } from '../actions';
import type {
  ContactSpoofingReviewPropType,
  WarningType as TimelineWarningType,
} from '../../components/conversation/Timeline';
import { Timeline } from '../../components/conversation/Timeline';
import type { StateType } from '../reducer';
import type { ConversationType } from '../ducks/conversations';

import { getIntl, getTheme } from '../selectors/user';
import {
  getMessages,
  getConversationByServiceIdSelector,
  getConversationMessagesSelector,
  getConversationSelector,
  getConversationsByTitleSelector,
  getInvitedContactsForNewlyCreatedGroup,
  getTargetedMessage,
} from '../selectors/conversations';
import { selectAudioPlayerActive } from '../selectors/audioPlayer';

import { SmartTimelineItem } from './TimelineItem';
import { SmartContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog';
import type { PropsType as SmartContactSpoofingReviewDialogPropsType } from './ContactSpoofingReviewDialog';
import { SmartTypingBubble } from './TypingBubble';
import { SmartHeroRow } from './HeroRow';

import { getOwn } from '../../util/getOwn';
import { assertDev } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import {
  dehydrateCollisionsWithConversations,
  getCollisionsFromMemberships,
  invertIdsByTitle,
} from '../../util/groupMemberNameCollisions';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import type { UnreadIndicatorPlacement } from '../../util/timelineUtil';
import type { WidthBreakpoint } from '../../components/_util';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { SmartMiniPlayer } from './MiniPlayer';

type ExternalProps = {
  id: string;
};

function renderItem({
  containerElementRef,
  containerWidthBreakpoint,
  conversationId,
  isOldestTimelineItem,
  messageId,
  nextMessageId,
  previousMessageId,
  unreadIndicatorPlacement,
}: {
  containerElementRef: RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
  conversationId: string;
  isOldestTimelineItem: boolean;
  messageId: string;
  nextMessageId: undefined | string;
  previousMessageId: undefined | string;
  unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
}): JSX.Element {
  return (
    <SmartTimelineItem
      containerElementRef={containerElementRef}
      containerWidthBreakpoint={containerWidthBreakpoint}
      conversationId={conversationId}
      isOldestTimelineItem={isOldestTimelineItem}
      messageId={messageId}
      previousMessageId={previousMessageId}
      nextMessageId={nextMessageId}
      unreadIndicatorPlacement={unreadIndicatorPlacement}
    />
  );
}

function renderContactSpoofingReviewDialog(
  props: SmartContactSpoofingReviewDialogPropsType
): JSX.Element {
  return <SmartContactSpoofingReviewDialog {...props} />;
}

function renderHeroRow(id: string): JSX.Element {
  return <SmartHeroRow id={id} />;
}
function renderMiniPlayer(options: { shouldFlow: boolean }): JSX.Element {
  return <SmartMiniPlayer {...options} />;
}
function renderTypingBubble(conversationId: string): JSX.Element {
  return <SmartTypingBubble conversationId={conversationId} />;
}

const getWarning = (
  conversation: ReadonlyDeep<ConversationType>,
  state: Readonly<StateType>
): undefined | TimelineWarningType => {
  switch (conversation.type) {
    case 'direct':
      if (!conversation.acceptedMessageRequest && !conversation.isBlocked) {
        const getConversationsWithTitle =
          getConversationsByTitleSelector(state);
        const conversationsWithSameTitle = getConversationsWithTitle(
          conversation.title
        );
        assertDev(
          conversationsWithSameTitle.length,
          'Expected at least 1 conversation with the same title (this one)'
        );

        const safeConversation = conversationsWithSameTitle.find(
          otherConversation =>
            otherConversation.acceptedMessageRequest &&
            otherConversation.type === 'direct' &&
            otherConversation.id !== conversation.id
        );

        if (safeConversation) {
          return {
            type: ContactSpoofingType.DirectConversationWithSameTitle,
            safeConversation,
          };
        }
      }
      return undefined;
    case 'group': {
      if (conversation.left || conversation.groupVersion !== 2) {
        return undefined;
      }

      const getConversationByServiceId =
        getConversationByServiceIdSelector(state);

      const { memberships } = getGroupMemberships(
        conversation,
        getConversationByServiceId
      );
      const groupNameCollisions = getCollisionsFromMemberships(memberships);
      const hasGroupMembersWithSameName = !isEmpty(groupNameCollisions);
      if (hasGroupMembersWithSameName) {
        return {
          type: ContactSpoofingType.MultipleGroupMembersWithSameTitle,
          acknowledgedGroupNameCollisions:
            conversation.acknowledgedGroupNameCollisions,
          groupNameCollisions:
            dehydrateCollisionsWithConversations(groupNameCollisions),
        };
      }

      return undefined;
    }
    default:
      throw missingCaseError(conversation);
  }
};

const getContactSpoofingReview = (
  selectedConversationId: string,
  state: Readonly<StateType>
): undefined | ContactSpoofingReviewPropType => {
  const { contactSpoofingReview } = state.conversations;
  if (!contactSpoofingReview) {
    return undefined;
  }

  const conversationSelector = getConversationSelector(state);
  const getConversationByServiceId = getConversationByServiceIdSelector(state);

  const currentConversation = conversationSelector(selectedConversationId);

  switch (contactSpoofingReview.type) {
    case ContactSpoofingType.DirectConversationWithSameTitle:
      return {
        type: ContactSpoofingType.DirectConversationWithSameTitle,
        possiblyUnsafeConversation: currentConversation,
        safeConversation: conversationSelector(
          contactSpoofingReview.safeConversationId
        ),
      };
    case ContactSpoofingType.MultipleGroupMembersWithSameTitle: {
      assertDev(
        currentConversation.type === 'group',
        'MultipleGroupMembersWithSameTitle: expects group conversation'
      );
      const { memberships } = getGroupMemberships(
        currentConversation,
        getConversationByServiceId
      );
      const groupNameCollisions = getCollisionsFromMemberships(memberships);

      const previouslyAcknowledgedTitlesById = invertIdsByTitle(
        currentConversation.acknowledgedGroupNameCollisions
      );

      const collisionInfoByTitle = mapValues(
        groupNameCollisions,
        conversations =>
          conversations.map(conversation => ({
            conversation,
            oldName: getOwn(previouslyAcknowledgedTitlesById, conversation.id),
          }))
      );

      return {
        type: ContactSpoofingType.MultipleGroupMembersWithSameTitle,
        collisionInfoByTitle,
      };
    }
    default:
      throw missingCaseError(contactSpoofingReview);
  }
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversation = getConversationSelector(state)(id);

  const conversationMessages = getConversationMessagesSelector(state)(id);
  const targetedMessage = getTargetedMessage(state);

  const getTimestampForMessage = (messageId: string): undefined | number =>
    getMessages(state)[messageId]?.timestamp;

  const shouldShowMiniPlayer = Boolean(selectAudioPlayerActive(state));

  return {
    id,
    ...pick(conversation, [
      'unreadCount',
      'unreadMentionsCount',
      'isGroupV1AndDisabled',
      'typingContactIdTimestamps',
    ]),
    isConversationSelected: state.conversations.selectedConversationId === id,
    isIncomingMessageRequest: Boolean(
      !conversation.acceptedMessageRequest &&
        conversation.removalStage !== 'justNotification'
    ),
    isSomeoneTyping: Boolean(
      Object.keys(conversation.typingContactIdTimestamps ?? {}).length > 0
    ),
    ...conversationMessages,

    invitedContactsForNewlyCreatedGroup:
      getInvitedContactsForNewlyCreatedGroup(state),
    targetedMessageId: targetedMessage ? targetedMessage.id : undefined,
    shouldShowMiniPlayer,

    warning: getWarning(conversation, state),
    contactSpoofingReview: getContactSpoofingReview(id, state),

    getTimestampForMessage,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    theme: getTheme(state),

    renderContactSpoofingReviewDialog,
    renderHeroRow,
    renderItem,
    renderMiniPlayer,
    renderTypingBubble,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimeline = smart(Timeline);
