// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import React, { memo, useCallback, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ConversationDetails } from '../../components/conversation/conversation-details/ConversationDetails.dom.js';
import {
  getGroupSizeHardLimit,
  getGroupSizeRecommendedLimit,
} from '../../groups/limits.dom.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import type { CallHistoryGroup } from '../../types/CallDisposition.std.js';
import { assertDev } from '../../util/assert.std.js';
import { getConversationColorAttributes } from '../../util/getConversationColorAttributes.std.js';
import { getGroupMemberships } from '../../util/getGroupMemberships.dom.js';
import {
  getBadgesSelector,
  getPreferredBadgeSelector,
} from '../selectors/badges.preload.js';
import { getActiveCallState } from '../selectors/calling.std.js';
import {
  getAllComposableConversations,
  getCachedConversationMemberColorsSelector,
  getConversationByIdSelector,
  getConversationByServiceIdSelector,
  getPendingAvatarDownloadSelector,
} from '../selectors/conversations.dom.js';
import {
  getAreWeASubscriber,
  getDefaultConversationColor,
  getItems,
} from '../selectors/items.dom.js';
import { getSelectedNavTab } from '../selectors/nav.std.js';
import {
  getIntl,
  getTheme,
  getUserACI,
  getVersion,
} from '../selectors/user.std.js';
import type { SmartChooseGroupMembersModalPropsType } from './ChooseGroupMembersModal.preload.js';
import { SmartChooseGroupMembersModal } from './ChooseGroupMembersModal.preload.js';
import type { SmartConfirmAdditionsModalPropsType } from './ConfirmAdditionsModal.dom.js';
import { SmartConfirmAdditionsModal } from './ConfirmAdditionsModal.dom.js';
import type { ConversationType } from '../ducks/conversations.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { useSearchActions } from '../ducks/search.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';
import { drop } from '../../util/drop.std.js';
import { DataReader } from '../../sql/Client.preload.js';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.js';
import { getCanAddLabel } from '../../types/GroupMemberLabels.std.js';
import { useToastActions } from '../ducks/toast.preload.js';
import { useNavActions } from '../ducks/nav.std.js';

const { sortBy } = lodash;

export type SmartConversationDetailsProps = {
  conversationId: string;
  callHistoryGroup?: CallHistoryGroup | null;
};

const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

const renderChooseGroupMembersModal = (
  props: SmartChooseGroupMembersModalPropsType
) => {
  return <SmartChooseGroupMembersModal {...props} />;
};

const renderConfirmAdditionsModal = (
  props: SmartConfirmAdditionsModalPropsType
) => {
  return <SmartConfirmAdditionsModal {...props} />;
};

function getGroupsInCommonSorted(
  conversation: ConversationType,
  allComposableConversations: ReadonlyArray<ConversationType>
) {
  if (conversation.type !== 'direct') {
    return [];
  }
  const groupsInCommonUnsorted = allComposableConversations.filter(
    otherConversation => {
      if (otherConversation.type !== 'group') {
        return false;
      }
      return otherConversation.memberships?.some(member => {
        return member.aci === conversation.serviceId;
      });
    }
  );

  return sortBy(groupsInCommonUnsorted, 'title');
}

export const SmartConversationDetails = memo(function SmartConversationDetails({
  conversationId,
  callHistoryGroup,
}: SmartConversationDetailsProps) {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const ourAci = useSelector(getUserACI);
  const activeCall = useSelector(getActiveCallState);
  const version = useSelector(getVersion);
  const items = useSelector(getItems);
  const allComposableConversations = useSelector(getAllComposableConversations);
  const areWeASubscriber = useSelector(getAreWeASubscriber);
  const badgesSelector = useSelector(getBadgesSelector);
  const conversationByServiceIdSelector = useSelector(
    getConversationByServiceIdSelector
  );
  const conversationSelector = useSelector(getConversationByIdSelector);
  const defaultConversationColor = useSelector(getDefaultConversationColor);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const isPendingAvatarDownload = useSelector(getPendingAvatarDownloadSelector);
  const selectedNavTab = useSelector(getSelectedNavTab);
  const getCachedConversationMemberColors = useSelector(
    getCachedConversationMemberColorsSelector
  );

  const {
    acceptConversation,
    addMembersToGroup,
    blockConversation,
    deleteAvatarFromDisk,
    getProfilesForConversation,
    leaveGroup,
    replaceAvatar,
    saveAvatarToDisk,
    setDisappearingMessages,
    setMuteExpiration,
    showConversation,
    startAvatarDownload,
    updateGroupAttributes,
    updateNicknameAndNote,
  } = useConversationsActions();
  const { pushPanelForConversation } = useNavActions();
  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
  } = useCallingActions();
  const { searchInConversation } = useSearchActions();
  const {
    showContactModal,
    toggleAboutContactModal,
    toggleAddUserToAnotherGroupModal,
    toggleEditNicknameAndNoteModal,
    toggleSafetyNumberModal,
  } = useGlobalModalActions();
  const { showToast } = useToastActions();

  const conversation = conversationSelector(conversationId);
  assertDev(
    conversation,
    '<SmartConversationDetails> expected a conversation to be found'
  );
  const conversationWithColorAttributes = {
    ...conversation,
    ...getConversationColorAttributes(conversation, defaultConversationColor),
  };

  const groupMemberships = getGroupMemberships(
    conversation,
    conversationByServiceIdSelector
  );

  const { memberships, pendingApprovalMemberships, pendingMemberships } =
    groupMemberships;
  const badges = badgesSelector(conversation.badges);
  const canAddNewMembers = conversation.canAddNewMembers ?? false;
  const canEditGroupInfo = conversation.canEditGroupInfo ?? false;
  const isEditMemberLabelEnabled = isFeaturedEnabledSelector({
    betaKey: 'desktop.groupMemberLabels.edit.beta',
    currentVersion: version,
    remoteConfig: items.remoteConfig,
    prodKey: 'desktop.groupMemberLabels.edit.prod',
  });

  const groupsInCommon = getGroupsInCommonSorted(
    conversation,
    allComposableConversations
  );
  const hasActiveCall =
    activeCall != null && activeCall.conversationId !== conversationId;
  const hasGroupLink =
    conversation.groupLink != null &&
    conversation.accessControlAddFromInviteLink !== ACCESS_ENUM.UNSATISFIABLE;
  const isAdmin = conversation.areWeAdmin ?? false;
  const isGroup = conversation.type === 'group';
  const maxGroupSize = getGroupSizeHardLimit(1001);
  const maxRecommendedGroupSize = getGroupSizeRecommendedLimit(151);
  const userAvatarData = conversation.avatars ?? [];
  const memberColors = getCachedConversationMemberColors(conversationId);

  const ourMembership = conversation.memberships?.find(
    membership => membership?.aci === ourAci
  );
  const canAddLabel = getCanAddLabel(conversation, ourMembership);

  const handleDeleteNicknameAndNote = useCallback(() => {
    updateNicknameAndNote(conversationId, { nickname: null, note: null });
  }, [conversationId, updateNicknameAndNote]);

  const handleOpenEditNicknameAndNoteModal = useCallback(() => {
    toggleEditNicknameAndNoteModal({ conversationId });
  }, [conversationId, toggleEditNicknameAndNoteModal]);

  const [hasMedia, setHasMedia] = useState(false);

  useEffect(() => {
    let isCanceled = false;

    drop(
      (async () => {
        const result = await DataReader.hasMedia(conversationId);
        if (isCanceled) {
          return;
        }
        setHasMedia(result);
      })()
    );

    return () => {
      isCanceled = true;
    };
  }, [conversationId]);

  return (
    <ConversationDetails
      acceptConversation={acceptConversation}
      addMembersToGroup={addMembersToGroup}
      areWeASubscriber={areWeASubscriber}
      badges={badges}
      blockConversation={blockConversation}
      callHistoryGroup={callHistoryGroup}
      canAddLabel={canAddLabel}
      canAddNewMembers={canAddNewMembers}
      canEditGroupInfo={canEditGroupInfo}
      conversation={conversationWithColorAttributes}
      deleteAvatarFromDisk={deleteAvatarFromDisk}
      getPreferredBadge={getPreferredBadge}
      getProfilesForConversation={getProfilesForConversation}
      groupsInCommon={groupsInCommon}
      hasActiveCall={hasActiveCall}
      hasGroupLink={hasGroupLink}
      i18n={i18n}
      isAdmin={isAdmin}
      isEditMemberLabelEnabled={isEditMemberLabelEnabled}
      isGroup={isGroup}
      isSignalConversation={isSignalConversation(conversation)}
      leaveGroup={leaveGroup}
      hasMedia={hasMedia}
      maxGroupSize={maxGroupSize}
      maxRecommendedGroupSize={maxRecommendedGroupSize}
      memberColors={memberColors}
      memberships={memberships}
      onDeleteNicknameAndNote={handleDeleteNicknameAndNote}
      onOpenEditNicknameAndNoteModal={handleOpenEditNicknameAndNoteModal}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      pendingApprovalMemberships={pendingApprovalMemberships}
      pendingAvatarDownload={isPendingAvatarDownload(conversationId)}
      pendingMemberships={pendingMemberships}
      pushPanelForConversation={pushPanelForConversation}
      renderChooseGroupMembersModal={renderChooseGroupMembersModal}
      renderConfirmAdditionsModal={renderConfirmAdditionsModal}
      replaceAvatar={replaceAvatar}
      saveAvatarToDisk={saveAvatarToDisk}
      searchInConversation={searchInConversation}
      selectedNavTab={selectedNavTab}
      setDisappearingMessages={setDisappearingMessages}
      setMuteExpiration={setMuteExpiration}
      showContactModal={showContactModal}
      showConversation={showConversation}
      showToast={showToast}
      startAvatarDownload={() => startAvatarDownload(conversationId)}
      theme={theme}
      toggleAboutContactModal={toggleAboutContactModal}
      toggleAddUserToAnotherGroupModal={toggleAddUserToAnotherGroupModal}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      updateGroupAttributes={updateGroupAttributes}
      userAvatarData={userAvatarData}
    />
  );
});
