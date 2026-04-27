// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import { GroupMemberLabelInfoModal } from '../../components/GroupMemberLabelInfoModal.dom.tsx';
import { getIntl, getUser, getVersion } from '../selectors/user.std.ts';
import { getGroupMemberLabelInfoModalState } from '../selectors/globalModals.std.ts';
import { getConversationSelector } from '../selectors/conversations.dom.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getItems } from '../selectors/items.dom.ts';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.ts';
import { getCanAddLabel } from '../../types/GroupMemberLabels.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { NavTab } from '../../types/Nav.std.ts';
import { PanelType } from '../../types/Panels.std.ts';
import { getSelectedLocation } from '../selectors/nav.std.ts';
import { getLeafPanelOnly } from '../../components/conversation/conversation-details/GroupMemberLabelEditor.dom.tsx';

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
