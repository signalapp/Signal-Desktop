// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentBackfillResponseSyncEvent } from '../../textsecure/messageReceiverEvents';
import MessageSender from '../../textsecure/SendMessage';
import * as log from '../../logging/log';
import type { ReadonlyMessageAttributesType } from '../../model-types.d';
import {
  type AttachmentType,
  isDownloading,
  isDownloaded,
  isDownloadable,
} from '../../types/Attachment';
import {
  type AttachmentDownloadJobTypeType,
  AttachmentDownloadUrgency,
} from '../../types/AttachmentDownload';
import { AttachmentDownloadSource } from '../../sql/Interface';
import { APPLICATION_OCTET_STREAM } from '../../types/MIME';
import {
  getConversationIdentifier,
  getAddressableMessage,
  getConversationFromTarget,
  getMessageQueryFromTarget,
  findMatchingMessage,
} from '../../util/syncIdentifiers';
import { strictAssert } from '../../util/assert';
import { drop } from '../../util/drop';
import { missingCaseError } from '../../util/missingCaseError';
import { isStagingServer } from '../../util/isStagingServer';
import {
  ensureBodyAttachmentsAreSeparated,
  queueAttachmentDownloadsForMessage,
} from '../../util/queueAttachmentDownloads';
import { SECOND } from '../../util/durations';
import { showDownloadFailedToast } from '../../util/showDownloadFailedToast';
import { markAttachmentAsPermanentlyErrored } from '../../util/attachments/markAttachmentAsPermanentlyErrored';
import { singleProtoJobQueue } from '../singleProtoJobQueue';
import { MessageModel } from '../../models/messages';
import { getMessageById } from '../../messages/getMessageById';
import { addAttachmentToMessage } from '../../messageModifiers/AttachmentDownloads';
import { SignalService as Proto } from '../../protobuf';
import * as RemoteConfig from '../../RemoteConfig';
import { isTestOrMockEnvironment } from '../../environment';
import { BackfillFailureKind } from '../../components/BackfillFailureModal';

const REQUEST_TIMEOUT = isTestOrMockEnvironment() ? 5 * SECOND : 10 * SECOND;

const PLACEHOLDER_ATTACHMENT: AttachmentType = {
  error: true,
  contentType: APPLICATION_OCTET_STREAM,
  size: 0,
};

function isBackfillEnabled(): boolean {
  if (isStagingServer() || isTestOrMockEnvironment()) {
    return true;
  }
  if (RemoteConfig.isEnabled('desktop.internalUser')) {
    return true;
  }
  const ourConversation = window.ConversationController.getOurConversation();
  return ourConversation?.get('capabilities')?.attachmentBackfill === true;
}

export class AttachmentBackfill {
  #pendingRequests = new Map<
    ReadonlyMessageAttributesType['id'],
    NodeJS.Timeout
  >();

  public async request(message: ReadonlyMessageAttributesType): Promise<void> {
    const existingTimer = this.#pendingRequests.get(message.id);
    if (existingTimer != null) {
      return;
    }

    const addr = getAddressableMessage(message);
    if (addr == null) {
      throw new Error('No address for message');
    }

    const convo = window.ConversationController.get(message.conversationId);
    strictAssert(convo != null, 'Missing message conversation');

    this.#pendingRequests.set(
      message.id,
      setTimeout(() => drop(this.#onTimeout(message.id)), REQUEST_TIMEOUT)
    );

    await singleProtoJobQueue.add(
      MessageSender.getAttachmentBackfillSyncMessage(
        getConversationIdentifier(convo.attributes),
        addr
      )
    );
  }

  public async handleResponse({
    timestamp,
    response,
  }: AttachmentBackfillResponseSyncEvent): Promise<void> {
    let logId = `onAttachmentBackfillResponseSync(${timestamp})`;
    if (!isBackfillEnabled()) {
      log.info(`${logId}: disabled`);
      return;
    }

    log.info(`${logId}: start`);

    const {
      Error: ErrorEnum,
      AttachmentData: { Status },
    } = Proto.SyncMessage.AttachmentBackfillResponse;

    const { targetMessage, targetConversation } = response;

    const convo = getConversationFromTarget(targetConversation);
    if (convo == null) {
      log.error(`${logId}: conversation not found`);
      return;
    }

    const query = getMessageQueryFromTarget(targetMessage);
    const attributes = await findMatchingMessage(convo.id, query);
    if (attributes == null) {
      log.error(`${logId}: message not found`);
      return;
    }

    const message = window.MessageCache.register(new MessageModel(attributes));
    logId += `(${message.get('sent_at')})`;

    const timer = this.#pendingRequests.get(message.id);
    if (timer != null) {
      clearTimeout(timer);
    }

    if ('error' in response) {
      // Don't show error if we didn't request the data or already timed out
      if (timer == null) {
        return;
      }

      if (response.error === ErrorEnum.MESSAGE_NOT_FOUND) {
        window.reduxActions.globalModals.showBackfillFailureModal({
          kind: BackfillFailureKind.NotFound,
        });
      } else {
        throw missingCaseError(response.error);
      }
      return;
    }

    // IMPORTANT: no awaits until we finish modifying attachments

    // Since we are matching remote attachments with local attachments we need
    // to make sure things are normalized before starting.
    message.set(
      ensureBodyAttachmentsAreSeparated(message.attributes, {
        logId,
        logger: log,
      })
    );

    // We will be potentially modifying these attachments below
    let updatedSticker = message.get('sticker');
    let updatedBodyAttachment = message.get('bodyAttachment');
    const updatedAttachments = message.get('attachments')?.slice() ?? [];
    let changeCount = 0;

    // If `true` - show a toast at the end of the process
    let showToast = false;

    // If `true` - queue downloads at the end of the process
    let shouldDownload = false;

    // Track number of pending attachments to decide when the request is
    // fully processed by the phone.
    let pendingCount = 0;

    const remoteAttachments = response.attachments.slice();
    if (updatedSticker?.data != null) {
      const remoteSticker = remoteAttachments.shift();
      if (remoteSticker == null) {
        log.error(`${logId}: no attachment for sticker`);
        return;
      }

      const existing = updatedSticker.data;
      if (isDownloaded(existing)) {
        log.info(`${logId}: not updating, sticker downloaded`);
      } else if ('status' in remoteSticker) {
        if (remoteSticker.status === Status.PENDING) {
          pendingCount += 1;
          // Keep sticker as is
        } else if (remoteSticker.status === Status.TERMINAL_ERROR) {
          changeCount += 1;
          updatedSticker = {
            ...updatedSticker,
            data: markAttachmentAsPermanentlyErrored(existing, {
              backfillError: true,
            }),
          };
          showToast = true;
        } else {
          throw missingCaseError(remoteSticker.status);
        }
      } else {
        // If the attachment is not in pending state - we got a response for
        // other device's backfill request. Update the CDN info without queueing
        // a download.
        if (isDownloading(updatedSticker.data)) {
          shouldDownload = true;
        }
        updatedSticker = {
          ...updatedSticker,
          data: remoteSticker.attachment,
        };
        changeCount += 1;
      }
    }

    // Pad local attachments until they match remote
    let padding = 0;
    while (updatedAttachments.length < remoteAttachments.length) {
      updatedAttachments.push(PLACEHOLDER_ATTACHMENT);
      changeCount += 1;
      padding += 1;
    }

    if (padding !== 0) {
      log.warn(`${logId}: padded with ${padding} attachments`);
    }

    if (response.longText != null) {
      if (updatedBodyAttachment == null) {
        updatedBodyAttachment = PLACEHOLDER_ATTACHMENT;
        changeCount += 1;
        log.warn(`${logId}: padded with a body attachment`);
      }

      if (isDownloaded(updatedBodyAttachment)) {
        log.info(`${logId}: not updating long body`);
      } else if ('status' in response.longText) {
        if (response.longText.status === Status.PENDING) {
          // Keep attachment as is
          pendingCount += 1;
        } else if (response.longText.status === Status.TERMINAL_ERROR) {
          changeCount += 1;
          updatedBodyAttachment = markAttachmentAsPermanentlyErrored(
            updatedBodyAttachment,
            { backfillError: true }
          );
          showToast = true;
        } else {
          throw missingCaseError(response.longText.status);
        }
      } else {
        // See sticker handling code above for the reasoning
        if (isDownloading(updatedBodyAttachment)) {
          shouldDownload = true;
        }
        updatedBodyAttachment = response.longText.attachment;
        changeCount += 1;
      }
    }

    for (const [index, entry] of remoteAttachments.entries()) {
      const existing = updatedAttachments[index];

      if (isDownloaded(existing)) {
        log.info(`${logId}: not updating ${index}, downloaded`);
        continue;
      }

      if ('status' in entry) {
        if (entry.status === Status.PENDING) {
          // Keep attachment as is
          pendingCount += 1;
        } else if (entry.status === Status.TERMINAL_ERROR) {
          showToast = true;

          changeCount += 1;
          updatedAttachments[index] = markAttachmentAsPermanentlyErrored(
            existing,
            { backfillError: true }
          );
        } else {
          throw missingCaseError(entry.status);
        }
        continue;
      }

      changeCount += 1;

      // See sticker handling code above for the reasoning
      if (isDownloading(existing)) {
        shouldDownload = true;
      }
      updatedAttachments[index] = entry.attachment;
    }

    if (showToast) {
      log.warn(`${logId}: showing toast`);
      showDownloadFailedToast(message.id);
    }

    if (pendingCount === 0) {
      log.info(`${logId}: no pending attachments, fulfilled`);
      this.#pendingRequests.delete(message.id);
    }

    if (changeCount === 0) {
      log.info(`${logId}: no changes`);
      return;
    }

    log.info(`${logId}: updating ${changeCount} attachments`);
    message.set({
      attachments: updatedAttachments,
      bodyAttachment: updatedBodyAttachment,
      sticker: updatedSticker,
      editHistory: message.get('editHistory')?.map(edit => ({
        ...edit,
        attachments: updatedAttachments,
        bodyAttachment: updatedBodyAttachment,
      })),
    });

    // It is fine to await below this line

    if (shouldDownload) {
      log.info(`${logId}: queueing downloads`);
      await queueAttachmentDownloadsForMessage(message, {
        source: AttachmentDownloadSource.BACKFILL,
        urgency: AttachmentDownloadUrgency.IMMEDIATE,
        isManualDownload: true,
      });
    }

    // Save after queueing because queuing might update attributes
    await window.MessageCache.saveMessage(message.attributes);
  }

  public static isEnabledForJob(
    jobType: AttachmentDownloadJobTypeType,
    message: Pick<ReadonlyMessageAttributesType, 'type'>
  ): boolean {
    if (message.type === 'story') {
      return false;
    }

    switch (jobType) {
      // Supported
      case 'long-message':
        break;
      case 'attachment':
        break;
      case 'sticker':
        break;

      // Not supported
      case 'contact':
        return false;
      case 'preview':
        return false;
      case 'quote':
        return false;

      default:
        throw missingCaseError(jobType);
    }

    return isBackfillEnabled();
  }

  async #onTimeout(messageId: string): Promise<void> {
    const message = await getMessageById(messageId);

    this.#pendingRequests.delete(messageId);

    // Message already removed
    if (message == null) {
      return;
    }

    const logId = `attachmentBackfill.onTimeout(${message.get('sent_at')})`;
    log.info(`${logId}: onTimeout`);

    const bodyAttachment = message.get('bodyAttachment');
    if (bodyAttachment != null && isDownloading(bodyAttachment)) {
      log.info(`${logId}: clearing long text download`);
      await addAttachmentToMessage(
        message.id,
        {
          ...bodyAttachment,
          pending: false,
        },
        'attachmentBackfillTimeout',
        { type: 'long-message' }
      );
    }

    const sticker = message.get('sticker');
    if (sticker?.data != null && isDownloading(sticker.data)) {
      log.info(`${logId}: clearing long text download`);
      await addAttachmentToMessage(
        message.id,
        {
          ...sticker.data,
          pending: false,
        },
        'attachmentBackfillTimeout',
        { type: 'sticker' }
      );
    }

    const pendingAttachments = (message.get('attachments') ?? []).filter(
      isDownloading
    );

    if (pendingAttachments.length !== 0) {
      log.info(
        `${logId}: clearing attachment downloads ${pendingAttachments.length}`
      );
      await Promise.all(
        pendingAttachments.map(attachment => {
          return addAttachmentToMessage(
            message.id,
            {
              ...attachment,
              pending: false,
            },
            'attachmentBackfillTimeout',
            { type: 'attachment' }
          );
        })
      );
    }

    window.reduxActions.globalModals.showBackfillFailureModal({
      kind: BackfillFailureKind.Timeout,
    });
  }
}

export function isPermanentlyUndownloadable(
  attachment: AttachmentType,
  disposition: AttachmentDownloadJobTypeType,
  message: Pick<ReadonlyMessageAttributesType, 'type'>
): boolean {
  // Attachment is downloadable or user have not failed to download it yet
  if (isDownloadable(attachment) || !attachment.error) {
    return false;
  }

  // Too big attachments cannot be retried anymore
  if (attachment.wasTooBig) {
    return true;
  }

  // Previous backfill failed
  if (attachment.backfillError) {
    return true;
  }

  // If backfill is unavailable for the attachment - it cannot be downloaded
  // at this time.
  return !AttachmentBackfill.isEnabledForJob(disposition, message);
}

export function isPermanentlyUndownloadableWithoutBackfill(
  attachment: AttachmentType
): boolean {
  // Attachment is downloadable or user have not failed to download it yet
  if (isDownloadable(attachment) || !attachment.error) {
    return false;
  }

  // Too big attachments cannot be retried anymore
  if (attachment.wasTooBig) {
    return true;
  }

  // Previous backfill failed
  if (attachment.backfillError) {
    return true;
  }

  return true;
}
