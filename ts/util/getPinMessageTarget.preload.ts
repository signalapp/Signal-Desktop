// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { isIncoming } from '../messages/helpers.std.js';
import type { ReadonlyMessageAttributesType } from '../model-types.js';
import { DataReader } from '../sql/Client.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import type { AciString } from '../types/ServiceId.std.js';
import { strictAssert } from './assert.std.js';
import { getMessageSentTimestamp } from './getMessageSentTimestamp.std.js';
import { isAciString } from './isAciString.std.js';

const log = createLogger('getPinMessageTarget');

export type PinnedMessageTarget = Readonly<{
  conversationId: string;
  targetMessageId: string;
  targetAuthorAci: AciString;
  targetSentTimestamp: number;
}>;

function getMessageAuthorAci(
  message: ReadonlyMessageAttributesType
): AciString {
  if (isIncoming(message)) {
    strictAssert(
      isAciString(message.sourceServiceId),
      'Message sourceServiceId must be an ACI'
    );
    return message.sourceServiceId;
  }
  return itemStorage.user.getCheckedAci();
}

export async function getPinnedMessageTarget(
  targetMessageId: string
): Promise<PinnedMessageTarget | null> {
  const message = await DataReader.getMessageById(targetMessageId);
  if (message == null) {
    return null;
  }
  return {
    conversationId: message.conversationId,
    targetMessageId: message.id,
    targetAuthorAci: getMessageAuthorAci(message),
    targetSentTimestamp: getMessageSentTimestamp(message, {
      includeEdits: true,
      log,
    }),
  };
}
