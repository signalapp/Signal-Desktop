// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ContactModal } from '../../components/conversation/ContactModal.js';
import { getAreWeASubscriber } from '../selectors/items.js';
import { getIntl, getTheme } from '../selectors/user.js';
import { getBadgesSelector } from '../selectors/badges.js';
import { getConversationSelector } from '../selectors/conversations.js';
import { getHasStoriesSelector } from '../selectors/stories2.js';
import {
  getActiveCallState,
  isInFullScreenCall as getIsInFullScreenCall,
} from '../selectors/calling.js';
import { useStoriesActions } from '../ducks/stories.js';
import { useConversationsActions } from '../ducks/conversations.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';
import { useCallingActions } from '../ducks/calling.js';
import { getContactModalState } from '../selectors/globalModals.js';
import { strictAssert } from '../../util/assert.js';

export const SmartContactModal = memo(function SmartContactModal() {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const { conversationId, contactId } = useSelector(getContactModalState) ?? {};
  const conversationSelector = useSelector(getConversationSelector);
  const hasStoriesSelector = useSelector(getHasStoriesSelector);
  const activeCallState = useSelector(getActiveCallState);
  const isInFullScreenCall = useSelector(getIsInFullScreenCall);
  const badgesSelector = useSelector(getBadgesSelector);
  const areWeASubscriber = useSelector(getAreWeASubscriber);

  const conversation = conversationSelector(conversationId);
  const contact = conversationSelector(contactId);
  const hasStories = hasStoriesSelector(contactId);
  const hasActiveCall = activeCallState != null;
  const badges = badgesSelector(contact.badges);

  const areWeAdmin = conversation?.areWeAdmin ?? false;

  const ourMembership = useMemo(() => {
    return conversation?.memberships?.find(membership => {
      return membership.aci === contact.serviceId;
    });
  }, [conversation?.memberships, contact]);

  const isMember = ourMembership != null;
  const isAdmin = ourMembership?.isAdmin ?? false;

  const {
    removeMemberFromGroup,
    showConversation,
    updateConversationModelSharedGroups,
    toggleAdmin,
    blockConversation,
    startAvatarDownload,
  } = useConversationsActions();
  const { viewUserStories } = useStoriesActions();
  const {
    toggleAboutContactModal,
    toggleAddUserToAnotherGroupModal,
    toggleSafetyNumberModal,
    hideContactModal,
    toggleEditNicknameAndNoteModal,
  } = useGlobalModalActions();
  const {
    onOutgoingVideoCallInConversation,
    onOutgoingAudioCallInConversation,
    togglePip,
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
      blockConversation={blockConversation}
      contact={contact}
      conversation={conversation}
      hasActiveCall={hasActiveCall}
      hasStories={hasStories}
      hideContactModal={hideContactModal}
      i18n={i18n}
      isAdmin={isAdmin}
      isInFullScreenCall={isInFullScreenCall}
      isMember={isMember}
      onOpenEditNicknameAndNoteModal={handleOpenEditNicknameAndNoteModal}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      removeMemberFromGroup={removeMemberFromGroup}
      showConversation={showConversation}
      startAvatarDownload={() => startAvatarDownload(contact.id)}
      theme={theme}
      toggleAboutContactModal={toggleAboutContactModal}
      toggleAddUserToAnotherGroupModal={toggleAddUserToAnotherGroupModal}
      toggleAdmin={toggleAdmin}
      togglePip={togglePip}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      updateConversationModelSharedGroups={updateConversationModelSharedGroups}
      viewUserStories={viewUserStories}
    />
  );
});
