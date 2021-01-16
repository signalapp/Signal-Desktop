// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { pick } from 'lodash';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader';
import { getConversationSelector } from '../selectors/conversations';
import { StateType } from '../reducer';
import { CallMode } from '../../types/Calling';
import {
  ConversationType,
  getConversationCallMode,
} from '../ducks/conversations';
import { getActiveCall, isAnybodyElseInGroupCall } from '../ducks/calling';
import { getUserConversationId, getIntl } from '../selectors/user';
import { getOwn } from '../../util/getOwn';
import { missingCaseError } from '../../util/missingCaseError';
import { isGroupCallingEnabled } from '../../util/isGroupCallingEnabled';

export interface OwnProps {
  id: string;

  onDeleteMessages: () => void;
  onGoBack: () => void;
  onOutgoingAudioCallInConversation: () => void;
  onOutgoingVideoCallInConversation: () => void;
  onResetSession: () => void;
  onSearchInConversation: () => void;
  onSetDisappearingMessages: (seconds: number) => void;
  onSetMuteNotifications: (seconds: number) => void;
  onSetPin: (value: boolean) => void;
  onShowAllMedia: () => void;
  onShowGroupMembers: () => void;

  onArchive: () => void;
  onMarkUnread: () => void;
  onMoveToInbox: () => void;
  onShowSafetyNumber: () => void;
}

const getOutgoingCallButtonStyle = (
  conversation: ConversationType,
  state: StateType
): OutgoingCallButtonStyle => {
  const { calling } = state;

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
      if (!isGroupCallingEnabled()) {
        return OutgoingCallButtonStyle.None;
      }
      const call = getOwn(calling.callsByConversation, conversation.id);
      if (
        call?.callMode === CallMode.Group &&
        isAnybodyElseInGroupCall(call.peekInfo, getUserConversationId(state))
      ) {
        return OutgoingCallButtonStyle.Join;
      }
      return OutgoingCallButtonStyle.JustVideo;
    }
    default:
      throw missingCaseError(conversationCallMode);
  }
};

const getContactDetailsSetting = () => {
  return window.Events.getChatHeaderContactSetting();
};

const mapStateToProps = (state: StateType, ownProps: OwnProps) => {
  const conversation = getConversationSelector(state)(ownProps.id);
  if (!conversation) {
    throw new Error('Could not find conversation');
  }

  return {
    ...pick(conversation, [
      'acceptedMessageRequest',
      'avatarPath',
      'canChangeTimer',
      'color',
      'expireTimer',
      'isArchived',
      'isMe',
      'isMissingMandatoryProfileSharing',
      'isPinned',
      'isVerified',
      'left',
      'markedUnread',
      'muteExpiresAt',
      'name',
      'phoneNumber',
      'profileName',
      'title',
      'type',
    ]),
    i18n: getIntl(state),
    showBackButton: state.conversations.selectedConversationPanelDepth > 0,
    outgoingCallButtonStyle: getOutgoingCallButtonStyle(conversation, state),
    contactDetailsSetting: getContactDetailsSetting()
  };
};

const smart = connect(mapStateToProps, {});

export const SmartConversationHeader = smart(ConversationHeader);
