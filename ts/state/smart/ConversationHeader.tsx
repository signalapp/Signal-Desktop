// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useContactNameData } from '../../components/conversation/ContactName';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader';
import { getCannotLeaveBecauseYouAreLastAdmin } from '../../components/conversation/conversation-details/ConversationDetails';
import { useMinimalConversation } from '../../hooks/useMinimalConversation';
import { CallMode } from '../../types/CallDisposition';
import { PanelType } from '../../types/Panels';
import { StoryViewModeType } from '../../types/Stories';
import { strictAssert } from '../../util/assert';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { isGroupOrAdhocCallState } from '../../util/isGroupOrAdhocCall';
import { isSignalConversation } from '../../util/isSignalConversation';
import { missingCaseError } from '../../util/missingCaseError';
import { useCallingActions } from '../ducks/calling';
import { isAnybodyElseInGroupCall } from '../ducks/callingHelpers';
import type { ConversationType } from '../ducks/conversations';
import {
  getConversationCallMode,
  useConversationsActions,
} from '../ducks/conversations';
import { useSearchActions } from '../ducks/search';
import { useStoriesActions } from '../ducks/stories';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getActiveCallState, getCallSelector } from '../selectors/calling';
import {
  getConversationByServiceIdSelector,
  getConversationSelector,
  getHasPanelOpen,
  isMissingRequiredProfileSharing as getIsMissingRequiredProfileSharing,
  getSelectedMessageIds,
} from '../selectors/conversations';
import { getHasStoriesSelector } from '../selectors/stories2';
import { getIntl, getTheme, getUserACI } from '../selectors/user';
import { useItemsActions } from '../ducks/items';
import { getLocalDeleteWarningShown } from '../selectors/items';
import { getDeleteSyncSendEnabled } from '../selectors/items-extra';
import { isConversationEverUnregistered } from '../../util/isConversationUnregistered';
import { isDirectConversation } from '../../util/whatTypeOfConversation';

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

  if (activeCall?.conversationId === conversation.id) {
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
  const activeCall = useSelector(getActiveCallState);
  const hasActiveCall = Boolean(activeCall);

  const {
    destroyMessages,
    leaveGroup,
    onArchive,
    onMarkUnread,
    onMoveToInbox,
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

  const isDeleteSyncSendEnabled = useSelector(getDeleteSyncSendEnabled);
  const isMissingMandatoryProfileSharing =
    getIsMissingRequiredProfileSharing(conversation);

  const onConversationAccept = useCallback(() => {
    acceptConversation(conversation.id);
  }, [acceptConversation, conversation.id]);

  const onConversationArchive = useCallback(() => {
    onArchive(conversation.id);
  }, [onArchive, conversation.id]);

  const onConversationBlock = useCallback(() => {
    blockConversation(conversation.id);
  }, [blockConversation, conversation.id]);

  const onConversationBlockAndReportSpam = useCallback(() => {
    blockAndReportSpam(conversation.id);
  }, [blockAndReportSpam, conversation.id]);

  const onConversationDelete = useCallback(() => {
    deleteConversation(conversation.id);
  }, [deleteConversation, conversation.id]);

  const onConversationDeleteMessages = useCallback(() => {
    destroyMessages(conversation.id);
  }, [destroyMessages, conversation.id]);

  const onConversationDisappearingMessagesChange = useCallback(
    seconds => {
      setDisappearingMessages(conversation.id, seconds);
    },
    [setDisappearingMessages, conversation.id]
  );

  const onConversationLeaveGroup = useCallback(() => {
    leaveGroup(conversation.id);
  }, [leaveGroup, conversation.id]);

  const onConversationMarkUnread = useCallback(() => {
    onMarkUnread(conversation.id);
  }, [onMarkUnread, conversation.id]);

  const onConversationMuteExpirationChange = useCallback(
    seconds => {
      setMuteExpiration(conversation.id, seconds);
    },
    [setMuteExpiration, conversation.id]
  );

  const onConversationPin = useCallback(() => {
    setPinned(conversation.id, true);
  }, [setPinned, conversation.id]);

  const onConversationReportSpam = useCallback(() => {
    reportSpam(conversation.id);
  }, [reportSpam, conversation.id]);

  const onConversationUnarchive = useCallback(() => {
    onMoveToInbox(conversation.id);
  }, [onMoveToInbox, conversation.id]);

  const onConversationUnpin = useCallback(() => {
    setPinned(conversation.id, false);
  }, [setPinned, conversation.id]);

  const onOutgoingAudioCall = useCallback(() => {
    onOutgoingAudioCallInConversation(conversation.id);
  }, [onOutgoingAudioCallInConversation, conversation.id]);

  const onOutgoingVideoCall = useCallback(() => {
    onOutgoingVideoCallInConversation(conversation.id);
  }, [onOutgoingVideoCallInConversation, conversation.id]);

  const onSearchInConversation = useCallback(() => {
    searchInConversation(conversation.id);
  }, [searchInConversation, conversation.id]);

  const onSelectModeEnter = useCallback(() => {
    toggleSelectMode(true);
  }, [toggleSelectMode]);

  const onShowMembers = useCallback(() => {
    pushPanelForConversation({ type: PanelType.GroupV1Members });
  }, [pushPanelForConversation]);

  const onViewConversationDetails = useCallback(() => {
    pushPanelForConversation({ type: PanelType.ConversationDetails });
  }, [pushPanelForConversation]);

  const onViewAllMedia = useCallback(() => {
    pushPanelForConversation({ type: PanelType.AllMedia });
  }, [pushPanelForConversation]);

  const onViewUserStories = useCallback(() => {
    viewUserStories({
      conversationId: conversation.id,
      storyViewMode: StoryViewModeType.User,
    });
  }, [viewUserStories, conversation.id]);

  const minimalConversation = useMinimalConversation(conversation);

  const localDeleteWarningShown = useSelector(getLocalDeleteWarningShown);
  const { putItem } = useItemsActions();
  const setLocalDeleteWarningShown = () =>
    putItem('localDeleteWarningShown', true);

  return (
    <ConversationHeader
      addedByName={addedByName}
      badge={badge}
      cannotLeaveBecauseYouAreLastAdmin={cannotLeaveBecauseYouAreLastAdmin}
      conversation={minimalConversation}
      conversationName={conversationName}
      hasActiveCall={hasActiveCall}
      hasPanelShowing={hasPanelShowing}
      hasStories={hasStories}
      i18n={i18n}
      localDeleteWarningShown={localDeleteWarningShown}
      isDeleteSyncSendEnabled={isDeleteSyncSendEnabled}
      isMissingMandatoryProfileSharing={isMissingMandatoryProfileSharing}
      isSelectMode={isSelectMode}
      isSignalConversation={isSignalConversation(conversation)}
      isSmsOnlyOrUnregistered={
        isDirectConversation(conversation) &&
        (isConversationSMSOnly(conversation) ||
          isConversationEverUnregistered(conversation))
      }
      onConversationAccept={onConversationAccept}
      onConversationArchive={onConversationArchive}
      onConversationBlock={onConversationBlock}
      onConversationBlockAndReportSpam={onConversationBlockAndReportSpam}
      onConversationDelete={onConversationDelete}
      onConversationDeleteMessages={onConversationDeleteMessages}
      onConversationDisappearingMessagesChange={
        onConversationDisappearingMessagesChange
      }
      onConversationLeaveGroup={onConversationLeaveGroup}
      onConversationMarkUnread={onConversationMarkUnread}
      onConversationMuteExpirationChange={onConversationMuteExpirationChange}
      onConversationPin={onConversationPin}
      onConversationReportSpam={onConversationReportSpam}
      onConversationUnarchive={onConversationUnarchive}
      onConversationUnpin={onConversationUnpin}
      onOutgoingAudioCall={onOutgoingAudioCall}
      onOutgoingVideoCall={onOutgoingVideoCall}
      onSearchInConversation={onSearchInConversation}
      onSelectModeEnter={onSelectModeEnter}
      onShowMembers={onShowMembers}
      onViewConversationDetails={onViewConversationDetails}
      onViewAllMedia={onViewAllMedia}
      onViewUserStories={onViewUserStories}
      outgoingCallButtonStyle={outgoingCallButtonStyle}
      setLocalDeleteWarningShown={setLocalDeleteWarningShown}
      sharedGroupNames={conversation.sharedGroupNames}
      theme={theme}
    />
  );
});
