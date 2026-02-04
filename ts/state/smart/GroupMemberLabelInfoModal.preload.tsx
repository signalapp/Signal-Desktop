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
import { createLogger } from '../../logging/log.std.js';

const log = createLogger('SmartGroupMemberLabelInfoModal');

export const SmartGroupMemberLabelInfoModal = memo(
  function SmartGroupMemberLabelInfoModal() {
    const i18n = useSelector(getIntl);
    const user = useSelector(getUser);
    const version = useSelector(getVersion);
    const items = useSelector(getItems);
    const { conversationId } =
      useSelector(getGroupMemberLabelInfoModalState) ?? {};
    const getConversation = useSelector(getConversationSelector);

    const isEditMemberLabelEnabled = isFeaturedEnabledSelector({
      betaKey: 'desktop.groupMemberLabels.edit.beta',
      currentVersion: version,
      remoteConfig: items.remoteConfig,
      prodKey: 'desktop.groupMemberLabels.edit.prod',
    });
    // TODO: DESKTOP-9711
    log.info(
      `Not using feature flag of ${isEditMemberLabelEnabled}; hardcoding to false`
    );

    const conversation = getConversation(conversationId);

    const contactMembership = conversation.memberships?.find(
      membership => user.ourAci && membership.aci === user.ourAci
    );
    const hasLabel = Boolean(contactMembership?.labelString);
    const canAddLabel = getCanAddLabel(conversation, contactMembership);

    const { toggleGroupMemberLabelInfoModal } = useGlobalModalActions();

    return (
      <GroupMemberLabelInfoModal
        i18n={i18n}
        canAddLabel={canAddLabel}
        hasLabel={hasLabel}
        isEditMemberLabelEnabled={false}
        onClose={() => toggleGroupMemberLabelInfoModal(undefined)}
        showEditMemberLabelScreen={() => {
          // TODO: DESKTOP-9711
          throw new Error('Not yet implemented');
        }}
      />
    );
  }
);
