// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { AboutContactModal } from '../../components/conversation/AboutContactModal.dom.js';
import { isSignalConnection } from '../../util/getSignalConnections.preload.js';
import { getIntl, getVersion } from '../selectors/user.std.js';
import { getAboutContactModalState } from '../selectors/globalModals.std.js';
import {
  getCachedConversationMemberColorsSelector,
  getConversationSelector,
  getPendingAvatarDownloadSelector,
} from '../selectors/conversations.dom.js';
import { useSharedGroupNamesOnMount } from '../../util/sharedGroupNames.dom.js';
import type { ConversationType } from '../ducks/conversations.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import { getAddedByForOurPendingInvitation } from '../../util/getAddedByForOurPendingInvitation.preload.js';
import { getItems } from '../selectors/items.dom.js';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.js';
import { getCanAddLabel } from '../../types/GroupMemberLabels.std.js';
import { useNavActions } from '../ducks/nav.std.js';
import { PanelType } from '../../types/Panels.std.js';
import {
  NavTab,
  ProfileEditorPage,
  SettingsPage,
} from '../../types/Nav.std.js';
import { getSelectedLocation } from '../selectors/nav.std.js';
import { getLeafPanelOnly } from '../../components/conversation/conversation-details/GroupMemberLabelEditor.dom.js';

function isFromOrAddedByTrustedContact(
  conversation: ConversationType
): boolean {
  if (conversation.type === 'direct') {
    return Boolean(conversation.name) || Boolean(conversation.profileSharing);
  }

  const addedByConv = getAddedByForOurPendingInvitation(conversation);
  if (!addedByConv) {
    return false;
  }

  return Boolean(
    addedByConv.isMe || addedByConv.name || addedByConv.profileSharing
  );
}

export const SmartAboutContactModal = memo(function SmartAboutContactModal() {
  const i18n = useSelector(getIntl);
  const version = useSelector(getVersion);
  const items = useSelector(getItems);
  const { conversationId, contactId } =
    useSelector(getAboutContactModalState) ?? {};
  const getConversation = useSelector(getConversationSelector);
  const isPendingAvatarDownload = useSelector(getPendingAvatarDownloadSelector);

  const isEditMemberLabelEnabled = isFeaturedEnabledSelector({
    betaKey: 'desktop.groupMemberLabels.edit.beta',
    currentVersion: version,
    remoteConfig: items.remoteConfig,
    prodKey: 'desktop.groupMemberLabels.edit.prod',
  });

  const sharedGroupNames = useSharedGroupNamesOnMount(contactId ?? '');

  const { startAvatarDownload } = useConversationsActions();

  const contact = getConversation(contactId);
  const conversation = getConversation(conversationId);

  const getMemberColors = useSelector(
    getCachedConversationMemberColorsSelector
  );
  const memberColors = getMemberColors(conversationId);
  const contactNameColor = memberColors?.get(contact.id);
  const contactMembership = conversation.memberships?.find(
    membership => contact.serviceId && membership.aci === contact.serviceId
  );
  const { labelEmoji: contactLabelEmoji, labelString: contactLabelString } =
    contactMembership || {};
  const canAddLabel = getCanAddLabel(conversation, contactMembership);

  const {
    toggleAboutContactModal,
    toggleSignalConnectionsModal,
    toggleSafetyNumberModal,
    toggleNotePreviewModal,
    toggleProfileNameWarningModal,
  } = useGlobalModalActions();
  const { changeLocation } = useNavActions();

  const selectedLocation = useSelector(getSelectedLocation);
  const leafPanelOnly = getLeafPanelOnly(selectedLocation, conversationId);

  const handleOpenNotePreviewModal = useCallback(() => {
    strictAssert(contactId != null, 'contactId is required');
    toggleNotePreviewModal({ conversationId: contactId });
  }, [toggleNotePreviewModal, contactId]);

  if (contact == null) {
    return null;
  }

  return (
    <AboutContactModal
      i18n={i18n}
      canAddLabel={canAddLabel}
      contact={contact}
      contactLabelEmoji={contactLabelEmoji}
      contactLabelString={contactLabelString}
      contactNameColor={contactNameColor}
      fromOrAddedByTrustedContact={isFromOrAddedByTrustedContact(contact)}
      isEditMemberLabelEnabled={isEditMemberLabelEnabled}
      isSignalConnection={isSignalConnection(contact)}
      onClose={toggleAboutContactModal}
      onOpenNotePreviewModal={handleOpenNotePreviewModal}
      pendingAvatarDownload={
        conversationId ? isPendingAvatarDownload(conversationId) : false
      }
      sharedGroupNames={sharedGroupNames}
      showProfileEditor={() => {
        changeLocation({
          tab: NavTab.Settings,
          details: {
            page: SettingsPage.Profile,
            state: ProfileEditorPage.ProfileName,
          },
        });
        toggleAboutContactModal(undefined);
      }}
      showQRCodeScreen={() => {
        changeLocation({
          tab: NavTab.Settings,
          details: {
            page: SettingsPage.Profile,
            state: ProfileEditorPage.UsernameLink,
          },
        });
        toggleAboutContactModal(undefined);
      }}
      showEditMemberLabelScreen={() => {
        changeLocation({
          tab: NavTab.Chats,
          details: {
            conversationId,
            panels: {
              direction: 'push' as const,
              isAnimating: false,
              leafPanelOnly,
              stack: [
                { type: PanelType.ConversationDetails },
                { type: PanelType.GroupMemberLabelEditor },
              ],
              wasAnimated: false,
              watermark: 1,
            },
          },
        });
        toggleAboutContactModal(undefined);
      }}
      startAvatarDownload={
        conversationId ? () => startAvatarDownload(conversationId) : undefined
      }
      toggleProfileNameWarningModal={toggleProfileNameWarningModal}
      toggleSafetyNumberModal={toggleSafetyNumberModal}
      toggleSignalConnectionsModal={toggleSignalConnectionsModal}
    />
  );
});
