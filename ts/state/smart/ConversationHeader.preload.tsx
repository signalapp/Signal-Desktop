// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useContactNameData } from '../../components/conversation/ContactName.dom.tsx';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader.dom.tsx';
import { getCannotLeaveBecauseYouAreLastAdmin } from '../../components/conversation/conversation-details/ConversationDetails.dom.tsx';
import { useMinimalConversation } from '../../hooks/useMinimalConversation.std.ts';
import { CallMode } from '../../types/CallDisposition.std.ts';
import { PanelType } from '../../types/Panels.std.ts';
import { StoryViewModeType } from '../../types/Stories.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { getAddedByForGroup } from '../../util/getAddedByForGroup.preload.ts';
import { getGroupMemberships } from '../../util/getGroupMemberships.dom.ts';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly.std.ts';
import { isGroupOrAdhocCallState } from '../../util/isGroupOrAdhocCall.std.ts';
import { isSignalConversation } from '../../util/isSignalConversation.dom.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { getConversationCallMode } from '../../util/getConversationCallMode.std.ts';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { isAnybodyElseInGroupCall } from '../ducks/callingHelpers.std.ts';
import type { ConversationType } from '../ducks/conversations.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useSearchActions } from '../ducks/search.preload.ts';
import { useStoriesActions } from '../ducks/stories.preload.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import {
  getActiveCallState,
  getCallSelector,
} from '../selectors/calling.std.ts';
import {
  getConversationByServiceIdSelector,
  getConversationSelector,
  isMissingRequiredProfileSharing as getIsMissingRequiredProfileSharing,
  getSelectedMessageIds,
} from '../selectors/conversations.dom.ts';
import { getHasPanelOpen } from '../selectors/nav.std.ts';
import { getHasStoriesSelector } from '../selectors/stories2.dom.ts';
import { getIntl, getTheme, getUserACI } from '../selectors/user.std.ts';
import { isConversationEverUnregistered } from '../../util/isConversationUnregistered.dom.ts';
import { isDirectConversation } from '../../util/whatTypeOfConversation.dom.ts';
import type { DurationInSeconds } from '../../util/durations/index.std.ts';
import { selectAudioPlayerActive } from '../selectors/audioPlayer.preload.ts';
import type { SmartCollidingAvatarsProps } from './CollidingAvatars.dom.tsx';
import { SmartCollidingAvatars } from './CollidingAvatars.dom.tsx';
import type { SmartMiniPlayerProps } from './MiniPlayer.preload.tsx';
import { SmartMiniPlayer } from './MiniPlayer.preload.tsx';
import { SmartPinnedMessagesBar } from './PinnedMessagesBar.preload.tsx';
import { getContactSpoofingWarningSelector } from '../selectors/timeline.preload.ts';
import { useNavActions } from '../ducks/nav.std.ts';

function renderCollidingAvatars(
  props: SmartCollidingAvatarsProps
): React.JSX.Element {
  return <SmartCollidingAvatars {...props} />;
}

function renderMiniPlayer(props: SmartMiniPlayerProps): React.JSX.Element {
  return <SmartMiniPlayer {...props} />;
}

function renderPinnedMessagesBar(): React.JSX.Element {
  return <SmartPinnedMessagesBar />;
}

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

  const contactSpoofingWarningSelector = useSelector(
    getContactSpoofingWarningSelector
  );
  const contactSpoofingWarning = contactSpoofingWarningSelector(conversation);

  const activeAudioPlayer = useSelector(selectAudioPlayerActive);
  const shouldShowMiniPlayer = activeAudioPlayer != null;

  const {
    destroyMessages,
    leaveGroup,
    onArchive,
    onMarkUnread,
    onMoveToInbox,
    setDisappearingMessages,
    setMuteExpiration,
    setPinned,
    toggleSelectMode,
    acceptConversation,
    blockAndReportSpam,
    blockConversation,
    reportSpam,
    deleteConversation,
    acknowledgeGroupMemberNameCollisions,
    reviewConversationNameCollision,
  } = useConversationsActions();
  const { pushPanelForConversation } = useNavActions();
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
      return getAddedByForGroup(conversation);
    }
    return null;
  }, [conversation]);

  const addedByName = useContactNameData(addedBy);
  const conversationName = useContactNameData(conversation);
  strictAssert(conversationName, 'conversationName is required');

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
    (seconds: DurationInSeconds) => {
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
    (seconds: number) => {
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
      theme={theme}
      contactSpoofingWarning={contactSpoofingWarning}
      renderCollidingAvatars={renderCollidingAvatars}
      shouldShowMiniPlayer={shouldShowMiniPlayer}
      renderMiniPlayer={renderMiniPlayer}
      renderPinnedMessagesBar={renderPinnedMessagesBar}
      acknowledgeGroupMemberNameCollisions={
        acknowledgeGroupMemberNameCollisions
      }
      reviewConversationNameCollision={reviewConversationNameCollision}
    />
  );
});
