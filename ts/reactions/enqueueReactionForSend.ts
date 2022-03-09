// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ReactionModel } from '../messageModifiers/Reactions';
import { ReactionSource } from './ReactionSource';
import { getMessageById } from '../messages/getMessageById';
import { getSourceUuid } from '../messages/helpers';
import { strictAssert } from '../util/assert';

export async function enqueueReactionForSend({
  emoji,
  messageId,
  remove,
}: Readonly<{
  emoji: string;
  messageId: string;
  remove: boolean;
}>): Promise<void> {
  const message = await getMessageById(messageId);
  strictAssert(message, 'enqueueReactionForSend: no message found');

  const targetAuthorUuid = getSourceUuid(message.attributes);
  strictAssert(
    targetAuthorUuid,
    `enqueueReactionForSend: message ${message.idForLogging()} had no source UUID`
  );

  const targetTimestamp = message.get('sent_at') || message.get('timestamp');
  strictAssert(
    targetTimestamp,
    `enqueueReactionForSend: message ${message.idForLogging()} had no timestamp`
  );

  const reaction = new ReactionModel({
    emoji,
    remove,
    targetAuthorUuid,
    targetTimestamp,
    fromId: window.ConversationController.getOurConversationIdOrThrow(),
    timestamp: Date.now(),
    source: ReactionSource.FromThisDevice,
  });

  await message.handleReaction(reaction);
}
