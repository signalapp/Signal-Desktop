// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import isNumber from 'lodash/isNumber';
import type { ConversationAttributesType } from '../model-types.d';
import type { UUID, UUIDStringType } from '../types/UUID';
import { SignalService as Proto } from '../protobuf';
import { isDirectConversation, isGroupV2 } from './whatTypeOfConversation';

export function isMemberPending(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingMembersV2'
  >,
  uuid: UUID
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingMembersV2 } = conversationAttrs;

  if (!pendingMembersV2 || !pendingMembersV2.length) {
    return false;
  }

  return pendingMembersV2.some(item => item.uuid === uuid.toString());
}

export function isMemberBanned(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'bannedMembersV2'
  >,
  uuid: UUID
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { bannedMembersV2 } = conversationAttrs;

  if (!bannedMembersV2 || !bannedMembersV2.length) {
    return false;
  }

  return bannedMembersV2.some(member => member.uuid === uuid.toString());
}

export function isMemberAwaitingApproval(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingAdminApprovalV2'
  >,
  uuid: UUID
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingAdminApprovalV2 } = conversationAttrs;

  if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
    return false;
  }

  return pendingAdminApprovalV2.some(member => member.uuid === uuid.toString());
}

export function isMember(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'membersV2'
  >,
  uuid: UUID
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { membersV2 } = conversationAttrs;

  if (!membersV2 || !membersV2.length) {
    return false;
  }

  return membersV2.some(item => item.uuid === uuid.toString());
}

export function isMemberRequestingToJoin(
  conversationAttrs: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'pendingAdminApprovalV2'
  >,
  uuid: UUID
): boolean {
  if (!isGroupV2(conversationAttrs)) {
    return false;
  }
  const { pendingAdminApprovalV2 } = conversationAttrs;

  if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
    return false;
  }

  return pendingAdminApprovalV2.some(item => item.uuid === uuid.toString());
}

const EMPTY_ARRAY: Readonly<[]> = [];

export function getBannedMemberships(
  conversationAttrs: ConversationAttributesType
): ReadonlyArray<UUIDStringType> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const { bannedMembersV2 } = conversationAttrs;

  return (bannedMembersV2 || []).map(member => member.uuid);
}

export function getPendingMemberships(
  conversationAttrs: ConversationAttributesType
): ReadonlyArray<{
  addedByUserId?: UUIDStringType;
  uuid: UUIDStringType;
}> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const members = conversationAttrs.pendingMembersV2 || [];
  return members.map(member => ({
    addedByUserId: member.addedByUserId,
    uuid: member.uuid,
  }));
}

export function getPendingApprovalMemberships(
  conversationAttrs: ConversationAttributesType
): ReadonlyArray<{ uuid: UUIDStringType }> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const members = conversationAttrs.pendingAdminApprovalV2 || [];
  return members.map(member => ({
    uuid: member.uuid,
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
  uuid: UUIDStringType;
  isAdmin: boolean;
}> {
  if (!isGroupV2(conversationAttrs)) {
    return EMPTY_ARRAY;
  }

  const members = conversationAttrs.membersV2 || [];
  return members.map(member => ({
    isAdmin: member.role === Proto.Member.Role.ADMINISTRATOR,
    uuid: member.uuid,
  }));
}
