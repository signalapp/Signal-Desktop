// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// eslint-disable-next-line import/no-restricted-paths
import type { GroupV2Membership } from '../components/conversation/conversation-details/ConversationDetailsMembershipList.dom.js';
import type {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
  // eslint-disable-next-line import/no-restricted-paths
} from '../components/conversation/conversation-details/PendingInvites.dom.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { isConversationUnregistered } from './isConversationUnregistered.dom.js';

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
  getConversationByServiceId: (
    serviceId: ServiceIdString
  ) => undefined | ConversationType
): GroupMemberships => ({
  memberships: memberships.reduce(
    (result: ReadonlyArray<GroupV2Membership>, membership) => {
      const member = getConversationByServiceId(membership.aci);
      if (!member) {
        return result;
      }
      return [...result, { isAdmin: membership.isAdmin, member }];
    },
    []
  ),
  pendingApprovalMemberships: pendingApprovalMemberships.reduce(
    (result: ReadonlyArray<GroupV2RequestingMembership>, membership) => {
      const member = getConversationByServiceId(membership.aci);
      if (!member || isConversationUnregistered(member)) {
        return result;
      }
      return [...result, { member }];
    },
    []
  ),
  pendingMemberships: pendingMemberships.reduce(
    (result: ReadonlyArray<GroupV2PendingMembership>, membership) => {
      const member = getConversationByServiceId(membership.serviceId);
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
