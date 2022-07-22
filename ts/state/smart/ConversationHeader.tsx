// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { pick } from 'lodash';
import type { ConversationType } from '../ducks/conversations';
import type { StateType } from '../reducer';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationSelector,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations';
import { CallMode } from '../../types/Calling';
import { getActiveCall, isAnybodyElseInGroupCall } from '../ducks/calling';
import { getConversationCallMode } from '../ducks/conversations';
import { getHasStoriesSelector } from '../selectors/stories';
import { getOwn } from '../../util/getOwn';
import { getUserACI, getIntl, getTheme } from '../selectors/user';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { mapDispatchToProps } from '../actions';
import { missingCaseError } from '../../util/missingCaseError';
import { strictAssert } from '../../util/assert';

export type OwnProps = {
  id: string;

  onArchive: () => void;
  onDeleteMessages: () => void;
  onGoBack: () => void;
  onMarkUnread: () => void;
  onMoveToInbox: () => void;
  onOutgoingAudioCallInConversation: () => void;
  onOutgoingVideoCallInConversation: () => void;
  onSearchInConversation: () => void;
  onSetDisappearingMessages: (seconds: number) => void;
  onSetMuteNotifications: (seconds: number) => void;
  onSetPin: (value: boolean) => void;
  onShowAllMedia: () => void;
  onShowConversationDetails: () => void;
  onShowGroupMembers: () => void;
};

const getOutgoingCallButtonStyle = (
  conversation: ConversationType,
  state: StateType
): OutgoingCallButtonStyle => {
  const { calling } = state;
  const ourACI = getUserACI(state);
  strictAssert(ourACI, 'getOutgoingCallButtonStyle missing our uuid');

  if (getActiveCall(calling)) {
    return OutgoingCallButtonStyle.None;
  }

  const conversationCallMode = getConversationCallMode(conversation);
  switch (conversationCallMode) {
    case CallMode.None:
      return OutgoingCallButtonStyle.None;
    case CallMode.Direct:
      return OutgoingCallButtonStyle.Both;
    case CallMode.Group: {
      const call = getOwn(calling.callsByConversation, conversation.id);
      if (
        call?.callMode === CallMode.Group &&
        isAnybodyElseInGroupCall(call.peekInfo, ourACI)
      ) {
        return OutgoingCallButtonStyle.Join;
      }
      return OutgoingCallButtonStyle.JustVideo;
    }
    default:
      throw missingCaseError(conversationCallMode);
  }
};

const mapStateToProps = (state: StateType, ownProps: OwnProps) => {
  const { id } = ownProps;

  const conversation = getConversationSelector(state)(id);
  if (!conversation) {
    throw new Error('Could not find conversation');
  }

  const hasStories = getHasStoriesSelector(state)(id);

  return {
    ...pick(conversation, [
      'acceptedMessageRequest',
      'announcementsOnly',
      'areWeAdmin',
      'avatarPath',
      'canChangeTimer',
      'color',
      'expireTimer',
      'groupVersion',
      'isArchived',
      'isMe',
      'isPinned',
      'isVerified',
      'left',
      'markedUnread',
      'muteExpiresAt',
      'name',
      'phoneNumber',
      'profileName',
      'sharedGroupNames',
      'title',
      'type',
      'unblurredAvatarPath',
    ]),
    badge: getPreferredBadgeSelector(state)(conversation.badges),
    conversationTitle: state.conversations.selectedConversationTitle,
    hasStories,
    isMissingMandatoryProfileSharing:
      isMissingRequiredProfileSharing(conversation),
    isSMSOnly: isConversationSMSOnly(conversation),
    i18n: getIntl(state),
    showBackButton: state.conversations.selectedConversationPanelDepth > 0,
    outgoingCallButtonStyle: getOutgoingCallButtonStyle(conversation, state),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartConversationHeader = smart(ConversationHeader);
