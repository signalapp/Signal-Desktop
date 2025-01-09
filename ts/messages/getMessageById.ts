// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { DataReader } from '../sql/Client';
import { MessageModel } from '../models/messages';
import type { MessageAttributesType } from '../model-types.d';

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
