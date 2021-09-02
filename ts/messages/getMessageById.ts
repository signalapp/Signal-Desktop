// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import type { MessageModel } from '../models/messages';
import * as Errors from '../types/errors';

export async function getMessageById(
  messageId: string
): Promise<MessageModel | undefined> {
  let message = window.MessageController.getById(messageId);
  if (message) {
    return message;
  }

  try {
    message = await window.Signal.Data.getMessageById(messageId, {
      Message: window.Whisper.Message,
    });
  } catch (err: unknown) {
    log.error(
      `failed to load message with id ${messageId} ` +
        `due to error ${Errors.toLogFormat(err)}`
    );
  }

  if (!message) {
    return undefined;
  }

  message = window.MessageController.register(message.id, message);
  return message;
}
