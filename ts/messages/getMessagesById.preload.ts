// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { DataReader } from '../sql/Client.preload.js';
import { MessageModel } from '../models/messages.preload.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import * as Errors from '../types/errors.std.js';

const log = createLogger('getMessagesById');

export async function getMessagesById(
  messageIds: Iterable<string>
): Promise<Array<MessageModel>> {
  const messagesFromMemory: Array<MessageModel> = [];
  const messageIdsToLookUpInDatabase: Array<string> = [];

  for (const messageId of messageIds) {
    const message = window.MessageCache.getById(messageId);
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

  const messagesFromDatabase = rawMessagesFromDatabase.map(message => {
    return window.MessageCache.register(new MessageModel(message));
  });

  return [...messagesFromMemory, ...messagesFromDatabase];
}
