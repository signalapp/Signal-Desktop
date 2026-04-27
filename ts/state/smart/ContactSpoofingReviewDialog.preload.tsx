// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector, useStore } from 'react-redux';
import lodash from 'lodash';
import type { StateType } from '../reducer.preload.ts';
import { ContactSpoofingReviewDialog } from '../../components/conversation/ContactSpoofingReviewDialog.dom.tsx';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import {
  getConversationSelector,
  getConversationByServiceIdSelector,
  getSafeConversationWithSameTitle,
} from '../selectors/conversations.dom.ts';
import { getSharedGroupNames } from '../../util/sharedGroupNames.dom.ts';
import { getOwn } from '../../util/getOwn.std.ts';
import { assertDev } from '../../util/assert.std.ts';
import { ContactSpoofingType } from '../../util/contactSpoofing.std.ts';
import { getGroupMemberships } from '../../util/getGroupMemberships.dom.ts';
import { isSignalConnection } from '../../util/getSignalConnections.preload.ts';
import {
  getCollisionsFromMemberships,
  invertIdsByTitle,
} from '../../util/groupMemberNameCollisions.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { getIntl, getTheme } from '../selectors/user.std.ts';

const { mapValues } = lodash;

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

    const store = useStore<StateType>();
    const getSharedGroupNamesForId = useCallback(
      (convId: string) => {
        return getSharedGroupNames(store.getState(), convId);
      },
      [store]
    );

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
          sharedGroupNames: getSharedGroupNamesForId(collision.id),
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
      sharedGroupNames: getSharedGroupNamesForId(possiblyUnsafeConvo.id),
    };
    const safe = {
      conversation: safeConvo,
      isSignalConnection: isSignalConnection(safeConvo),
      sharedGroupNames: getSharedGroupNamesForId(safeConvo.id),
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
