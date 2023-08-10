// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import type { MessageModel } from '../models/messages';
import * as log from '../logging/log';
import { isMoreRecentThan } from './timestamp';

const MAX_ATTACHMENT_DOWNLOAD_AGE = 3600 * 72 * 1000;
const MAX_ATTACHMENT_MSGS_TO_DOWNLOAD = 250;

let isEnabled = true;
let attachmentDownloadQueue: Array<MessageModel> | undefined = [];

export function shouldUseAttachmentDownloadQueue(): boolean {
  return isEnabled;
}

export function addToAttachmentDownloadQueue(
  idLog: string,
  message: MessageModel
): void {
  if (!attachmentDownloadQueue) {
    return;
  }

  attachmentDownloadQueue.unshift(message);

  log.info(
    `${idLog}: Adding to attachmentDownloadQueue`,
    message.get('sent_at')
  );
}

export async function flushAttachmentDownloadQueue(): Promise<void> {
  if (!attachmentDownloadQueue) {
    return;
  }

  // NOTE: ts/models/messages.ts expects this global to become undefined
  // once we stop processing the queue.
  isEnabled = false;

  const attachmentsToDownload = attachmentDownloadQueue.filter(
    (message, index) =>
      index <= MAX_ATTACHMENT_MSGS_TO_DOWNLOAD ||
      isMoreRecentThan(message.getReceivedAt(), MAX_ATTACHMENT_DOWNLOAD_AGE) ||
      // Stickers and long text attachments has to be downloaded for UI
      // to display the message properly.
      message.hasRequiredAttachmentDownloads()
  );

  log.info(
    'Downloading recent attachments of total attachments',
    attachmentsToDownload.length,
    attachmentDownloadQueue.length
  );

  const messagesWithDownloads = await Promise.all(
    attachmentsToDownload.map(message => message.queueAttachmentDownloads())
  );
  const messagesToSave: Array<MessageAttributesType> = [];
  messagesWithDownloads.forEach((shouldSave, messageKey) => {
    if (shouldSave) {
      const message = attachmentsToDownload[messageKey];
      messagesToSave.push(message.attributes);
    }
  });
  await window.Signal.Data.saveMessages(messagesToSave, {
    ourAci: window.storage.user.getCheckedAci(),
  });

  attachmentDownloadQueue = undefined;
}
