// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ReadStatus } from '../messages/MessageReadStatus.std.js';
import type { SeenStatus } from '../MessageSeenStatus.std.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { dropNull, shallowDropNull } from '../util/dropNull.std.js';

/* eslint-disable camelcase */

import type {
  MessageTypeUnhydrated,
  MessageType,
  MESSAGE_COLUMNS,
  ReadableDB,
  MessageAttachmentDBType,
} from './Interface.std.js';
import {
  batchMultiVarQuery,
  convertOptionalIntegerToBoolean,
  jsonToObject,
  sql,
  sqlJoin,
} from './util.std.js';
import type { AttachmentType } from '../types/Attachment.std.js';
import {
  APPLICATION_OCTET_STREAM,
  IMAGE_JPEG,
  IMAGE_PNG,
  stringToMIMEType,
} from '../types/MIME.std.js';
import { strictAssert } from '../util/assert.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import { createLogger } from '../logging/log.std.js';

const { groupBy } = lodash;

export const ROOT_MESSAGE_ATTACHMENT_EDIT_HISTORY_INDEX = -1;

const log = createLogger('hydrateMessage');
function toBoolean(value: number | null): boolean | undefined {
  if (value == null) {
    return undefined;
  }
  return value === 1;
}

export function hydrateMessage(
  db: ReadableDB,
  row: MessageTypeUnhydrated
): MessageType {
  return hydrateMessages(db, [row])[0];
}

export function hydrateMessages(
  db: ReadableDB,
  unhydratedMessages: Array<MessageTypeUnhydrated>
): Array<MessageType> {
  const messagesWithColumnsHydrated = unhydratedMessages.map(msg => ({
    ...hydrateMessageTableColumns(msg),
    hasAttachments: msg.hasAttachments === 1,
    hasFileAttachments: msg.hasFileAttachments === 1,
    hasVisualMediaAttachments: msg.hasVisualMediaAttachments === 1,
  }));

  return hydrateMessagesWithAttachments(db, messagesWithColumnsHydrated);
}

export function hydrateMessageTableColumns(
  row: MessageTypeUnhydrated
): MessageType {
  const {
    json,
    id,
    body,
    conversationId,
    expirationStartTimestamp,
    expireTimer,
    isErased,
    isViewOnce,
    mentionsMe,
    received_at,
    received_at_ms,
    schemaVersion,
    serverGuid,
    sent_at,
    source,
    sourceServiceId,
    sourceDevice,
    storyId,
    type,
    readStatus,
    seenStatus,
    timestamp,
    serverTimestamp,
    unidentifiedDeliveryReceived,
  } = row;

  return {
    ...(JSON.parse(json) as Omit<
      MessageType,
      (typeof MESSAGE_COLUMNS)[number]
    >),

    id,
    body: dropNull(body),
    conversationId: conversationId || '',
    expirationStartTimestamp: dropNull(expirationStartTimestamp),
    expireTimer: dropNull(expireTimer) as MessageType['expireTimer'],
    isErased: toBoolean(isErased),
    isViewOnce: toBoolean(isViewOnce),
    mentionsMe: toBoolean(mentionsMe),
    received_at: received_at || 0,
    received_at_ms: dropNull(received_at_ms),
    schemaVersion: dropNull(schemaVersion),
    serverGuid: dropNull(serverGuid),
    sent_at: sent_at || 0,
    source: dropNull(source),
    sourceServiceId: dropNull(sourceServiceId) as ServiceIdString | undefined,
    sourceDevice: dropNull(sourceDevice),
    storyId: dropNull(storyId),
    type: type as MessageType['type'],
    readStatus: readStatus == null ? undefined : (readStatus as ReadStatus),
    seenStatus: seenStatus == null ? undefined : (seenStatus as SeenStatus),
    timestamp: timestamp || 0,
    serverTimestamp: dropNull(serverTimestamp),
    unidentifiedDeliveryReceived: toBoolean(unidentifiedDeliveryReceived),
  };
}

export function getAttachmentReferencesForMessages(
  db: ReadableDB,
  messageIds: Array<string>
): Array<MessageAttachmentDBType> {
  return batchMultiVarQuery(
    db,
    messageIds,
    (
      messageIdBatch: ReadonlyArray<string>,
      persistent: boolean
    ): Array<MessageAttachmentDBType> => {
      const [query, params] = sql`
      SELECT * FROM message_attachments 
      WHERE messageId IN (${sqlJoin(messageIdBatch)});
    `;

      return db
        .prepare(query, { persistent })
        .all<MessageAttachmentDBType>(params);
    }
  );
}

function hydrateMessagesWithAttachments(
  db: ReadableDB,
  messagesWithoutAttachments: Array<
    MessageType & {
      hasAttachments: boolean;
      hasVisualMediaAttachments: boolean;
      hasFileAttachments: boolean;
    }
  >
): Array<MessageType> {
  const attachmentReferencesForAllMessages = getAttachmentReferencesForMessages(
    db,
    messagesWithoutAttachments.map(msg => msg.id)
  );
  const attachmentReferencesByMessage = groupBy(
    attachmentReferencesForAllMessages,
    'messageId'
  );

  return messagesWithoutAttachments.map(msgWithExtraFields => {
    const {
      hasAttachments,
      hasFileAttachments,
      hasVisualMediaAttachments,
      ...msg
    } = msgWithExtraFields;

    const attachmentReferences = attachmentReferencesByMessage[msg.id] ?? [];

    if (!attachmentReferences.length) {
      if (msg.attachments?.length) {
        // legacy message, attachments still on JSON
        return msg;
      }

      if (msg.isErased || msg.deletedForEveryone || msg.isViewOnce) {
        return msg;
      }

      if (msg.type !== 'incoming' && msg.type !== 'outgoing') {
        return msg;
      }

      if (
        !hasAttachments &&
        !hasFileAttachments &&
        !hasVisualMediaAttachments
      ) {
        return msg;
      }

      log.warn(
        `Retrieved message that should have attachments but missing message_attachment rows, timestamp: ${msg.timestamp}`
      );
      // Add an empty attachment to the message to enable backfilling in the UI
      return {
        ...msg,
        attachments: [
          {
            error: true,
            size: 0,
            width: hasVisualMediaAttachments ? 150 : undefined,
            height: hasVisualMediaAttachments ? 150 : undefined,
            contentType: hasVisualMediaAttachments
              ? IMAGE_PNG
              : APPLICATION_OCTET_STREAM,
          },
        ],
      };
    }

    const attachmentsByEditHistoryIndex = groupBy(
      attachmentReferences,
      'editHistoryIndex'
    );

    const message = hydrateMessageRootOrRevisionWithAttachments(
      msg,
      attachmentsByEditHistoryIndex[
        ROOT_MESSAGE_ATTACHMENT_EDIT_HISTORY_INDEX
      ] ?? []
    );

    if (message.editHistory) {
      message.editHistory = message.editHistory.map((editHistory, idx) => {
        return hydrateMessageRootOrRevisionWithAttachments(
          editHistory,
          attachmentsByEditHistoryIndex[idx] ?? []
        );
      });
    }

    return message;
  });
}

function hydrateMessageRootOrRevisionWithAttachments<
  T extends Pick<
    MessageAttributesType,
    | 'attachments'
    | 'bodyAttachment'
    | 'contact'
    | 'preview'
    | 'quote'
    | 'sticker'
  >,
>(message: T, messageAttachments: Array<MessageAttachmentDBType>): T {
  const attachmentsByType = groupBy(
    messageAttachments,
    'attachmentType'
  ) as Record<
    MessageAttachmentDBType['attachmentType'],
    Array<MessageAttachmentDBType>
  >;

  const standardAttachments = attachmentsByType.attachment ?? [];
  const bodyAttachments = attachmentsByType['long-message'] ?? [];
  const quoteAttachments = attachmentsByType.quote ?? [];
  const previewAttachments = attachmentsByType.preview ?? [];
  const contactAttachments = attachmentsByType.contact ?? [];
  const stickerAttachment = (attachmentsByType.sticker ?? []).find(
    sticker => sticker.orderInMessage === 0
  );

  const hydratedMessage = structuredClone(message);

  if (standardAttachments.length) {
    hydratedMessage.attachments = standardAttachments
      .sort((a, b) => a.orderInMessage - b.orderInMessage)
      .map(convertAttachmentDBFieldsToAttachmentType);
  }

  if (bodyAttachments[0]) {
    hydratedMessage.bodyAttachment = convertAttachmentDBFieldsToAttachmentType(
      bodyAttachments[0]
    );
  }

  hydratedMessage.quote?.attachments.forEach((quoteAttachment, idx) => {
    const quoteThumbnail = quoteAttachments.find(
      attachment => attachment.orderInMessage === idx
    );
    if (quoteThumbnail) {
      // eslint-disable-next-line no-param-reassign
      quoteAttachment.thumbnail =
        convertAttachmentDBFieldsToAttachmentType(quoteThumbnail);
    }
  });

  hydratedMessage.preview?.forEach((preview, idx) => {
    const previewAttachment = previewAttachments.find(
      attachment => attachment.orderInMessage === idx
    );

    if (previewAttachment) {
      // eslint-disable-next-line no-param-reassign
      preview.image =
        convertAttachmentDBFieldsToAttachmentType(previewAttachment);
    }
  });

  hydratedMessage.contact?.forEach((contact, idx) => {
    const contactAttachment = contactAttachments.find(
      attachment => attachment.orderInMessage === idx
    );
    if (contactAttachment && contact.avatar) {
      // eslint-disable-next-line no-param-reassign
      contact.avatar.avatar =
        convertAttachmentDBFieldsToAttachmentType(contactAttachment);
    }
  });

  if (hydratedMessage.sticker && stickerAttachment) {
    hydratedMessage.sticker.data =
      convertAttachmentDBFieldsToAttachmentType(stickerAttachment);
  }

  return hydratedMessage;
}

export function convertAttachmentDBFieldsToAttachmentType(
  dbFields: MessageAttachmentDBType
): AttachmentType {
  const messageAttachment = shallowDropNull(dbFields);
  strictAssert(messageAttachment != null, 'must exist');

  const {
    clientUuid,
    size,
    duration,
    contentType,
    plaintextHash,
    path,
    localKey,
    caption,
    blurHash,
    height,
    width,
    digest,
    key,
    downloadPath,
    flags,
    fileName,
    version,
    incrementalMac,
    incrementalMacChunkSize: chunkSize,
    transitCdnKey: cdnKey,
    transitCdnNumber: cdnNumber,
    transitCdnUploadTimestamp: uploadTimestamp,
    error,
    pending,
    wasTooBig,
    isCorrupted,
    backfillError,
    storyTextAttachmentJson,
    copiedFromQuotedAttachment,
    localBackupPath,
  } = messageAttachment;

  const result: AttachmentType = {
    clientUuid,
    size,
    duration,
    contentType: stringToMIMEType(contentType),
    plaintextHash,
    path,
    localKey,
    caption,
    blurHash,
    height,
    width,
    digest,
    key,
    downloadPath,
    localBackupPath,
    flags,
    fileName,
    version,
    incrementalMac,
    chunkSize,
    cdnKey,
    cdnNumber,
    uploadTimestamp,
    pending: convertOptionalIntegerToBoolean(pending),
    error: convertOptionalIntegerToBoolean(error),
    wasTooBig: convertOptionalIntegerToBoolean(wasTooBig),
    copied: convertOptionalIntegerToBoolean(copiedFromQuotedAttachment),
    isCorrupted: convertOptionalIntegerToBoolean(isCorrupted),
    backfillError: convertOptionalIntegerToBoolean(backfillError),
    textAttachment: storyTextAttachmentJson
      ? jsonToObject(storyTextAttachmentJson)
      : undefined,
    backupCdnNumber: messageAttachment.backupCdnNumber,
    ...(messageAttachment.thumbnailPath
      ? {
          thumbnail: {
            path: messageAttachment.thumbnailPath,
            size: messageAttachment.thumbnailSize ?? 0,
            contentType: messageAttachment.thumbnailContentType
              ? stringToMIMEType(messageAttachment.thumbnailContentType)
              : IMAGE_JPEG,
            localKey: messageAttachment.thumbnailLocalKey,
            version: messageAttachment.thumbnailVersion,
          },
        }
      : {}),
    ...(messageAttachment.screenshotPath
      ? {
          screenshot: {
            path: messageAttachment.screenshotPath,
            size: messageAttachment.screenshotSize ?? 0,
            contentType: messageAttachment.screenshotContentType
              ? stringToMIMEType(messageAttachment.screenshotContentType)
              : IMAGE_JPEG,
            localKey: messageAttachment.screenshotLocalKey,
            version: messageAttachment.screenshotVersion,
          },
        }
      : {}),
    ...(messageAttachment.backupThumbnailPath
      ? {
          thumbnailFromBackup: {
            path: messageAttachment.backupThumbnailPath,
            size: messageAttachment.backupThumbnailSize ?? 0,
            contentType: messageAttachment.backupThumbnailContentType
              ? stringToMIMEType(messageAttachment.backupThumbnailContentType)
              : IMAGE_JPEG,
            localKey: messageAttachment.backupThumbnailLocalKey,
            version: messageAttachment.backupThumbnailVersion,
          },
        }
      : {}),
  };

  return result;
}
