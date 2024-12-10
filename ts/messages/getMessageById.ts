// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { DataReader } from '../sql/Client';
import type { MessageAttributesType } from '../model-types.d';
import * as Errors from '../types/errors';
import type { MessageModel } from '../models/messages';

export async function __DEPRECATED$getMessageById(
  messageId: string,
  location: string
): Promise<MessageModel | undefined> {
  const innerLocation = `__DEPRECATED$getMessageById/${location}`;
  const message = window.MessageCache.__DEPRECATED$getById(
    messageId,
    innerLocation
  );
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

  return window.MessageCache.__DEPRECATED$register(
    found.id,
    found,
    innerLocation
  );
}
