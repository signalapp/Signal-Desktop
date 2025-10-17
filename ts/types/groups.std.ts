// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString, AciString, PniString } from './ServiceId.std.js';

export const ID_V1_LENGTH = 16;
export const ID_LENGTH = 32;

type GroupV2AccessCreateChangeType = {
  type: 'create';
};
type GroupV2AccessAttributesChangeType = {
  type: 'access-attributes';
  newPrivilege: number;
};
type GroupV2AccessMembersChangeType = {
  type: 'access-members';
  newPrivilege: number;
};
type GroupV2AccessInviteLinkChangeType = {
  type: 'access-invite-link';
  newPrivilege: number;
};
type GroupV2AnnouncementsOnlyChangeType = {
  type: 'announcements-only';
  announcementsOnly: boolean;
};
type GroupV2AvatarChangeType = {
  type: 'avatar';
  removed: boolean;
};
type GroupV2TitleChangeType = {
  type: 'title';
  // Allow for null, because the title could be removed entirely
  newTitle?: string;
};
type GroupV2GroupLinkAddChangeType = {
  type: 'group-link-add';
  privilege: number;
};
type GroupV2GroupLinkResetChangeType = {
  type: 'group-link-reset';
};
type GroupV2GroupLinkRemoveChangeType = {
  type: 'group-link-remove';
};

// No disappearing messages timer change type - message.expirationTimerUpdate used instead

type GroupV2MemberAddChangeType = {
  type: 'member-add';
  aci: AciString;
};
type GroupV2MemberAddFromInviteChangeType = {
  type: 'member-add-from-invite';
  aci: AciString;
  pni?: PniString;
  inviter?: AciString;
};
type GroupV2MemberAddFromLinkChangeType = {
  type: 'member-add-from-link';
  aci: AciString;
};
type GroupV2MemberAddFromAdminApprovalChangeType = {
  type: 'member-add-from-admin-approval';
  aci: AciString;
};
type GroupV2MemberPrivilegeChangeType = {
  type: 'member-privilege';
  aci: AciString;
  newPrivilege: number;
};
type GroupV2MemberRemoveChangeType = {
  type: 'member-remove';
  aci: AciString;
};

type GroupV2PendingAddOneChangeType = {
  type: 'pending-add-one';
  serviceId: ServiceIdString;
};
type GroupV2PendingAddManyChangeType = {
  type: 'pending-add-many';
  count: number;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
type GroupV2PendingRemoveOneChangeType = {
  type: 'pending-remove-one';
  serviceId?: ServiceIdString;
  inviter?: AciString;
};
// Note: pending-remove is only used if user didn't also join the group at the same time
type GroupV2PendingRemoveManyChangeType = {
  type: 'pending-remove-many';
  count: number;
  inviter?: AciString;
};

type GroupV2AdminApprovalAddOneChangeType = {
  type: 'admin-approval-add-one';
  aci: AciString;
};
// Note: admin-approval-remove-one is only used if user didn't also join the group at
//   the same time
type GroupV2AdminApprovalRemoveOneChangeType = {
  type: 'admin-approval-remove-one';
  aci: AciString;
  inviter?: AciString;
};
type GroupV2AdminApprovalBounceChangeType = {
  type: 'admin-approval-bounce';
  times: number;
  isApprovalPending: boolean;
  aci: AciString;
};
export type GroupV2DescriptionChangeType = {
  type: 'description';
  removed?: boolean;
  // Adding this field; cannot remove previous field for backwards compatibility
  description?: string;
};
export type GroupV2SummaryType = {
  type: 'summary';
};

export type GroupV2ChangeDetailType =
  | GroupV2AccessAttributesChangeType
  | GroupV2AccessCreateChangeType
  | GroupV2AccessInviteLinkChangeType
  | GroupV2AccessMembersChangeType
  | GroupV2AdminApprovalAddOneChangeType
  | GroupV2AdminApprovalRemoveOneChangeType
  | GroupV2AdminApprovalBounceChangeType
  | GroupV2AnnouncementsOnlyChangeType
  | GroupV2AvatarChangeType
  | GroupV2DescriptionChangeType
  | GroupV2GroupLinkAddChangeType
  | GroupV2GroupLinkRemoveChangeType
  | GroupV2GroupLinkResetChangeType
  | GroupV2MemberAddChangeType
  | GroupV2MemberAddFromAdminApprovalChangeType
  | GroupV2MemberAddFromInviteChangeType
  | GroupV2MemberAddFromLinkChangeType
  | GroupV2MemberPrivilegeChangeType
  | GroupV2MemberRemoveChangeType
  | GroupV2PendingAddManyChangeType
  | GroupV2PendingAddOneChangeType
  | GroupV2PendingRemoveManyChangeType
  | GroupV2PendingRemoveOneChangeType
  | GroupV2SummaryType
  | GroupV2TitleChangeType;

export type GroupV2ChangeType = {
  from?: ServiceIdString;
  details: ReadonlyArray<GroupV2ChangeDetailType>;
};
