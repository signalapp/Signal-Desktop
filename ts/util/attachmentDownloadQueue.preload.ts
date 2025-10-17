// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageModel } from '../models/messages.preload.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { AttachmentType } from '../types/Attachment.std.js';

import { createLogger } from '../logging/log.std.js';
import * as MIME from '../types/MIME.std.js';

import { DataWriter } from '../sql/Client.preload.js';
import { isMoreRecentThan } from './timestamp.std.js';
import { isNotNil } from './isNotNil.std.js';
import { queueAttachmentDownloads } from './queueAttachmentDownloads.preload.js';
import { postSaveUpdates } from './cleanup.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('attachmentDownloadQueue');

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
      const message = window.MessageCache.getById(messageId);
      if (!message) {
        log.warn('message not found in messageCache, maybe it was deleted?');
        return;
      }

      if (
        isMoreRecentThan(
          message.get('received_at_ms') || message.get('received_at'),
          MAX_ATTACHMENT_DOWNLOAD_AGE
        ) ||
        // Stickers and long text attachments has to be downloaded for UI
        // to display the message properly.
        hasRequiredAttachmentDownloads(message.attributes)
      ) {
        const shouldSave = await queueAttachmentDownloads(message, {
          isManualDownload: false,
        });
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
    .map(messageId => window.MessageCache.getById(messageId)?.attributes)
    .filter(isNotNil);

  await DataWriter.saveMessages(messagesToSave, {
    ourAci: itemStorage.user.getCheckedAci(),
    postSaveUpdates,
  });

  attachmentDownloadQueue = undefined;
  onQueueEmpty();
}

function hasRequiredAttachmentDownloads(
  message: MessageAttributesType
): boolean {
  const attachments: ReadonlyArray<AttachmentType> = message.attachments || [];

  const hasLongMessageAttachments =
    Boolean(message.bodyAttachment) ||
    attachments.some(attachment => {
      return MIME.isLongMessage(attachment.contentType);
    });

  if (hasLongMessageAttachments) {
    return true;
  }

  const { sticker } = message;
  if (sticker) {
    return !sticker.data || !sticker.data.path;
  }

  return false;
}
