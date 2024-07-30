// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { DataReader } from '../sql/Client';
import type { MessageModel } from '../models/messages';
import type { MessageAttributesType } from '../model-types.d';
import * as Errors from '../types/errors';

export async function getMessagesById(
  messageIds: Iterable<string>
): Promise<Array<MessageModel>> {
  const messagesFromMemory: Array<MessageModel> = [];
  const messageIdsToLookUpInDatabase: Array<string> = [];

  for (const messageId of messageIds) {
    const message = window.MessageCache.__DEPRECATED$getById(messageId);
    if (message) {
      messagesFromMemory.push(message);
    } else {
      messageIdsToLookUpInDatabase.push(messageId);
    }
  }

  let rawMessagesFromDatabase: Array<MessageAttributesType>;
  try {
    rawMessagesFromDatabase = await DataReader.getMessagesById(
      messageIdsToLookUpInDatabase
    );
  } catch (err: unknown) {
    log.error(
      `failed to load ${
        messageIdsToLookUpInDatabase.length
      } message(s) from database. ${Errors.toLogFormat(err)}`
    );
    return [];
  }

  const messagesFromDatabase = rawMessagesFromDatabase.map(rawMessage => {
    // We use `window.Whisper.Message` instead of `MessageModel` here to avoid a circular
    //   import.
    const message = new window.Whisper.Message(rawMessage);
    return window.MessageCache.__DEPRECATED$register(
      message.id,
      message,
      'getMessagesById'
    );
  });

  return [...messagesFromMemory, ...messagesFromDatabase];
}
