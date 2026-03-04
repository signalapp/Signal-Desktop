// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString, ServiceIdString } from '../types/ServiceId.std.js';
import type {
  ConversationAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.js';
import { getMessageAge } from './getMessageAge.std.js';
import {
  getAdminDeleteMaxAgeMs,
  getNormalDeleteMaxAgeMs,
} from './getDeleteMaxAgeMs.dom.js';
import { DAY } from './durations/index.std.js';
import { isGroupV2, isMe } from './whatTypeOfConversation.dom.js';
import { isSignalConversation } from './isSignalConversation.dom.js';
import { getSourceServiceId } from '../messages/sources.preload.js';
import { SignalService as Proto } from '../protobuf/index.std.js';

export type DeleteForEveryoneMessage = Pick<
  ReadonlyMessageAttributesType,
  | 'type'
  | 'sourceServiceId'
  | 'sent_at'
  | 'serverTimestamp'
  | 'deletedForEveryone'
  | 'sms'
>;

export type DeleteForEveryoneConversation = Pick<
  ConversationAttributesType,
  'id' | 'e164' | 'serviceId' | 'groupId' | 'groupVersion'
>;

type Result<T extends object = Record<never, never>> =
  | Readonly<{ ok: true } & T>
  | Readonly<{ ok: false; reason: string }>;

function checkCommon(
  targetConversation: DeleteForEveryoneConversation,
  targetMessage: DeleteForEveryoneMessage,
  options?: { allowAlreadyDeleted?: boolean }
): Result {
  if (isSignalConversation(targetConversation)) {
    return { ok: false, reason: 'signal conversation' };
  }
  if (isMe(targetConversation)) {
    return { ok: false, reason: 'note to self conversation' };
  }
  if (!options?.allowAlreadyDeleted && targetMessage.deletedForEveryone) {
    return { ok: false, reason: 'already deleted' };
  }
  if (targetMessage.sms) {
    return { ok: false, reason: 'sms message' };
  }
  return { ok: true };
}

function canUseNormalDelete(options: {
  deleterAci: AciString;
  messageAuthorAci: ServiceIdString | undefined;
  messageAge: number;
  gracePeriodMs?: number;
}): Result {
  const {
    deleterAci,
    messageAuthorAci,
    messageAge,
    gracePeriodMs = 0,
  } = options;
  if (deleterAci !== messageAuthorAci) {
    return { ok: false, reason: 'not message author' };
  }
  if (messageAge > getNormalDeleteMaxAgeMs() + gracePeriodMs) {
    return { ok: false, reason: 'message is too old' };
  }
  return { ok: true };
}

function isMemberGroupAdmin(
  conversation: Pick<ConversationAttributesType, 'membersV2'>,
  aci: AciString
): boolean {
  const members = conversation.membersV2 ?? [];
  const member = members.find(m => m.aci === aci);
  return member?.role === Proto.Member.Role.ADMINISTRATOR;
}

function canUseAdminDelete(options: {
  targetConversation: DeleteForEveryoneConversation;
  isDeleterGroupAdmin: boolean;
  messageAge: number;
  gracePeriodMs?: number;
}): Result {
  const {
    targetConversation,
    isDeleterGroupAdmin,
    messageAge,
    gracePeriodMs = 0,
  } = options;
  if (!isGroupV2(targetConversation)) {
    return { ok: false, reason: 'not a group conversation' };
  }
  if (!isDeleterGroupAdmin) {
    return { ok: false, reason: 'does not have admin role' };
  }
  if (messageAge > getAdminDeleteMaxAgeMs() + gracePeriodMs) {
    return { ok: false, reason: 'message is too old' };
  }
  return { ok: true };
}

export type CanDeleteForEveryoneOptions = Readonly<{
  targetMessage: DeleteForEveryoneMessage;
  targetConversation: DeleteForEveryoneConversation;
  ourAci: AciString;
  isDeleterGroupAdmin: boolean;
}>;

export type CanDeleteForEveryoneResult = Result<{
  needsAdminDelete: boolean;
}>;

export function canSendDeleteForEveryone(
  options: CanDeleteForEveryoneOptions
): CanDeleteForEveryoneResult {
  const { targetConversation, targetMessage, ourAci, isDeleterGroupAdmin } =
    options;

  const commonCheck = checkCommon(targetConversation, targetMessage);
  if (!commonCheck.ok) {
    return commonCheck;
  }

  const messageAuthorAci = getSourceServiceId(targetMessage);
  const messageAge = getMessageAge(Date.now(), targetMessage);

  // Prefer normal delete for own messages
  const normalCheck = canUseNormalDelete({
    deleterAci: ourAci,
    messageAuthorAci,
    messageAge,
  });
  if (normalCheck.ok) {
    return { ok: true, needsAdminDelete: false };
  }

  // Admin delete for group messages
  const adminCheck = canUseAdminDelete({
    targetConversation,
    isDeleterGroupAdmin,
    messageAge,
  });
  if (adminCheck.ok) {
    return { ok: true, needsAdminDelete: true };
  }

  return { ok: false, reason: 'no permission' };
}

export type CanRetrySendDeleteForEveryoneOptions = Readonly<{
  targetMessage: DeleteForEveryoneMessage &
    Pick<ReadonlyMessageAttributesType, 'deletedForEveryoneFailed'>;
  targetConversation: DeleteForEveryoneConversation;
  isAdminDelete: boolean;
  isDeleterGroupAdmin: boolean;
  ourAci: AciString;
}>;

export type CanRetrySendDeleteForEveryoneResult = Result;

export function canRetrySendDeleteForEveryone(
  options: CanRetrySendDeleteForEveryoneOptions
): CanRetrySendDeleteForEveryoneResult {
  const {
    targetMessage,
    targetConversation,
    isAdminDelete,
    isDeleterGroupAdmin,
    ourAci,
  } = options;

  if (
    !targetMessage.deletedForEveryone ||
    !targetMessage.deletedForEveryoneFailed
  ) {
    return { ok: false, reason: 'not a failed delete' };
  }

  const commonCheck = checkCommon(targetConversation, targetMessage, {
    allowAlreadyDeleted: true,
  });
  if (!commonCheck.ok) {
    return commonCheck;
  }

  const messageAuthorAci = getSourceServiceId(targetMessage);
  const messageAge = getMessageAge(Date.now(), targetMessage);

  if (!isAdminDelete) {
    return canUseNormalDelete({
      deleterAci: ourAci,
      messageAuthorAci,
      messageAge,
    });
  }

  return canUseAdminDelete({
    targetConversation,
    isDeleterGroupAdmin,
    messageAge,
  });
}

export type CanReceiveDeleteForEveryoneOptions = Readonly<{
  targetMessage: DeleteForEveryoneMessage;
  targetConversation: ConversationAttributesType;
  isAdminDelete: boolean;
  deleteServerTimestamp: number;
  deleteSentByAci: AciString;
}>;

export type CanReceiveForEveryoneResult = Result;

const MESSAGE_SEND_GRACE_PERIOD = DAY;

export function canReceiveDeleteForEveryone(
  options: CanReceiveDeleteForEveryoneOptions
): CanReceiveForEveryoneResult {
  const {
    targetMessage,
    targetConversation,
    isAdminDelete,
    deleteServerTimestamp,
    deleteSentByAci,
  } = options;

  const commonCheck = checkCommon(targetConversation, targetMessage);
  if (!commonCheck.ok) {
    return commonCheck;
  }

  const messageAuthorAci = getSourceServiceId(targetMessage);
  const messageAge = getMessageAge(deleteServerTimestamp, targetMessage);

  if (!isAdminDelete) {
    return canUseNormalDelete({
      deleterAci: deleteSentByAci,
      messageAuthorAci,
      messageAge,
      gracePeriodMs: MESSAGE_SEND_GRACE_PERIOD,
    });
  }

  const isDeleterGroupAdmin = isMemberGroupAdmin(
    targetConversation,
    deleteSentByAci
  );

  return canUseAdminDelete({
    targetConversation,
    isDeleterGroupAdmin,
    messageAge,
    gracePeriodMs: MESSAGE_SEND_GRACE_PERIOD,
  });
}
