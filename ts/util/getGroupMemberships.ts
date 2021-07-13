// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { GroupV2Membership } from '../components/conversation/conversation-details/ConversationDetailsMembershipList';
import {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
} from '../components/conversation/conversation-details/PendingInvites';
import { ConversationType } from '../state/ducks/conversations';
import { isConversationUnregistered } from './isConversationUnregistered';

export const getGroupMemberships = (
  {
    memberships = [],
    pendingApprovalMemberships = [],
    pendingMemberships = [],
  }: Readonly<
    Pick<
      ConversationType,
      'memberships' | 'pendingApprovalMemberships' | 'pendingMemberships'
    >
  >,
  getConversationById: (conversationId: string) => undefined | ConversationType
): {
  memberships: Array<GroupV2Membership>;
  pendingApprovalMemberships: Array<GroupV2RequestingMembership>;
  pendingMemberships: Array<GroupV2PendingMembership>;
} => ({
  memberships: memberships.reduce(
    (result: Array<GroupV2Membership>, membership) => {
      const member = getConversationById(membership.conversationId);
      if (!member || isConversationUnregistered(member)) {
        return result;
      }
      return [...result, { isAdmin: membership.isAdmin, member }];
    },
    []
  ),
  pendingApprovalMemberships: pendingApprovalMemberships.reduce(
    (result: Array<GroupV2RequestingMembership>, membership) => {
      const member = getConversationById(membership.conversationId);
      if (!member || isConversationUnregistered(member)) {
        return result;
      }
      return [...result, { member }];
    },
    []
  ),
  pendingMemberships: pendingMemberships.reduce(
    (result: Array<GroupV2PendingMembership>, membership) => {
      const member = getConversationById(membership.conversationId);
      if (!member || isConversationUnregistered(member)) {
        return result;
      }
      return [
        ...result,
        {
          member,
          metadata: { addedByUserId: membership.addedByUserId },
        },
      ];
    },
    []
  ),
});
