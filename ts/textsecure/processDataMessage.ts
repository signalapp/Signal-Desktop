// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import { ReceiptCredentialPresentation } from '@signalapp/libsignal-client/zkgroup';
import { isNumber } from 'lodash';

import { assertDev, strictAssert } from '../util/assert';
import { dropNull, shallowDropNull } from '../util/dropNull';
import { SignalService as Proto } from '../protobuf';
import { deriveGroupFields } from '../groups';
import * as Bytes from '../Bytes';

import type {
  ProcessedAttachment,
  ProcessedDataMessage,
  ProcessedGroupV2Context,
  ProcessedQuote,
  ProcessedContact,
  ProcessedPreview,
  ProcessedSticker,
  ProcessedReaction,
  ProcessedDelete,
  ProcessedGiftBadge,
} from './Types.d';
import { GiftBadgeStates } from '../components/conversation/Message';
import { APPLICATION_OCTET_STREAM, stringToMIMEType } from '../types/MIME';
import { SECOND, DurationInSeconds } from '../util/durations';
import type { AnyPaymentEvent } from '../types/Payment';
import { PaymentEventKind } from '../types/Payment';
import { filterAndClean } from '../types/BodyRange';
import { isAciString } from '../util/isAciString';
import { normalizeAci } from '../util/normalizeAci';
import { bytesToUuid } from '../util/uuidToBytes';
import { createName } from '../util/attachmentPath';
import { partitionBodyAndNormalAttachments } from '../types/Attachment';
import { isNotNil } from '../util/isNotNil';

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

  const { clientUuid, contentType, digest, incrementalMac, key, size } =
    attachment;
  if (!isNumber(size)) {
    throw new Error('Missing size on incoming attachment!');
  }

  return {
    ...shallowDropNull(attachment),

    cdnId: hasCdnId ? String(cdnId) : undefined,
    clientUuid: Bytes.isNotEmpty(clientUuid)
      ? bytesToUuid(clientUuid)
      : undefined,
    contentType: contentType
      ? stringToMIMEType(contentType)
      : APPLICATION_OCTET_STREAM,
    digest: Bytes.isNotEmpty(digest) ? Bytes.toBase64(digest) : undefined,
    incrementalMac: Bytes.isNotEmpty(incrementalMac)
      ? Bytes.toBase64(incrementalMac)
      : undefined,
    key: Bytes.isNotEmpty(key) ? Bytes.toBase64(key) : undefined,
    size,
  };
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

export function processPayment(
  payment?: Proto.DataMessage.IPayment | null
): AnyPaymentEvent | undefined {
  if (!payment) {
    return undefined;
  }

  if (payment.notification != null) {
    return {
      kind: PaymentEventKind.Notification,
      note: payment.notification.note ?? null,
    };
  }

  if (payment.activation != null) {
    if (
      payment.activation.type ===
      Proto.DataMessage.Payment.Activation.Type.REQUEST
    ) {
      return { kind: PaymentEventKind.ActivationRequest };
    }
    if (
      payment.activation.type ===
      Proto.DataMessage.Payment.Activation.Type.ACTIVATED
    ) {
      return { kind: PaymentEventKind.Activation };
    }
  }

  return undefined;
}

export function processQuote(
  quote?: Proto.DataMessage.IQuote | null
): ProcessedQuote | undefined {
  if (!quote) {
    return undefined;
  }

  const { authorAci } = quote;
  if (!isAciString(authorAci)) {
    throw new Error('quote.authorAci is not an ACI string');
  }

  return {
    id: quote.id?.toNumber(),
    authorAci: normalizeAci(authorAci, 'Quote.authorAci'),
    text: dropNull(quote.text),
    attachments: (quote.attachments ?? []).map(attachment => {
      return {
        contentType: attachment.contentType
          ? stringToMIMEType(attachment.contentType)
          : APPLICATION_OCTET_STREAM,
        fileName: dropNull(attachment.fileName),
        thumbnail: processAttachment(attachment.thumbnail),
      };
    }),
    bodyRanges: filterAndClean(quote.bodyRanges),
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
  preview?: ReadonlyArray<Proto.IPreview> | null
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

  const { targetAuthorAci } = reaction;
  if (!isAciString(targetAuthorAci)) {
    throw new Error('reaction.targetAuthorAci is not an ACI string');
  }

  return {
    emoji: dropNull(reaction.emoji),
    remove: Boolean(reaction.remove),
    targetAuthorAci: normalizeAci(targetAuthorAci, 'Reaction.targetAuthorAci'),
    targetTimestamp: reaction.targetSentTimestamp?.toNumber(),
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

export function processDataMessage(
  message: Proto.IDataMessage,
  envelopeTimestamp: number,

  // Only for testing
  { _createName: doCreateName = createName } = {}
): ProcessedDataMessage {
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

  const processedAttachments = message.attachments
    ?.map((attachment: Proto.IAttachmentPointer) => ({
      ...processAttachment(attachment),
      downloadPath: doCreateName(),
    }))
    .filter(isNotNil);

  const { bodyAttachment, attachments } = partitionBodyAndNormalAttachments(
    { attachments: processedAttachments ?? [] },
    { logId: `processDataMessage(${timestamp})` }
  );

  const result: ProcessedDataMessage = {
    body: dropNull(message.body),
    bodyAttachment,
    attachments,
    groupV2: processGroupV2Context(message.groupV2),
    flags: message.flags ?? 0,
    expireTimer: DurationInSeconds.fromSeconds(message.expireTimer ?? 0),
    expireTimerVersion: message.expireTimerVersion ?? 0,
    profileKey:
      message.profileKey && message.profileKey.length > 0
        ? Bytes.toBase64(message.profileKey)
        : undefined,
    timestamp,
    payment: processPayment(message.payment),
    quote: processQuote(message.quote),
    contact: processContact(message.contact),
    preview: processPreview(message.preview),
    sticker: processSticker(message.sticker),
    requiredProtocolVersion: dropNull(message.requiredProtocolVersion),
    isViewOnce: Boolean(message.isViewOnce),
    reaction: processReaction(message.reaction),
    delete: processDelete(message.delete),
    bodyRanges: filterAndClean(message.bodyRanges),
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
  assertDev(
    flagCount <= 1,
    `Expected exactly <=1 flags to be set, but got ${flagCount}`
  );

  if (isEndSession) {
    result.body = undefined;
    result.attachments = [];
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

  const attachmentCount = result.attachments.length;
  if (attachmentCount > ATTACHMENT_MAX) {
    throw new Error(
      `Too many attachments: ${attachmentCount} included in one message, ` +
        `max is ${ATTACHMENT_MAX}`
    );
  }

  return result;
}
