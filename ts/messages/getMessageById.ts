// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.js';
import * as Errors from '../types/errors.js';
import { DataReader } from '../sql/Client.js';
import { MessageModel } from '../models/messages.js';
import type { MessageAttributesType } from '../model-types.d.ts';

const log = createLogger('getMessageById');

export async function getMessageById(
  messageId: string
): Promise<MessageModel | undefined> {
  const message = window.MessageCache.getById(messageId);
  if (message) {
    return message;
  }

  let found: MessageAttributesType | undefined;
  try {
    found = await DataReader.getMessageById(messageId);
  } catch (err: unknown) {
    log.error(
      `failed to load message with id ${messageId} ` +
        `due to error ${Errors.toLogFormat(err)}`
    );
  }

  if (!found) {
    return undefined;
  }

  return window.MessageCache.register(new MessageModel(found));
}
