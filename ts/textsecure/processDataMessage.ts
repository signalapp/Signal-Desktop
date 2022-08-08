// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import { ReceiptCredentialPresentation } from '@signalapp/libsignal-client/zkgroup';
import { isNumber } from 'lodash';

import { assert, strictAssert } from '../util/assert';
import { dropNull, shallowDropNull } from '../util/dropNull';
import { SignalService as Proto } from '../protobuf';
import { deriveGroupFields } from '../groups';
import * as Bytes from '../Bytes';
import { deriveMasterKeyFromGroupV1 } from '../Crypto';

import type {
  ProcessedAttachment,
  ProcessedDataMessage,
  ProcessedGroupContext,
  ProcessedGroupV2Context,
  ProcessedQuote,
  ProcessedContact,
  ProcessedPreview,
  ProcessedSticker,
  ProcessedReaction,
  ProcessedDelete,
  ProcessedGiftBadge,
} from './Types.d';
import { WarnOnlyError } from './Errors';
import { GiftBadgeStates } from '../components/conversation/Message';
import { APPLICATION_OCTET_STREAM, stringToMIMEType } from '../types/MIME';
import { SECOND } from '../util/durations';

const FLAGS = Proto.DataMessage.Flags;
export const ATTACHMENT_MAX = 32;

export function processAttachment(
  attachment: Proto.IAttachmentPointer
): ProcessedAttachment;
export function processAttachment(
  attachment?: Proto.IAttachmentPointer | null
): ProcessedAttachment | undefined;

export function processAttachment(
  attachment?: Proto.IAttachmentPointer | null
): ProcessedAttachment | undefined {
  if (!attachment) {
    return undefined;
  }

  const { cdnId } = attachment;
  const hasCdnId = Long.isLong(cdnId) ? !cdnId.isZero() : Boolean(cdnId);

  const { contentType, digest, key, size } = attachment;
  if (!isNumber(size)) {
    throw new Error('Missing size on incoming attachment!');
  }

  return {
    ...shallowDropNull(attachment),

    cdnId: hasCdnId ? String(cdnId) : undefined,
    contentType: contentType
      ? stringToMIMEType(contentType)
      : APPLICATION_OCTET_STREAM,
    digest: digest ? Bytes.toBase64(digest) : undefined,
    key: key ? Bytes.toBase64(key) : undefined,
    size,
  };
}

function processGroupContext(
  group?: Proto.IGroupContext | null
): ProcessedGroupContext | undefined {
  if (!group) {
    return undefined;
  }

  strictAssert(group.id, 'group context without id');
  strictAssert(
    group.type !== undefined && group.type !== null,
    'group context without type'
  );

  const masterKey = deriveMasterKeyFromGroupV1(group.id);
  const data = deriveGroupFields(masterKey);

  const derivedGroupV2Id = Bytes.toBase64(data.id);

  const result: ProcessedGroupContext = {
    id: Bytes.toBinary(group.id),
    type: group.type,
    name: dropNull(group.name),
    membersE164: group.membersE164 ?? [],
    avatar: processAttachment(group.avatar),
    derivedGroupV2Id,
  };

  if (result.type === Proto.GroupContext.Type.DELIVER) {
    result.name = undefined;
    result.membersE164 = [];
    result.avatar = undefined;
  }

  return result;
}

export function processGroupV2Context(
  groupV2?: Proto.IGroupContextV2 | null
): ProcessedGroupV2Context | undefined {
  if (!groupV2) {
    return undefined;
  }

  strictAssert(groupV2.masterKey, 'groupV2 context without masterKey');
  const data = deriveGroupFields(groupV2.masterKey);

  return {
    masterKey: Bytes.toBase64(groupV2.masterKey),
    revision: dropNull(groupV2.revision),
    groupChange: groupV2.groupChange
      ? Bytes.toBase64(groupV2.groupChange)
      : undefined,
    id: Bytes.toBase64(data.id),
    secretParams: Bytes.toBase64(data.secretParams),
    publicParams: Bytes.toBase64(data.publicParams),
  };
}

export function processQuote(
  quote?: Proto.DataMessage.IQuote | null
): ProcessedQuote | undefined {
  if (!quote) {
    return undefined;
  }

  return {
    id: quote.id?.toNumber(),
    authorUuid: dropNull(quote.authorUuid),
    text: dropNull(quote.text),
    attachments: (quote.attachments ?? []).map(attachment => {
      return {
        contentType: dropNull(attachment.contentType),
        fileName: dropNull(attachment.fileName),
        thumbnail: processAttachment(attachment.thumbnail),
      };
    }),
    bodyRanges: quote.bodyRanges ?? [],
    type: quote.type || Proto.DataMessage.Quote.Type.NORMAL,
  };
}

export function processContact(
  contact?: ReadonlyArray<Proto.DataMessage.IContact> | null
): ReadonlyArray<ProcessedContact> | undefined {
  if (!contact) {
    return undefined;
  }

  return contact.map(item => {
    return {
      ...item,
      avatar: item.avatar
        ? {
            avatar: processAttachment(item.avatar.avatar),
            isProfile: Boolean(item.avatar.isProfile),
          }
        : undefined,
    };
  });
}

function isLinkPreviewDateValid(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    Number.isFinite(value) &&
    value > 0
  );
}

function cleanLinkPreviewDate(value?: Long | null): number | undefined {
  const result = value?.toNumber();
  return isLinkPreviewDateValid(result) ? result : undefined;
}

export function processPreview(
  preview?: ReadonlyArray<Proto.DataMessage.IPreview> | null
): ReadonlyArray<ProcessedPreview> | undefined {
  if (!preview) {
    return undefined;
  }

  return preview.map(item => {
    return {
      url: dropNull(item.url),
      title: dropNull(item.title),
      image: item.image ? processAttachment(item.image) : undefined,
      description: dropNull(item.description),
      date: cleanLinkPreviewDate(item.date),
    };
  });
}

export function processSticker(
  sticker?: Proto.DataMessage.ISticker | null
): ProcessedSticker | undefined {
  if (!sticker) {
    return undefined;
  }

  return {
    packId: sticker.packId ? Bytes.toHex(sticker.packId) : undefined,
    packKey: sticker.packKey ? Bytes.toBase64(sticker.packKey) : undefined,
    stickerId: dropNull(sticker.stickerId),
    emoji: dropNull(sticker.emoji),
    data: processAttachment(sticker.data),
  };
}

export function processReaction(
  reaction?: Proto.DataMessage.IReaction | null
): ProcessedReaction | undefined {
  if (!reaction) {
    return undefined;
  }

  return {
    emoji: dropNull(reaction.emoji),
    remove: Boolean(reaction.remove),
    targetAuthorUuid: dropNull(reaction.targetAuthorUuid),
    targetTimestamp: reaction.targetTimestamp?.toNumber(),
  };
}

export function processDelete(
  del?: Proto.DataMessage.IDelete | null
): ProcessedDelete | undefined {
  if (!del) {
    return undefined;
  }

  return {
    targetSentTimestamp: del.targetSentTimestamp?.toNumber(),
  };
}

export function processGiftBadge(
  giftBadge: Proto.DataMessage.IGiftBadge | null | undefined
): ProcessedGiftBadge | undefined {
  if (
    !giftBadge ||
    !giftBadge.receiptCredentialPresentation ||
    giftBadge.receiptCredentialPresentation.length === 0
  ) {
    return undefined;
  }

  const receipt = new ReceiptCredentialPresentation(
    Buffer.from(giftBadge.receiptCredentialPresentation)
  );

  return {
    expiration: Number(receipt.getReceiptExpirationTime()) * SECOND,
    id: undefined,
    level: Number(receipt.getReceiptLevel()),
    receiptCredentialPresentation: Bytes.toBase64(
      giftBadge.receiptCredentialPresentation
    ),
    state: GiftBadgeStates.Unopened,
  };
}

export async function processDataMessage(
  message: Proto.IDataMessage,
  envelopeTimestamp: number
): Promise<ProcessedDataMessage> {
  /* eslint-disable no-bitwise */

  // Now that its decrypted, validate the message and clean it up for consumer
  //   processing
  // Note that messages may (generally) only perform one action and we ignore remaining
  //   fields after the first action.

  if (!message.timestamp) {
    throw new Error('Missing timestamp on dataMessage');
  }

  const timestamp = message.timestamp?.toNumber();

  if (envelopeTimestamp !== timestamp) {
    throw new Error(
      `Timestamp ${timestamp} in DataMessage did not ` +
        `match envelope timestamp ${envelopeTimestamp}`
    );
  }

  const result: ProcessedDataMessage = {
    body: dropNull(message.body),
    attachments: (message.attachments ?? []).map(
      (attachment: Proto.IAttachmentPointer) => processAttachment(attachment)
    ),
    group: processGroupContext(message.group),
    groupV2: processGroupV2Context(message.groupV2),
    flags: message.flags ?? 0,
    expireTimer: message.expireTimer ?? 0,
    profileKey:
      message.profileKey && message.profileKey.length > 0
        ? Bytes.toBase64(message.profileKey)
        : undefined,
    timestamp,
    quote: processQuote(message.quote),
    contact: processContact(message.contact),
    preview: processPreview(message.preview),
    sticker: processSticker(message.sticker),
    requiredProtocolVersion: dropNull(message.requiredProtocolVersion),
    isViewOnce: Boolean(message.isViewOnce),
    reaction: processReaction(message.reaction),
    delete: processDelete(message.delete),
    bodyRanges: message.bodyRanges ?? [],
    groupCallUpdate: dropNull(message.groupCallUpdate),
    storyContext: dropNull(message.storyContext),
    giftBadge: processGiftBadge(message.giftBadge),
  };

  const isEndSession = Boolean(result.flags & FLAGS.END_SESSION);
  const isExpirationTimerUpdate = Boolean(
    result.flags & FLAGS.EXPIRATION_TIMER_UPDATE
  );
  const isProfileKeyUpdate = Boolean(result.flags & FLAGS.PROFILE_KEY_UPDATE);
  // The following assertion codifies an assumption: 0 or 1 flags are set, but never
  //   more. This assumption is fine as of this writing, but may not always be.
  const flagCount = [
    isEndSession,
    isExpirationTimerUpdate,
    isProfileKeyUpdate,
  ].filter(Boolean).length;
  assert(
    flagCount <= 1,
    `Expected exactly <=1 flags to be set, but got ${flagCount}`
  );

  if (isEndSession) {
    result.body = undefined;
    result.attachments = [];
    result.group = undefined;
    return result;
  }

  if (isExpirationTimerUpdate) {
    result.body = undefined;
    result.attachments = [];
  } else if (isProfileKeyUpdate) {
    result.body = undefined;
    result.attachments = [];
  } else if (result.flags !== 0) {
    throw new Error(`Unknown flags in message: ${result.flags}`);
  }

  if (result.group) {
    switch (result.group.type) {
      case Proto.GroupContext.Type.UPDATE:
        result.body = undefined;
        result.attachments = [];
        break;
      case Proto.GroupContext.Type.QUIT:
        result.body = undefined;
        result.attachments = [];
        break;
      case Proto.GroupContext.Type.DELIVER:
        // Cleaned up in `processGroupContext`
        break;
      default: {
        throw new WarnOnlyError(
          `Unknown group message type: ${result.group.type}`
        );
      }
    }
  }

  const attachmentCount = result.attachments.length;
  if (attachmentCount > ATTACHMENT_MAX) {
    throw new Error(
      `Too many attachments: ${attachmentCount} included in one message, ` +
        `max is ${ATTACHMENT_MAX}`
    );
  }

  return result;
}
