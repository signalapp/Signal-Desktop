// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { pick } from 'lodash';
import { ConversationHeader } from '../../components/conversation/ConversationHeader';
import { getConversationSelector } from '../selectors/conversations';
import { StateType } from '../reducer';
import { CallMode } from '../../types/Calling';
import { getConversationCallMode } from '../ducks/conversations';
import { getActiveCall } from '../ducks/calling';
import { getIntl } from '../selectors/user';

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

const mapStateToProps = (state: StateType, ownProps: OwnProps) => {
  const conversation = getConversationSelector(state)(ownProps.id);
  if (!conversation) {
    throw new Error('Could not find conversation');
  }

  const conversationCallMode = getConversationCallMode(conversation);
  const conversationSupportsCalls =
    conversationCallMode === CallMode.Direct ||
    (conversationCallMode === CallMode.Group && window.GROUP_CALLING);

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
    showCallButtons: conversationSupportsCalls && !getActiveCall(state.calling),
  };
};

const smart = connect(mapStateToProps, {});

export const SmartConversationHeader = smart(ConversationHeader);
