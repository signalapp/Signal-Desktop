// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageModel } from '../models/messages';
import * as log from '../logging/log';
import { DataWriter } from '../sql/Client';
import { isMoreRecentThan } from './timestamp';
import { isNotNil } from './isNotNil';

const MAX_ATTACHMENT_DOWNLOAD_AGE = 3600 * 72 * 1000;
const MAX_ATTACHMENT_MSGS_TO_DOWNLOAD = 250;

let isEnabled = true;
let attachmentDownloadQueue: Array<string> | undefined = [];
const queueEmptyCallbacks: Set<() => void> = new Set();

export function shouldUseAttachmentDownloadQueue(): boolean {
  return isEnabled;
}

export function isAttachmentDownloadQueueEmpty(): boolean {
  return !(attachmentDownloadQueue ?? []).length;
}

export function registerQueueEmptyCallback(callback: () => void): void {
  queueEmptyCallbacks.add(callback);
}

function onQueueEmpty() {
  queueEmptyCallbacks.forEach(callback => callback());
  queueEmptyCallbacks.clear();
}

export function addToAttachmentDownloadQueue(
  idLog: string,
  message: MessageModel
): void {
  if (!attachmentDownloadQueue) {
    return;
  }

  attachmentDownloadQueue.unshift(message.id);

  log.info(
    `${idLog}: Adding to attachmentDownloadQueue`,
    message.get('sent_at')
  );
}

export async function flushAttachmentDownloadQueue(): Promise<void> {
  // NOTE: ts/models/messages.ts expects this global to become undefined
  // once we stop processing the queue.
  isEnabled = false;

  if (!attachmentDownloadQueue?.length) {
    onQueueEmpty();
    return;
  }

  const messageIdsToDownload = attachmentDownloadQueue.slice(
    0,
    MAX_ATTACHMENT_MSGS_TO_DOWNLOAD
  );

  const messageIdsToSave: Array<string> = [];
  let numMessagesQueued = 0;
  await Promise.all(
    messageIdsToDownload.map(async messageId => {
      const message = window.MessageCache.__DEPRECATED$getById(messageId);
      if (!message) {
        log.warn(
          'attachmentDownloadQueue: message not found in messageCache, maybe it was deleted?'
        );
        return;
      }

      if (
        isMoreRecentThan(
          message.getReceivedAt(),
          MAX_ATTACHMENT_DOWNLOAD_AGE
        ) ||
        // Stickers and long text attachments has to be downloaded for UI
        // to display the message properly.
        message.hasRequiredAttachmentDownloads()
      ) {
        const shouldSave = await message.queueAttachmentDownloads();
        if (shouldSave) {
          messageIdsToSave.push(messageId);
        }
        numMessagesQueued += 1;
      }
    })
  );

  log.info(
    `Downloading recent attachments for ${numMessagesQueued} ` +
      `of ${attachmentDownloadQueue.length} total messages`
  );

  const messagesToSave = messageIdsToSave
    .map(messageId => window.MessageCache.accessAttributes(messageId))
    .filter(isNotNil);

  await DataWriter.saveMessages(messagesToSave, {
    ourAci: window.storage.user.getCheckedAci(),
  });

  attachmentDownloadQueue = undefined;
  onQueueEmpty();
}
