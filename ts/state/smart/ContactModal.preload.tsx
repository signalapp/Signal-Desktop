// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ContactModal } from '../../components/conversation/ContactModal.dom.js';
import { getAreWeASubscriber, getItems } from '../selectors/items.dom.js';
import { getIntl, getTheme, getVersion } from '../selectors/user.std.js';
import { getBadgesSelector } from '../selectors/badges.preload.js';
import {
  getCachedConversationMemberColorsSelector,
  getConversationSelector,
} from '../selectors/conversations.dom.js';
import { getHasStoriesSelector } from '../selectors/stories2.dom.js';
import {
  getActiveCallState,
  getCallLinkSelector,
  isInFullScreenCall as getIsInFullScreenCall,
  getParticipantInActiveCall,
} from '../selectors/calling.std.js';
import { useStoriesActions } from '../ducks/stories.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { getContactModalState } from '../selectors/globalModals.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { CallMode } from '../../types/CallDisposition.std.js';
import { isCallLinkAdmin } from '../../types/CallLink.std.js';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.js';

export const SmartContactModal = memo(function SmartContactModal() {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const { conversationId, contactId, activeCallDemuxId } =
    useSelector(getContactModalState) ?? {};
  const conversationSelector = useSelector(getConversationSelector);
  const hasStoriesSelector = useSelector(getHasStoriesSelector);

  const version = useSelector(getVersion);
  const items = useSelector(getItems);
  const isRemoteMuteSendEnabled = isFeaturedEnabledSelector({
    betaKey: 'desktop.remoteMute.send.beta',
    currentVersion: version,
    remoteConfig: items.remoteConfig,
    prodKey: 'desktop.remoteMute.send.prod',
  });

  const activeCallState = useSelector(getActiveCallState);
  const isInFullScreenCall = useSelector(getIsInFullScreenCall);
  const getCallParticipant = useSelector(getParticipantInActiveCall);
  const callParticipant = getCallParticipant(activeCallDemuxId);
  const isRemoteMuteVisible =
    isRemoteMuteSendEnabled && Boolean(callParticipant);
  const isMuted = !callParticipant?.hasRemoteAudio;

  const callLinkSelector = useSelector(getCallLinkSelector);
  let isRemoveFromCallVisible = false;
  if (activeCallState?.callMode === CallMode.Adhoc) {
    const callLink = callLinkSelector(activeCallState.conversationId);
    if (callParticipant && callLink && isCallLinkAdmin(callLink)) {
      isRemoveFromCallVisible = true;
    }
  }

  const badgesSelector = useSelector(getBadgesSelector);
  const areWeASubscriber = useSelector(getAreWeASubscriber);

  const conversation = conversationSelector(conversationId);
  const contact = conversationSelector(contactId);
  const hasStories = hasStoriesSelector(contactId);
  const hasActiveCall = activeCallState != null;
  const badges = badgesSelector(contact.badges);

  const areWeAdmin = conversation?.areWeAdmin ?? false;

  const contactMembership = useMemo(() => {
    return conversation?.memberships?.find(membership => {
      return membership.aci === contact.serviceId;
    });
  }, [conversation?.memberships, contact]);

  const isMember = contactMembership != null;
  const isAdmin = contactMembership?.isAdmin ?? false;
  const getMemberColors = useSelector(
    getCachedConversationMemberColorsSelector
  );
  const memberColors = getMemberColors(conversationId);
  const { labelEmoji: contactLabelEmoji, labelString: contactLabelString } =
    contactMembership || {};
  const contactNameColor = contactId ? memberColors.get(contactId) : undefined;

  const {
    removeMemberFromGroup,
    showConversation,
    toggleAdmin,
    blockConversation,
    startAvatarDownload,
  } = useConversationsActions();
  const { viewUserStories } = useStoriesActions();
  const {
    hideContactModal,
    toggleAboutContactModal,
    toggleAddUserToAnotherGroupModal,
    toggleEditNicknameAndNoteModal,
    toggleGroupMemberLabelInfoModal,
    toggleSafetyNumberModal,
  } = useGlobalModalActions();
  const {
    blockClient: blockClientFromCall,
    onOutgoingVideoCallInConversation,
    onOutgoingAudioCallInConversation,
    togglePip,
    removeClient: removeClientFromCall,
    sendRemoteMute,
  } = useCallingActions();

  const handleOpenEditNicknameAndNoteModal = useCallback(() => {
    strictAssert(contactId != null, 'Expected conversationId to be set');
    toggleEditNicknameAndNoteModal({ conversationId: contactId });
  }, [toggleEditNicknameAndNoteModal, contactId]);

  return (
    <ContactModal
      areWeAdmin={areWeAdmin}
      areWeASubscriber={areWeASubscriber}
      badges={badges}
      blockClientFromCall={blockClientFromCall}
      blockConversation={blockConversation}
      contact={contact}
      contactLabelEmoji={contactLabelEmoji}
      contactLabelString={contactLabelString}
      contactNameColor={contactNameColor}
      conversation={conversation}
      hasActiveCall={hasActiveCall}
      hasStories={hasStories}
      hideContactModal={hideContactModal}
      i18n={i18n}
      isAdmin={isAdmin}
      isInFullScreenCall={isInFullScreenCall}
      isMember={isMember}
      isMuted={isMuted}
      isRemoteMuteVisible={isRemoteMuteVisible}
      isRemoveFromCallVisible={isRemoveFromCallVisible}
      activeCallDemuxId={activeCallDemuxId}
      onOpenEditNicknameAndNoteModal={handleOpenEditNicknameAndNoteModal}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      removeClientFromCall={removeClientFromCall}
      removeMemberFromGroup={removeMemberFromGroup}
      sendRemoteMute={sendRemoteMute}
      showConversation={showConversation}
      startAvatarDownload={() => startAvatarDownload(contact.id)}
      theme={theme}
      toggleAboutContactModal={toggleAboutContactModal}
      toggleAddUserToAnotherGroupModal={toggleAddUserToAnotherGroupModal}
      toggleAdmin={toggleAdmin}
      toggleGroupMemberLabelInfoModal={toggleGroupMemberLabelInfoModal}
      togglePip={togglePip}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      viewUserStories={viewUserStories}
    />
  );
});
