// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEmpty, mapValues, pick } from 'lodash';
import type { RefObject } from 'react';
import React from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import type {
  PropsActionsType as TimelineActionsType,
  ContactSpoofingReviewPropType,
  WarningType as TimelineWarningType,
  PropsType as ComponentPropsType,
} from '../../components/conversation/Timeline';
import { Timeline } from '../../components/conversation/Timeline';
import type { StateType } from '../reducer';
import type { ConversationType } from '../ducks/conversations';

import { getIntl, getTheme } from '../selectors/user';
import {
  getConversationByUuidSelector,
  getConversationMessagesSelector,
  getConversationSelector,
  getConversationsByTitleSelector,
  getInvitedContactsForNewlyCreatedGroup,
  getMessageSelector,
  getSelectedMessage,
} from '../selectors/conversations';

import { SmartTimelineItem } from './TimelineItem';
import { SmartContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog';
import type { PropsType as SmartContactSpoofingReviewDialogPropsType } from './ContactSpoofingReviewDialog';
import { SmartTypingBubble } from './TypingBubble';
import { SmartHeroRow } from './HeroRow';
import { renderAudioAttachment } from './renderAudioAttachment';
import { renderEmojiPicker } from './renderEmojiPicker';
import { renderReactionPicker } from './renderReactionPicker';

import { getOwn } from '../../util/getOwn';
import { assert } from '../../util/assert';
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

type ExternalProps = {
  id: string;

  // Note: most action creators are not wired into redux; for now they
  //   are provided by ConversationView in setupTimeline().
};

export type TimelinePropsType = ExternalProps &
  Pick<
    ComponentPropsType,
    | 'acknowledgeGroupMemberNameCollisions'
    | 'contactSupport'
    | 'blockGroupLinkRequests'
    | 'deleteMessage'
    | 'deleteMessageForEveryone'
    | 'displayTapToViewMessage'
    | 'downloadAttachment'
    | 'downloadNewVersion'
    | 'kickOffAttachmentDownload'
    | 'learnMoreAboutDeliveryIssue'
    | 'loadNewerMessages'
    | 'loadNewestMessages'
    | 'loadOlderMessages'
    | 'markAttachmentAsCorrupted'
    | 'markMessageRead'
    | 'markViewed'
    | 'onBlock'
    | 'onBlockAndReportSpam'
    | 'onDelete'
    | 'onUnblock'
    | 'openConversation'
    | 'openGiftBadge'
    | 'openLink'
    | 'reactToMessage'
    | 'removeMember'
    | 'replyToMessage'
    | 'retryDeleteForEveryone'
    | 'retrySend'
    | 'scrollToQuotedMessage'
    | 'showContactDetail'
    | 'showContactModal'
    | 'showExpiredIncomingTapToViewToast'
    | 'showExpiredOutgoingTapToViewToast'
    | 'showForwardMessageModal'
    | 'showIdentity'
    | 'showMessageDetail'
    | 'showVisualAttachment'
    | 'startConversation'
    | 'unblurAvatar'
    | 'updateSharedGroups'
  >;

function renderItem({
  actionProps,
  containerElementRef,
  containerWidthBreakpoint,
  conversationId,
  isOldestTimelineItem,
  messageId,
  nextMessageId,
  previousMessageId,
  unreadIndicatorPlacement,
}: {
  actionProps: TimelineActionsType;
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
      {...actionProps}
      containerElementRef={containerElementRef}
      containerWidthBreakpoint={containerWidthBreakpoint}
      conversationId={conversationId}
      isOldestTimelineItem={isOldestTimelineItem}
      messageId={messageId}
      previousMessageId={previousMessageId}
      nextMessageId={nextMessageId}
      renderEmojiPicker={renderEmojiPicker}
      renderReactionPicker={renderReactionPicker}
      renderAudioAttachment={renderAudioAttachment}
      unreadIndicatorPlacement={unreadIndicatorPlacement}
    />
  );
}

function renderContactSpoofingReviewDialog(
  props: SmartContactSpoofingReviewDialogPropsType
): JSX.Element {
  return <SmartContactSpoofingReviewDialog {...props} />;
}

function renderHeroRow(
  id: string,
  unblurAvatar: () => void,
  updateSharedGroups: () => unknown
): JSX.Element {
  return (
    <SmartHeroRow
      id={id}
      unblurAvatar={unblurAvatar}
      updateSharedGroups={updateSharedGroups}
    />
  );
}
function renderTypingBubble(id: string): JSX.Element {
  return <SmartTypingBubble id={id} />;
}

const getWarning = (
  conversation: Readonly<ConversationType>,
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

      const getConversationByUuid = getConversationByUuidSelector(state);

      const { memberships } = getGroupMemberships(
        conversation,
        getConversationByUuid
      );
      const groupNameCollisions = getCollisionsFromMemberships(memberships);
      const hasGroupMembersWithSameName = !isEmpty(groupNameCollisions);
      if (hasGroupMembersWithSameName) {
        return {
          type: ContactSpoofingType.MultipleGroupMembersWithSameTitle,
          acknowledgedGroupNameCollisions:
            conversation.acknowledgedGroupNameCollisions || {},
          groupNameCollisions:
            dehydrateCollisionsWithConversations(groupNameCollisions),
        };
      }

      return undefined;
    }
    default:
      throw missingCaseError(conversation.type);
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
  const getConversationByUuid = getConversationByUuidSelector(state);

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
      const { memberships } = getGroupMemberships(
        currentConversation,
        getConversationByUuid
      );
      const groupNameCollisions = getCollisionsFromMemberships(memberships);

      const previouslyAcknowledgedTitlesById = invertIdsByTitle(
        currentConversation.acknowledgedGroupNameCollisions || {}
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
  const { id, ...actions } = props;

  const conversation = getConversationSelector(state)(id);

  const conversationMessages = getConversationMessagesSelector(state)(id);
  const selectedMessage = getSelectedMessage(state);

  const messageSelector = getMessageSelector(state);
  const getTimestampForMessage = (messageId: string): undefined | number =>
    messageSelector(messageId)?.timestamp;

  return {
    id,
    ...pick(conversation, ['unreadCount', 'isGroupV1AndDisabled']),
    isConversationSelected: state.conversations.selectedConversationId === id,
    isIncomingMessageRequest: Boolean(
      conversation.messageRequestsEnabled &&
        !conversation.acceptedMessageRequest
    ),
    isSomeoneTyping: Boolean(conversation.typingContactId),
    ...conversationMessages,
    invitedContactsForNewlyCreatedGroup:
      getInvitedContactsForNewlyCreatedGroup(state),
    selectedMessageId: selectedMessage ? selectedMessage.id : undefined,

    warning: getWarning(conversation, state),
    contactSpoofingReview: getContactSpoofingReview(id, state),

    getTimestampForMessage,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    theme: getTheme(state),
    renderItem,
    renderContactSpoofingReviewDialog,
    renderHeroRow,
    renderTypingBubble,
    ...actions,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimeline = smart(Timeline);
