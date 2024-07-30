// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { PendingInvites } from '../../components/conversation/conversation-details/PendingInvites';
import { getIntl, getTheme } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationByIdSelector,
  getConversationByServiceIdSelector,
} from '../selectors/conversations';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import { assertDev } from '../../util/assert';
import type { AciString } from '../../types/ServiceId';
import { useConversationsActions } from '../ducks/conversations';

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
