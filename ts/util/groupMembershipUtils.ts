// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import isNumber from 'lodash/isNumber.js';
import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ServiceIdString, AciString } from '../types/ServiceId.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import {
  isDirectConversation,
  isGroupV2,
} from './whatTypeOfConversation.dom.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export function isMemberPending(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingMembersV2'
  >,
  serviceId: ServiceIdString
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingMembersV2 } = conversationAttrs;

  if (!pendingMembersV2 || !pendingMembersV2.length) {
    return false;
  }

  return pendingMembersV2.some(item => item.serviceId === serviceId);
}

export function isMemberBanned(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'bannedMembersV2'
  >,
  serviceId: ServiceIdString
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { bannedMembersV2 } = conversationAttrs;

  if (!bannedMembersV2 || !bannedMembersV2.length) {
    return false;
  }

  return bannedMembersV2.some(member => member.serviceId === serviceId);
}

export function isMemberAwaitingApproval(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingAdminApprovalV2'
  >,
  serviceId: ServiceIdString
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingAdminApprovalV2 } = conversationAttrs;

  if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
    return false;
  }

  return pendingAdminApprovalV2.some(member => member.aci === serviceId);
}

export function isMember(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'membersV2'
  >,
  serviceId: ServiceIdString
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { membersV2 } = conversationAttrs;

  if (!membersV2 || !membersV2.length) {
    return false;
  }

  return membersV2.some(item => item.aci === serviceId);
}

export function isMemberRequestingToJoin(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingAdminApprovalV2'
  >,
  serviceId: ServiceIdString
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingAdminApprovalV2 } = conversationAttrs;

  if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
    return false;
  }

  return pendingAdminApprovalV2.some(item => item.aci === serviceId);
}

const EMPTY_ARRAY: Readonly<[]> = [];

export function getBannedMemberships(
  conversationAttrs: ConversationAttributesType
): ReadonlyArray<ServiceIdString> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const { bannedMembersV2 } = conversationAttrs;

  return (bannedMembersV2 || []).map(member => member.serviceId);
}

export function getPendingMemberships(
  conversationAttrs: ConversationAttributesType
): ReadonlyArray<{
  addedByUserId?: AciString;
  serviceId: ServiceIdString;
}> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const members = conversationAttrs.pendingMembersV2 || [];
  return members.map(member => ({
    addedByUserId: member.addedByUserId,
    serviceId: member.serviceId,
  }));
}

export function getPendingApprovalMemberships(
  conversationAttrs: ConversationAttributesType
): ReadonlyArray<{ aci: AciString }> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const members = conversationAttrs.pendingAdminApprovalV2 || [];
  return members.map(member => ({
    aci: member.aci,
  }));
}

export function getMembersCount(
  conversationAttrs: ConversationAttributesType
): number | undefined {
  if (isDirectConversation(conversationAttrs)) {
    return undefined;
  }

  const memberList = conversationAttrs.membersV2 || conversationAttrs.members;

  // We'll fail over if the member list is empty
  if (memberList && memberList.length) {
    return memberList.length;
  }

  const { temporaryMemberCount } = conversationAttrs;
  if (isNumber(temporaryMemberCount)) {
    return temporaryMemberCount;
  }

  return undefined;
}

export function getMemberships(
  conversationAttrs: ConversationAttributesType
): ReadonlyArray<{
  aci: AciString;
  isAdmin: boolean;
}> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const members = conversationAttrs.membersV2 || [];
  return members.map(member => ({
    isAdmin: member.role === Proto.Member.Role.ADMINISTRATOR,
    aci: member.aci,
  }));
}

export function areWePending(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingMembersV2'
  >
): boolean {
  const ourAci = itemStorage.user.getAci();
  const ourPni = itemStorage.user.getPni();
  return Boolean(
    ourAci &&
      (isMemberPending(conversationAttrs, ourAci) ||
        Boolean(
          ourPni &&
            !isMember(conversationAttrs, ourAci) &&
            isMemberPending(conversationAttrs, ourPni)
        ))
  );
}
