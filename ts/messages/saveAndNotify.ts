// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log';

import { explodePromise } from '../util/explodePromise';

import { saveNewMessageBatcher } from '../util/messageBatcher';
import { handleAttachmentDownloadsForNewMessage } from '../util/queueAttachmentDownloads';
import {
  modifyTargetMessage,
  ModifyTargetMessageResult,
} from '../util/modifyTargetMessage';
import { isStory } from './helpers';
import { drop } from '../util/drop';

import type { ConversationModel } from '../models/conversations';
import type { MessageModel } from '../models/messages';
import { maybeNotify } from './maybeNotify';

const log = createLogger('saveAndNotify');

export async function saveAndNotify(
  message: MessageModel,
  conversation: ConversationModel,
  confirm: () => void
): Promise<void> {
  const { resolve, promise } = explodePromise<void>();
  try {
    conversation.addSavePromise(promise);

    await saveNewMessageBatcher.add(message.attributes);

    log.info('Message saved', message.get('sent_at'));

    // Once the message is saved to DB, we queue attachment downloads
    await handleAttachmentDownloadsForNewMessage(message, conversation);

    // We'd like to check for deletions before scheduling downloads, but if an edit
    //   comes in, we want to have kicked off attachment downloads for the original
    //   message.
    const result = await modifyTargetMessage(message, conversation, {
      isFirstRun: false,
      skipEdits: false,
    });
    if (result === ModifyTargetMessageResult.Deleted) {
      confirm();
      return;
    }

    drop(conversation.onNewMessage(message));

    drop(maybeNotify({ message: message.attributes, conversation }));

    // Increment the sent message count if this is an outgoing message
    if (message.get('type') === 'outgoing') {
      conversation.incrementSentMessageCount();
    }

    window.Whisper.events.trigger('incrementProgress');
    confirm();

    if (!isStory(message.attributes)) {
      conversation.throttledUpdateUnread();
    }
  } finally {
    resolve();
    conversation.removeSavePromise(promise);
  }
}
