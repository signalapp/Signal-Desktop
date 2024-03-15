// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { pick } from 'lodash';
import type { ConversationType } from '../ducks/conversations';
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
import { useCallingActions } from '../ducks/calling';
import { isAnybodyElseInGroupCall } from '../ducks/callingHelpers';
import {
  getConversationCallMode,
  useConversationsActions,
} from '../ducks/conversations';
import { getHasStoriesSelector } from '../selectors/stories2';
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
import { useContactNameData } from '../../components/conversation/ContactName';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation';
import { getActiveCallState, getCallSelector } from '../selectors/calling';

export type OwnProps = {
  id: string;
};

const useOutgoingCallButtonStyle = (
  conversation: ConversationType
): OutgoingCallButtonStyle => {
  const ourAci = useSelector(getUserACI);
  const activeCall = useSelector(getActiveCallState);
  const callSelector = useSelector(getCallSelector);
  strictAssert(ourAci, 'useOutgoingCallButtonStyle missing our uuid');

  if (activeCall != null) {
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
      const call = callSelector(conversation.id);
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

export const SmartConversationHeader = memo(function SmartConversationHeader({
  id,
}: OwnProps) {
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
  const hasPanelShowing = useSelector(getHasPanelOpen);
  const outgoingCallButtonStyle = useOutgoingCallButtonStyle(conversation);
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
    acceptConversation,
    blockAndReportSpam,
    blockConversation,
    reportSpam,
    deleteConversation,
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

  const addedBy = useMemo(() => {
    if (conversation.type === 'group') {
      return getAddedByForOurPendingInvitation(conversation);
    }
    return null;
  }, [conversation]);

  const addedByName = useContactNameData(addedBy);
  const conversationName = useContactNameData(conversation);
  strictAssert(conversationName, 'conversationName is required');

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
      // MessageRequestActionsConfirmation
      addedByName={addedByName}
      conversationId={id}
      conversationType={conversation.type}
      conversationName={conversationName}
      isBlocked={conversation.isBlocked ?? false}
      isReported={conversation.isReported ?? false}
      acceptConversation={acceptConversation}
      blockAndReportSpam={blockAndReportSpam}
      blockConversation={blockConversation}
      reportSpam={reportSpam}
      deleteConversation={deleteConversation}
    />
  );
});
