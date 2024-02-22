// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import { pick } from 'lodash';
import type { ConversationType } from '../ducks/conversations';
import type { StateType } from '../reducer';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationByServiceIdSelector,
  getConversationSelector,
  getHasPanelOpen,
  getSelectedMessageIds,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations';
import { CallMode } from '../../types/Calling';
import { getActiveCall, useCallingActions } from '../ducks/calling';
import { isAnybodyElseInGroupCall } from '../ducks/callingHelpers';
import {
  getConversationCallMode,
  useConversationsActions,
} from '../ducks/conversations';
import { getHasStoriesSelector } from '../selectors/stories2';
import { getOwn } from '../../util/getOwn';
import { getUserACI, getIntl, getTheme } from '../selectors/user';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { missingCaseError } from '../../util/missingCaseError';
import { strictAssert } from '../../util/assert';
import { isSignalConversation } from '../../util/isSignalConversation';
import { useSearchActions } from '../ducks/search';
import { useStoriesActions } from '../ducks/stories';
import { getCannotLeaveBecauseYouAreLastAdmin } from '../../components/conversation/conversation-details/ConversationDetails';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import { isGroupOrAdhocCallState } from '../../util/isGroupOrAdhocCall';

export type OwnProps = {
  id: string;
};

const getOutgoingCallButtonStyle = (
  conversation: ConversationType,
  state: StateType
): OutgoingCallButtonStyle => {
  const { calling } = state;
  const ourAci = getUserACI(state);
  strictAssert(ourAci, 'getOutgoingCallButtonStyle missing our uuid');

  if (getActiveCall(calling)) {
    return OutgoingCallButtonStyle.None;
  }

  const conversationCallMode = getConversationCallMode(conversation);
  switch (conversationCallMode) {
    case null:
      return OutgoingCallButtonStyle.None;
    case CallMode.Direct:
      return OutgoingCallButtonStyle.Both;
    case CallMode.Group:
    case CallMode.Adhoc: {
      const call = getOwn(calling.callsByConversation, conversation.id);
      if (
        isGroupOrAdhocCallState(call) &&
        isAnybodyElseInGroupCall(call.peekInfo, ourAci)
      ) {
        return OutgoingCallButtonStyle.Join;
      }
      return OutgoingCallButtonStyle.JustVideo;
    }
    default:
      throw missingCaseError(conversationCallMode);
  }
};

export function SmartConversationHeader({ id }: OwnProps): JSX.Element {
  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(id);
  if (!conversation) {
    throw new Error('Could not find conversation');
  }
  const isAdmin = Boolean(conversation.areWeAdmin);
  const hasStoriesSelector = useSelector(getHasStoriesSelector);
  const hasStories = hasStoriesSelector(id);

  const badgeSelector = useSelector(getPreferredBadgeSelector);
  const badge = badgeSelector(conversation.badges);
  const i18n = useSelector(getIntl);
  const hasPanelShowing = useSelector<StateType, boolean>(getHasPanelOpen);
  const outgoingCallButtonStyle = useSelector<
    StateType,
    OutgoingCallButtonStyle
  >(state => getOutgoingCallButtonStyle(conversation, state));
  const theme = useSelector(getTheme);

  const {
    destroyMessages,
    leaveGroup,
    onArchive,
    onMarkUnread,
    onMoveToInbox,
    popPanelForConversation,
    pushPanelForConversation,
    setDisappearingMessages,
    setMuteExpiration,
    setPinned,
    toggleSelectMode,
  } = useConversationsActions();
  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
  } = useCallingActions();
  const { searchInConversation } = useSearchActions();
  const { viewUserStories } = useStoriesActions();

  const conversationByServiceIdSelector = useSelector(
    getConversationByServiceIdSelector
  );
  const groupMemberships = getGroupMemberships(
    conversation,
    conversationByServiceIdSelector
  );
  const cannotLeaveBecauseYouAreLastAdmin =
    getCannotLeaveBecauseYouAreLastAdmin(groupMemberships.memberships, isAdmin);

  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const isSelectMode = selectedMessageIds != null;

  return (
    <ConversationHeader
      {...pick(conversation, [
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
      ])}
      badge={badge}
      cannotLeaveBecauseYouAreLastAdmin={cannotLeaveBecauseYouAreLastAdmin}
      destroyMessages={destroyMessages}
      hasPanelShowing={hasPanelShowing}
      hasStories={hasStories}
      i18n={i18n}
      id={id}
      isMissingMandatoryProfileSharing={isMissingRequiredProfileSharing(
        conversation
      )}
      isSignalConversation={isSignalConversation(conversation)}
      isSMSOnly={isConversationSMSOnly(conversation)}
      leaveGroup={leaveGroup}
      onArchive={onArchive}
      onMarkUnread={onMarkUnread}
      onMoveToInbox={onMoveToInbox}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      outgoingCallButtonStyle={outgoingCallButtonStyle}
      popPanelForConversation={popPanelForConversation}
      pushPanelForConversation={pushPanelForConversation}
      searchInConversation={searchInConversation}
      setDisappearingMessages={setDisappearingMessages}
      setMuteExpiration={setMuteExpiration}
      setPinned={setPinned}
      theme={theme}
      isSelectMode={isSelectMode}
      toggleSelectMode={toggleSelectMode}
      viewUserStories={viewUserStories}
    />
  );
}
