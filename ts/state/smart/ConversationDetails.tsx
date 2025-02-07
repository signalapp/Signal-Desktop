// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sortBy } from 'lodash';
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ConversationDetails } from '../../components/conversation/conversation-details/ConversationDetails';
import {
  getGroupSizeHardLimit,
  getGroupSizeRecommendedLimit,
} from '../../groups/limits';
import { SignalService as Proto } from '../../protobuf';
import type { CallHistoryGroup } from '../../types/CallDisposition';
import { assertDev } from '../../util/assert';
import { getConversationColorAttributes } from '../../util/getConversationColorAttributes';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import {
  getBadgesSelector,
  getPreferredBadgeSelector,
} from '../selectors/badges';
import { getActiveCallState } from '../selectors/calling';
import {
  getAllComposableConversations,
  getConversationByIdSelector,
  getConversationByServiceIdSelector,
} from '../selectors/conversations';
import {
  getAreWeASubscriber,
  getDefaultConversationColor,
} from '../selectors/items';
import { getSelectedNavTab } from '../selectors/nav';
import { getIntl, getTheme } from '../selectors/user';
import type { SmartChooseGroupMembersModalPropsType } from './ChooseGroupMembersModal';
import { SmartChooseGroupMembersModal } from './ChooseGroupMembersModal';
import type { SmartConfirmAdditionsModalPropsType } from './ConfirmAdditionsModal';
import { SmartConfirmAdditionsModal } from './ConfirmAdditionsModal';
import type { ConversationType } from '../ducks/conversations';
import { useConversationsActions } from '../ducks/conversations';
import { useCallingActions } from '../ducks/calling';
import { useSearchActions } from '../ducks/search';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLightboxActions } from '../ducks/lightbox';
import { isSignalConversation } from '../../util/isSignalConversation';

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
  const activeCall = useSelector(getActiveCallState);
  const allComposableConversations = useSelector(getAllComposableConversations);
  const areWeASubscriber = useSelector(getAreWeASubscriber);
  const badgesSelector = useSelector(getBadgesSelector);
  const conversationByServiceIdSelector = useSelector(
    getConversationByServiceIdSelector
  );
  const conversationSelector = useSelector(getConversationByIdSelector);
  const defaultConversationColor = useSelector(getDefaultConversationColor);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const selectedNavTab = useSelector(getSelectedNavTab);

  const {
    acceptConversation,
    addMembersToGroup,
    blockConversation,
    deleteAvatarFromDisk,
    getProfilesForConversation,
    leaveGroup,
    loadRecentMediaItems,
    pushPanelForConversation,
    replaceAvatar,
    saveAvatarToDisk,
    setDisappearingMessages,
    setMuteExpiration,
    showConversation,
    updateGroupAttributes,
    updateNicknameAndNote,
  } = useConversationsActions();
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
  const { showLightbox } = useLightboxActions();

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

  const handleDeleteNicknameAndNote = useCallback(() => {
    updateNicknameAndNote(conversationId, { nickname: null, note: null });
  }, [conversationId, updateNicknameAndNote]);

  const handleOpenEditNicknameAndNoteModal = useCallback(() => {
    toggleEditNicknameAndNoteModal({ conversationId });
  }, [conversationId, toggleEditNicknameAndNoteModal]);

  return (
    <ConversationDetails
      acceptConversation={acceptConversation}
      addMembersToGroup={addMembersToGroup}
      areWeASubscriber={areWeASubscriber}
      badges={badges}
      blockConversation={blockConversation}
      callHistoryGroup={callHistoryGroup}
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
      isGroup={isGroup}
      isSignalConversation={isSignalConversation(conversation)}
      leaveGroup={leaveGroup}
      loadRecentMediaItems={loadRecentMediaItems}
      maxGroupSize={maxGroupSize}
      maxRecommendedGroupSize={maxRecommendedGroupSize}
      memberships={memberships}
      onDeleteNicknameAndNote={handleDeleteNicknameAndNote}
      onOpenEditNicknameAndNoteModal={handleOpenEditNicknameAndNoteModal}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      pendingApprovalMemberships={pendingApprovalMemberships}
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
      showLightbox={showLightbox}
      theme={theme}
      toggleAboutContactModal={toggleAboutContactModal}
      toggleAddUserToAnotherGroupModal={toggleAddUserToAnotherGroupModal}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      updateGroupAttributes={updateGroupAttributes}
      userAvatarData={userAvatarData}
    />
  );
});
