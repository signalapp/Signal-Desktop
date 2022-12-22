// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { GroupV2Membership } from '../components/conversation/conversation-details/ConversationDetailsMembershipList';
import type {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
} from '../components/conversation/conversation-details/PendingInvites';
import type { ConversationType } from '../state/ducks/conversations';
import type { UUIDStringType } from '../types/UUID';
import { isConversationUnregistered } from './isConversationUnregistered';

export type GroupMemberships = {
  memberships: ReadonlyArray<GroupV2Membership>;
  pendingApprovalMemberships: ReadonlyArray<GroupV2RequestingMembership>;
  pendingMemberships: ReadonlyArray<GroupV2PendingMembership>;
};

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
  getConversationByUuid: (uuid: UUIDStringType) => undefined | ConversationType
): GroupMemberships => ({
  memberships: memberships.reduce(
    (result: ReadonlyArray<GroupV2Membership>, membership) => {
      const member = getConversationByUuid(membership.uuid);
      if (!member) {
        return result;
      }
      return [...result, { isAdmin: membership.isAdmin, member }];
    },
    []
  ),
  pendingApprovalMemberships: pendingApprovalMemberships.reduce(
    (result: ReadonlyArray<GroupV2RequestingMembership>, membership) => {
      const member = getConversationByUuid(membership.uuid);
      if (!member || isConversationUnregistered(member)) {
        return result;
      }
      return [...result, { member }];
    },
    []
  ),
  pendingMemberships: pendingMemberships.reduce(
    (result: ReadonlyArray<GroupV2PendingMembership>, membership) => {
      const member = getConversationByUuid(membership.uuid);
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
