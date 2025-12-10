// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { DataWriter } from '../sql/Client.preload.js';
import type { AciString } from '../types/ServiceId.std.js';
import type { DurationInSeconds } from '../util/durations/duration-in-seconds.std.js';
import { createLogger } from '../logging/log.std.js';
import type { MessageModifierTarget } from './helpers/findMessageModifierTarget.preload.js';
import { findMessageModifierTarget } from './helpers/findMessageModifierTarget.preload.js';
import { isValidSenderAciForConversation } from './helpers/isValidSenderAciForConversation.preload.js';
import { isGroupV2 } from '../util/whatTypeOfConversation.dom.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import { getPinnedMessagesLimit } from '../util/pinnedMessages.dom.js';
import { getPinnedMessageExpiresAt } from '../util/pinnedMessages.std.js';

const { AccessRequired } = Proto.AccessControl;
const { Role } = Proto.Member;

const parentLog = createLogger('PinnedMessages');

export type PinnedMessageAddProps = Readonly<{
  targetSentTimestamp: number;
  targetAuthorAci: AciString;
  pinDuration: DurationInSeconds | null;
  pinnedByAci: AciString;
  receivedAtTimestamp: number;
}>;

export type PinnedMessageRemoveProps = Readonly<{
  targetSentTimestamp: number;
  targetAuthorAci: AciString;
  unpinnedByAci: AciString;
}>;

export async function onPinnedMessageAdd(
  props: PinnedMessageAddProps
): Promise<void> {
  const log = parentLog.child(
    `onPinnedMessageAdd(timestamp=${props.targetSentTimestamp}, aci=${props.targetAuthorAci})`
  );

  const target = await findMessageModifierTarget(
    props.targetSentTimestamp,
    props.targetAuthorAci
  );

  if (target == null) {
    // Could potentially happen with out-of-order processing,
    // or when the targetted message was before we joined a group
    log.warn('Missing target message, dropping');
    return;
  }

  const invalid = validatePinnedMessageTarget(target, props.pinnedByAci);
  if (invalid != null) {
    log.info(`Message is invalid target (error: ${invalid.error}), dropping`);
    return;
  }

  const { targetMessage, targetConversation } = target;

  const expiresAt = getPinnedMessageExpiresAt(
    props.receivedAtTimestamp,
    props.pinDuration
  );

  const pinnedMessagesLimit = getPinnedMessagesLimit();

  const result = await DataWriter.appendPinnedMessage(pinnedMessagesLimit, {
    conversationId: targetConversation.id,
    messageId: targetMessage.id,
    expiresAt,
    pinnedAt: props.receivedAtTimestamp,
  });

  if (result.change == null) {
    log.warn('Skipped pinning message, existing message may have been newer');
  } else if (result.change.replaced != null) {
    log.info(
      `Replaced pinned message ${result.change.replaced} with ${result.change.inserted.id} for target message ${targetMessage.id}`
    );
  } else {
    log.info(
      `Created pinned message ${result.change.inserted.id} for target message ${targetMessage.id}`
    );
  }

  for (const pinnedMessageId of result.truncated) {
    if (pinnedMessageId === result.change?.inserted.id) {
      log.warn(`Pinned message ${pinnedMessageId} was immediately truncated`);
    } else {
      log.info(`Truncated older pinned message ${pinnedMessageId}`);
    }
  }

  window.reduxActions.conversations.onPinnedMessagesChanged(
    targetConversation.id
  );
}

export async function onPinnedMessageRemove(
  props: PinnedMessageRemoveProps
): Promise<void> {
  const log = parentLog.child(
    `onPinnedMessageRemove(timestamp=${props.targetSentTimestamp}, aci=${props.targetAuthorAci})`
  );

  const target = await findMessageModifierTarget(
    props.targetSentTimestamp,
    props.targetAuthorAci
  );

  if (target == null) {
    // Could potentially happen with out-of-order processing,
    // or when the targetted message was before we joined a group
    log.warn('Missing target message, dropping');
    return;
  }

  const invalid = validatePinnedMessageTarget(target, props.unpinnedByAci);
  if (invalid != null) {
    log.warn(`Message is invalid target: ${invalid.error}, dropping`);
    return;
  }

  const targetMessageId = target.targetMessage.id;
  const targetConversationId = target.targetConversation.id;

  const deletedPinnedMessageId =
    await DataWriter.deletePinnedMessageByMessageId(targetMessageId);

  if (deletedPinnedMessageId == null) {
    log.warn(`Target message ${targetMessageId} was not pinned, dropping`);
    return;
  }

  log.info(
    `Deleted pinned message ${deletedPinnedMessageId} for messageId ${targetMessageId}`
  );

  window.reduxActions.conversations.onPinnedMessagesChanged(
    targetConversationId
  );
}

function canSenderEditGroupAttributes(
  conversation: ConversationModel,
  sourceAci: AciString
): boolean {
  if (!isGroupV2(conversation.attributes)) {
    // Just ignore direct conversations
    return true;
  }

  const membersV2 = conversation.get('membersV2') ?? [];
  const member = membersV2.find(m => m.aci === sourceAci);
  if (member == null) {
    return false;
  }

  const accessControl = conversation.get('accessControl');
  if (accessControl == null) {
    return false;
  }

  if (member.role === Role.ADMINISTRATOR) {
    return true;
  }

  return accessControl.attributes === AccessRequired.MEMBER;
}

function validatePinnedMessageTarget(
  target: MessageModifierTarget,
  sourceAci: AciString
): { error: string } | null {
  if (!isValidSenderAciForConversation(target.targetConversation, sourceAci)) {
    return { error: 'Sender cannot send to target conversation' };
  }

  if (!canSenderEditGroupAttributes(target.targetConversation, sourceAci)) {
    return { error: 'Sender does not have access to edit group attributes' };
  }

  return null;
}
