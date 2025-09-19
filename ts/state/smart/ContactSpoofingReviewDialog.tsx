// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { mapValues } from 'lodash';
import type { StateType } from '../reducer.js';
import { ContactSpoofingReviewDialog } from '../../components/conversation/ContactSpoofingReviewDialog.js';
import { useConversationsActions } from '../ducks/conversations.js';
import {
  getConversationSelector,
  getConversationByServiceIdSelector,
  getSafeConversationWithSameTitle,
} from '../selectors/conversations.js';
import { getOwn } from '../../util/getOwn.js';
import { assertDev } from '../../util/assert.js';
import { ContactSpoofingType } from '../../util/contactSpoofing.js';
import { getGroupMemberships } from '../../util/getGroupMemberships.js';
import { isSignalConnection } from '../../util/getSignalConnections.js';
import {
  getCollisionsFromMemberships,
  invertIdsByTitle,
} from '../../util/groupMemberNameCollisions.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import { getIntl, getTheme } from '../selectors/user.js';

export type PropsType = Readonly<{
  conversationId: string;
  onClose: () => void;
}>;

export const SmartContactSpoofingReviewDialog = memo(
  function SmartContactSpoofingReviewDialog(props: PropsType) {
    const { conversationId } = props;

    const getConversation = useSelector(getConversationSelector);

    const {
      acceptConversation,
      reportSpam,
      blockAndReportSpam,
      blockConversation,
      deleteConversation,
      removeMember,
      updateSharedGroups,
    } = useConversationsActions();
    const { showContactModal, toggleSignalConnectionsModal } =
      useGlobalModalActions();
    const getPreferredBadge = useSelector(getPreferredBadgeSelector);
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);
    const getConversationByServiceId = useSelector(
      getConversationByServiceIdSelector
    );
    const conversation = getConversation(conversationId);

    // Just binding the options argument
    const safeConversationSelector = useCallback(
      (state: StateType) => {
        return getSafeConversationWithSameTitle(state, {
          possiblyUnsafeConversation: conversation,
        });
      },
      [conversation]
    );
    const safeConvo = useSelector(safeConversationSelector);

    const sharedProps = {
      ...props,
      acceptConversation,
      reportSpam,
      blockAndReportSpam,
      blockConversation,
      deleteConversation,
      getPreferredBadge,
      i18n,
      removeMember,
      updateSharedGroups,
      showContactModal,
      toggleSignalConnectionsModal,
      theme,
    };

    if (conversation.type === 'group') {
      const { memberships } = getGroupMemberships(
        conversation,
        getConversationByServiceId
      );
      const groupNameCollisions = getCollisionsFromMemberships(memberships);

      const previouslyAcknowledgedTitlesById = invertIdsByTitle(
        conversation.acknowledgedGroupNameCollisions
      );

      const collisionInfoByTitle = mapValues(groupNameCollisions, collisions =>
        collisions.map(collision => ({
          conversation: collision,
          isSignalConnection: isSignalConnection(collision),
          oldName: getOwn(previouslyAcknowledgedTitlesById, collision.id),
        }))
      );

      return (
        <ContactSpoofingReviewDialog
          {...sharedProps}
          type={ContactSpoofingType.MultipleGroupMembersWithSameTitle}
          group={conversation}
          collisionInfoByTitle={collisionInfoByTitle}
        />
      );
    }

    const possiblyUnsafeConvo = conversation;
    assertDev(
      possiblyUnsafeConvo.type === 'direct',
      'DirectConversationWithSameTitle: expects possibly unsafe direct ' +
        'conversation'
    );

    if (!safeConvo) {
      return null;
    }

    const possiblyUnsafe = {
      conversation: possiblyUnsafeConvo,
      isSignalConnection: isSignalConnection(possiblyUnsafeConvo),
    };
    const safe = {
      conversation: safeConvo,
      isSignalConnection: isSignalConnection(safeConvo),
    };

    return (
      <ContactSpoofingReviewDialog
        {...sharedProps}
        type={ContactSpoofingType.DirectConversationWithSameTitle}
        possiblyUnsafe={possiblyUnsafe}
        safe={safe}
      />
    );
  }
);
