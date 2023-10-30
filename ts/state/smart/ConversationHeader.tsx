// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';
import React from 'react';
import { useSelector } from 'react-redux';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader';
import { getCannotLeaveBecauseYouAreLastAdmin } from '../../components/conversation/conversation-details/ConversationDetails';
import { CallMode } from '../../types/Calling';
import { strictAssert } from '../../util/assert';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import { getOwn } from '../../util/getOwn';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { isSignalConversation } from '../../util/isSignalConversation';
import { missingCaseError } from '../../util/missingCaseError';
import { getActiveCall, useCallingActions } from '../ducks/calling';
import { isAnybodyElseInGroupCall } from '../ducks/callingHelpers';
import type { ConversationType } from '../ducks/conversations';
import {
  getConversationCallMode,
  useConversationsActions,
} from '../ducks/conversations';
import { useDocActions } from '../ducks/docs';
import { useSearchActions } from '../ducks/search';
import { useStoriesActions } from '../ducks/stories';
import type { StateType } from '../reducer';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationByServiceIdSelector,
  getConversationSelector,
  getHasPanelOpen,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations';
import { getHasStoriesSelector } from '../selectors/stories2';
import { getIntl, getTheme, getUserACI } from '../selectors/user';

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
    case CallMode.Group: {
      const call = getOwn(calling.callsByConversation, conversation.id);
      if (
        call?.callMode === CallMode.Group &&
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
  const { toggleDocView } = useDocActions();
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
      toggleDocView={toggleDocView}
      setDisappearingMessages={setDisappearingMessages}
      setMuteExpiration={setMuteExpiration}
      setPinned={setPinned}
      theme={theme}
      toggleSelectMode={toggleSelectMode}
      viewUserStories={viewUserStories}
    />
  );
}
