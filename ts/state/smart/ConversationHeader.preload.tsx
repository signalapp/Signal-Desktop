// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useContactNameData } from '../../components/conversation/ContactName.dom.js';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader.dom.js';
import { getCannotLeaveBecauseYouAreLastAdmin } from '../../components/conversation/conversation-details/ConversationDetails.dom.js';
import { useMinimalConversation } from '../../hooks/useMinimalConversation.std.js';
import { CallMode } from '../../types/CallDisposition.std.js';
import { PanelType } from '../../types/Panels.std.js';
import { StoryViewModeType } from '../../types/Stories.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation.preload.js';
import { getGroupMemberships } from '../../util/getGroupMemberships.dom.js';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly.std.js';
import { isGroupOrAdhocCallState } from '../../util/isGroupOrAdhocCall.std.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { isAnybodyElseInGroupCall } from '../ducks/callingHelpers.std.js';
import type { ConversationType } from '../ducks/conversations.preload.js';
import {
  getConversationCallMode,
  useConversationsActions,
} from '../ducks/conversations.preload.js';
import { useSearchActions } from '../ducks/search.preload.js';
import { useStoriesActions } from '../ducks/stories.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import {
  getActiveCallState,
  getCallSelector,
} from '../selectors/calling.std.js';
import {
  getConversationByServiceIdSelector,
  getConversationSelector,
  isMissingRequiredProfileSharing as getIsMissingRequiredProfileSharing,
  getSelectedMessageIds,
} from '../selectors/conversations.dom.js';
import { getHasPanelOpen } from '../selectors/nav.std.js';
import { getHasStoriesSelector } from '../selectors/stories2.dom.js';
import { getIntl, getTheme, getUserACI } from '../selectors/user.std.js';
import { isConversationEverUnregistered } from '../../util/isConversationUnregistered.dom.js';
import { isDirectConversation } from '../../util/whatTypeOfConversation.dom.js';
import type { DurationInSeconds } from '../../util/durations/index.std.js';
import { selectAudioPlayerActive } from '../selectors/audioPlayer.preload.js';
import type { SmartCollidingAvatarsProps } from './CollidingAvatars.dom.js';
import { SmartCollidingAvatars } from './CollidingAvatars.dom.js';
import type { SmartMiniPlayerProps } from './MiniPlayer.preload.js';
import { SmartMiniPlayer } from './MiniPlayer.preload.js';
import { SmartPinnedMessagesBar } from './PinnedMessagesBar.preload.js';
import { getContactSpoofingWarningSelector } from '../selectors/timeline.preload.js';
import { useNavActions } from '../ducks/nav.std.js';

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
      return getAddedByForOurPendingInvitation(conversation);
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
