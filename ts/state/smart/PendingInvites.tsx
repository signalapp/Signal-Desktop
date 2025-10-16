// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { PendingInvites } from '../../components/conversation/conversation-details/PendingInvites.dom.js';
import { getIntl, getTheme } from '../selectors/user.std.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import {
  getConversationByIdSelector,
  getConversationByServiceIdSelector,
} from '../selectors/conversations.dom.js';
import { getGroupMemberships } from '../../util/getGroupMemberships.dom.js';
import { assertDev } from '../../util/assert.std.js';
import type { AciString } from '../../types/ServiceId.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';

export type SmartPendingInvitesProps = {
  conversationId: string;
  ourAci: AciString;
};

export const SmartPendingInvites = memo(function SmartPendingInvites({
  conversationId,
  ourAci,
}: SmartPendingInvitesProps) {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const conversationSelector = useSelector(getConversationByIdSelector);
  const conversationByServiceIdSelector = useSelector(
    getConversationByServiceIdSelector
  );
  const conversation = conversationSelector(conversationId);
  assertDev(
    conversation,
    '<SmartPendingInvites> expected a conversation to be found'
  );
  const groupMemberships = getGroupMemberships(
    conversation,
    conversationByServiceIdSelector
  );
  const {
    approvePendingMembershipFromGroupV2,
    revokePendingMembershipsFromGroupV2,
  } = useConversationsActions();
  return (
    <PendingInvites
      i18n={i18n}
      theme={theme}
      getPreferredBadge={getPreferredBadge}
      conversation={conversation}
      ourAci={ourAci}
      pendingMemberships={groupMemberships.pendingMemberships}
      pendingApprovalMemberships={groupMemberships.pendingApprovalMemberships}
      approvePendingMembershipFromGroupV2={approvePendingMembershipFromGroupV2}
      revokePendingMembershipsFromGroupV2={revokePendingMembershipsFromGroupV2}
    />
  );
});
