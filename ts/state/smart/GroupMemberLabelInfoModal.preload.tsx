// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import { GroupMemberLabelInfoModal } from '../../components/GroupMemberLabelInfoModal.dom.js';
import { getIntl, getUser, getVersion } from '../selectors/user.std.js';
import { getGroupMemberLabelInfoModalState } from '../selectors/globalModals.std.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { getItems } from '../selectors/items.dom.js';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.js';
import { getCanAddLabel } from '../../types/GroupMemberLabels.std.js';
import { useNavActions } from '../ducks/nav.std.js';
import { NavTab } from '../../types/Nav.std.js';
import { PanelType } from '../../types/Panels.std.js';
import { getSelectedLocation } from '../selectors/nav.std.js';
import { getLeafPanelOnly } from '../../components/conversation/conversation-details/GroupMemberLabelEditor.dom.js';

export const SmartGroupMemberLabelInfoModal = memo(
  function SmartGroupMemberLabelInfoModal() {
    const i18n = useSelector(getIntl);
    const user = useSelector(getUser);
    const version = useSelector(getVersion);
    const items = useSelector(getItems);
    const { conversationId } =
      useSelector(getGroupMemberLabelInfoModalState) ?? {};
    const getConversation = useSelector(getConversationSelector);

    const { changeLocation } = useNavActions();

    const isEditMemberLabelEnabled = isFeaturedEnabledSelector({
      betaKey: 'desktop.groupMemberLabels.edit.beta',
      currentVersion: version,
      remoteConfig: items.remoteConfig,
      prodKey: 'desktop.groupMemberLabels.edit.prod',
    });

    const conversation = getConversation(conversationId);

    const selectedLocation = useSelector(getSelectedLocation);
    const leafPanelOnly = getLeafPanelOnly(selectedLocation, conversationId);

    const contactMembership = conversation.memberships?.find(
      membership => user.ourAci && membership.aci === user.ourAci
    );
    const hasLabel = Boolean(contactMembership?.labelString);
    const canAddLabel = getCanAddLabel(conversation, contactMembership);

    const { toggleGroupMemberLabelInfoModal, hideContactModal } =
      useGlobalModalActions();

    return (
      <GroupMemberLabelInfoModal
        i18n={i18n}
        canAddLabel={canAddLabel}
        hasLabel={hasLabel}
        isEditMemberLabelEnabled={isEditMemberLabelEnabled}
        onClose={() => toggleGroupMemberLabelInfoModal(undefined)}
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
          toggleGroupMemberLabelInfoModal(undefined);
          hideContactModal();
        }}
      />
    );
  }
);
