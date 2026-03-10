// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ReceiptCredentialPresentation } from '@signalapp/libsignal-client/zkgroup.js';
import lodash from 'lodash';

import { assertDev, strictAssert } from '../util/assert.std.js';
import { dropNull } from '../util/dropNull.std.js';
import {
  fromAciUuidBytes,
  fromAciUuidBytesOrString,
} from '../util/ServiceId.node.js';
import { getTimestampFromLong } from '../util/timestampLongUtils.std.js';
import { isKnownProtoEnumMember } from '../util/isKnownProtoEnumMember.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { deriveGroupFields } from '../groups.preload.js';
import * as Bytes from '../Bytes.std.js';

import type {
  ProcessedAttachment,
  ProcessedDataMessage,
  ProcessedGroupV2Context,
  ProcessedQuote,
  ProcessedContact,
  ProcessedPreview,
  ProcessedSticker,
  ProcessedReaction,
  ProcessedPollCreate,
  ProcessedPollVote,
  ProcessedPollTerminate,
  ProcessedDelete,
  ProcessedAdminDelete,
  ProcessedGiftBadge,
  ProcessedStoryContext,
  ProcessedPinMessage,
  ProcessedUnpinMessage,
} from './Types.d.ts';
import { GiftBadgeStates } from '../types/GiftBadgeStates.std.js';
import type { RawBodyRange } from '../types/BodyRange.std.js';
import {
  APPLICATION_OCTET_STREAM,
  stringToMIMEType,
} from '../types/MIME.std.js';
import {
  SECOND,
  DurationInSeconds,
  HOUR,
} from '../util/durations/index.std.js';
import type { AnyPaymentEvent } from '../types/Payment.std.js';
import { PaymentEventKind } from '../types/Payment.std.js';
import { filterAndClean } from '../util/BodyRange.node.js';
import { bytesToUuid } from '../util/uuidToBytes.std.js';
import { createName } from '../util/attachmentPath.node.js';
import { partitionBodyAndNormalAttachments } from '../util/Attachment.std.js';
import { isNotNil } from '../util/isNotNil.std.js';
import { createLogger } from '../logging/log.std.js';

import { toNumber } from '../util/toNumber.std.js';

const { isNumber } = lodash;

const log = createLogger('processDataMessage');

const FLAGS = Proto.DataMessage.Flags;
export const ATTACHMENT_MAX = 32;

export function processAttachment(
  attachment: Proto.AttachmentPointer
): ProcessedAttachment;
export function processAttachment(
  attachment?: Proto.AttachmentPointer | null
): ProcessedAttachment | undefined;

export function processAttachment(
  attachment?: Proto.AttachmentPointer | null
): ProcessedAttachment | undefined {
  if (attachment == null) {
    return undefined;
  }

  const {
    cdnNumber,
    attachmentIdentifier,
    clientUuid,
    key,
    size,
    contentType,
    digest,
    incrementalMac,
    chunkSize,
    fileName,
    flags,
    width,
    height,
    caption,
    blurHash,
  } = attachment;

  if (!isNumber(size)) {
    throw new Error('Missing size on incoming attachment!');
  }

  let uploadTimestamp: number | undefined =
    toNumber(attachment.uploadTimestamp) ?? 0;

  // Make sure uploadTimestamp is not set to an obviously wrong future value (we use
  // uploadTimestamp to determine whether to re-use CDN pointers)
  if (uploadTimestamp && uploadTimestamp > Date.now() + 12 * HOUR) {
    log.warn('uploadTimestamp is in the future, dropping');
    uploadTimestamp = undefined;
  }

  return {
    cdnKey: attachmentIdentifier?.cdnKey,
    cdnNumber: cdnNumber ?? 0,
    chunkSize: chunkSize ?? 0,
    fileName: fileName ?? '',
    flags: flags ?? 0,
    width: width ?? 0,
    height: height ?? 0,
    caption: caption ?? '',
    blurHash: blurHash ?? '',
    uploadTimestamp,
    cdnId:
      attachmentIdentifier?.cdnId === 0n
        ? undefined
        : attachmentIdentifier?.cdnId?.toString(),
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
  groupV2?: Proto.GroupContextV2 | null
): ProcessedGroupV2Context | undefined {
  if (!groupV2) {
    return undefined;
  }

  strictAssert(groupV2.masterKey, 'groupV2 context without masterKey');
  const data = deriveGroupFields(groupV2.masterKey);

  return {
    masterKey: Bytes.toBase64(groupV2.masterKey),
    revision: groupV2.revision ?? 0,
    groupChange: groupV2.groupChange
      ? Bytes.toBase64(groupV2.groupChange)
      : undefined,
    id: Bytes.toBase64(data.id),
    secretParams: Bytes.toBase64(data.secretParams),
    publicParams: Bytes.toBase64(data.publicParams),
  };
}

export function processPayment(
  payment?: Proto.DataMessage.Payment | null
): AnyPaymentEvent | undefined {
  if (!payment) {
    return undefined;
  }

  if (payment.Item?.notification != null) {
    return {
      kind: PaymentEventKind.Notification,
      note: payment.Item.notification.note ?? null,
    };
  }

  if (payment.Item?.activation != null) {
    if (
      payment.Item.activation.type ===
      Proto.DataMessage.Payment.Activation.Type.REQUEST
    ) {
      return { kind: PaymentEventKind.ActivationRequest };
    }
    if (
      payment.Item.activation.type ===
      Proto.DataMessage.Payment.Activation.Type.ACTIVATED
    ) {
      return { kind: PaymentEventKind.Activation };
    }
  }

  return undefined;
}

export function processQuote(
  quote?: Proto.DataMessage.Quote | null
): ProcessedQuote | undefined {
  if (!quote) {
    return undefined;
  }

  const { authorAci: rawAuthorAci, authorAciBinary } = quote;
  const authorAci = fromAciUuidBytesOrString(
    authorAciBinary,
    rawAuthorAci,
    'Quote.authorAci'
  );

  return {
    id: toNumber(quote.id) ?? 0,
    authorAci,
    text: quote.text ?? '',
    attachments: (quote.attachments ?? []).slice(0, 1).map(attachment => {
      return {
        contentType: attachment.contentType
          ? stringToMIMEType(attachment.contentType)
          : APPLICATION_OCTET_STREAM,
        fileName: attachment.fileName ?? '',
        thumbnail: processAttachment(attachment.thumbnail),
      };
    }),
    bodyRanges: filterAndClean(
      quote.bodyRanges.map(processBodyRange).filter(isNotNil)
    ),
    type: isKnownProtoEnumMember(Proto.DataMessage.Quote.Type, quote.type)
      ? quote.type
      : Proto.DataMessage.Quote.Type.NORMAL,
  };
}

export function processStoryContext(
  storyContext?: Proto.DataMessage.StoryContext | null
): ProcessedStoryContext | undefined {
  if (!storyContext) {
    return undefined;
  }

  const {
    authorAci: rawAuthorAci,
    authorAciBinary,
    sentTimestamp,
  } = storyContext;
  const authorAci = fromAciUuidBytesOrString(
    authorAciBinary,
    rawAuthorAci,
    'StoryContext.authorAci'
  );

  return {
    authorAci,
    sentTimestamp: getTimestampFromLong(sentTimestamp),
  };
}

export function processContact(
  contact?: ReadonlyArray<Proto.DataMessage.Contact> | null
): ReadonlyArray<ProcessedContact> | undefined {
  if (!contact) {
    return undefined;
  }

  return contact.slice(0, 1).map(item => {
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

function cleanLinkPreviewDate(value?: bigint | null): number | undefined {
  const result = toNumber(value);
  return isLinkPreviewDateValid(result) ? result : undefined;
}

export function processPreview(
  preview?: ReadonlyArray<Proto.Preview> | null
): ReadonlyArray<ProcessedPreview> | undefined {
  if (!preview) {
    return undefined;
  }

  return preview.slice(0, 1).map(item => {
    return {
      url: item.url ?? '',
      title: item.title ?? '',
      image: item.image ? processAttachment(item.image) : undefined,
      description: item.description ?? '',
      date: cleanLinkPreviewDate(item.date),
    };
  });
}

export function processSticker(
  sticker?: Proto.DataMessage.Sticker | null
): ProcessedSticker | undefined {
  if (!sticker) {
    return undefined;
  }

  return {
    packId: sticker.packId ? Bytes.toHex(sticker.packId) : undefined,
    packKey: sticker.packKey ? Bytes.toBase64(sticker.packKey) : undefined,
    stickerId: sticker.stickerId ?? 0,
    emoji: sticker.emoji ?? '',
    data: processAttachment(sticker.data),
  };
}

export function processReaction(
  reaction?: Proto.DataMessage.Reaction | null
): ProcessedReaction | undefined {
  if (!reaction) {
    return undefined;
  }

  const { targetAuthorAci: rawTargetAuthorAci, targetAuthorAciBinary } =
    reaction;
  const targetAuthorAci = fromAciUuidBytesOrString(
    targetAuthorAciBinary,
    rawTargetAuthorAci,
    'Reaction.targetAuthorAci'
  );

  return {
    emoji: reaction.emoji ?? '',
    remove: Boolean(reaction.remove),
    targetAuthorAci,
    targetTimestamp: toNumber(reaction.targetSentTimestamp) ?? 0,
  };
}

export function processPinMessage(
  pinMessage?: Proto.DataMessage.PinMessage | null
): ProcessedPinMessage | undefined {
  if (pinMessage == null) {
    return undefined;
  }

  const targetSentTimestamp = toNumber(pinMessage.targetSentTimestamp);
  strictAssert(targetSentTimestamp, 'Missing targetSentTimestamp');

  const targetAuthorAci = fromAciUuidBytes(pinMessage.targetAuthorAciBinary);
  strictAssert(targetAuthorAci, 'Missing targetAuthorAciBinary');

  let pinDuration: DurationInSeconds | null;
  if (pinMessage.pinDuration?.pinDurationForever) {
    pinDuration = null;
  } else {
    strictAssert(
      pinMessage.pinDuration?.pinDurationSeconds,
      'Missing pinDurationSeconds'
    );
    pinDuration = DurationInSeconds.fromSeconds(
      pinMessage.pinDuration.pinDurationSeconds
    );
  }

  return {
    targetSentTimestamp,
    targetAuthorAci,
    pinDuration,
  };
}

export function processPollCreate(
  pollCreate?: Proto.DataMessage.PollCreate | null
): ProcessedPollCreate | undefined {
  if (!pollCreate) {
    return undefined;
  }

  return {
    question: pollCreate.question ?? '',
    options: pollCreate.options?.filter(isNotNil) || [],
    allowMultiple: Boolean(pollCreate.allowMultiple),
  };
}

export function processPollVote(
  pollVote?: Proto.DataMessage.PollVote | null
): ProcessedPollVote | undefined {
  if (!pollVote) {
    return undefined;
  }

  const targetAuthorAci = fromAciUuidBytesOrString(
    pollVote.targetAuthorAciBinary,
    undefined,
    'PollVote.targetAuthorAci'
  );

  return {
    targetAuthorAci,
    targetTimestamp: toNumber(pollVote.targetSentTimestamp) ?? 0,
    optionIndexes: pollVote.optionIndexes?.filter(isNotNil) || [],
    voteCount: pollVote.voteCount || 0,
  };
}

export function processPollTerminate(
  pollTerminate?: Proto.DataMessage.PollTerminate | null
): ProcessedPollTerminate | undefined {
  if (!pollTerminate) {
    return undefined;
  }

  return {
    targetTimestamp: toNumber(pollTerminate.targetSentTimestamp) ?? 0,
  };
}

export function processDelete(
  del?: Proto.DataMessage.Delete | null
): ProcessedDelete | undefined {
  if (!del) {
    return undefined;
  }

  return {
    targetSentTimestamp: toNumber(del.targetSentTimestamp) ?? 0,
  };
}

export function processAdminDelete(
  adminDelete?: Proto.DataMessage.AdminDelete | null
): ProcessedAdminDelete | undefined {
  if (!adminDelete) {
    return undefined;
  }

  const targetSentTimestamp = toNumber(adminDelete.targetSentTimestamp);
  strictAssert(targetSentTimestamp, 'AdminDelete missing targetSentTimestamp');

  const targetAuthorAci = fromAciUuidBytes(adminDelete.targetAuthorAciBinary);
  strictAssert(targetAuthorAci, 'AdminDelete missing targetAuthorAciBinary');

  return {
    targetSentTimestamp,
    targetAuthorAci,
  };
}

export function processGiftBadge(
  giftBadge: Proto.DataMessage.GiftBadge | null | undefined
): ProcessedGiftBadge | undefined {
  if (
    !giftBadge ||
    !giftBadge.receiptCredentialPresentation ||
    giftBadge.receiptCredentialPresentation.length === 0
  ) {
    return undefined;
  }

  const receipt = new ReceiptCredentialPresentation(
    giftBadge.receiptCredentialPresentation
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

export function processUnpinMessage(
  unpinMessage?: Proto.DataMessage.UnpinMessage | null
): ProcessedUnpinMessage | undefined {
  if (unpinMessage == null) {
    return undefined;
  }

  const targetSentTimestamp = toNumber(unpinMessage.targetSentTimestamp);
  strictAssert(targetSentTimestamp, 'Missing targetSentTimestamp');

  const targetAuthorAci = fromAciUuidBytes(unpinMessage.targetAuthorAciBinary);
  strictAssert(targetAuthorAci, 'Missing targetAuthorAciBinary');

  return {
    targetSentTimestamp,
    targetAuthorAci,
  };
}

export function processDataMessage(
  message: Proto.DataMessage,
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

  const timestamp = toNumber(message.timestamp);

  if (envelopeTimestamp !== timestamp) {
    throw new Error(
      `Timestamp ${timestamp} in DataMessage did not ` +
        `match envelope timestamp ${envelopeTimestamp}`
    );
  }

  const processedAttachments = message.attachments
    ?.map((attachment: Proto.AttachmentPointer) => ({
      ...processAttachment(attachment),
      downloadPath: doCreateName(),
    }))
    .filter(isNotNil);

  const { bodyAttachment, attachments } = partitionBodyAndNormalAttachments(
    { attachments: processedAttachments ?? [] },
    { logId: `processDataMessage(${timestamp})` }
  );

  const result: ProcessedDataMessage = {
    body: message.body ?? '',
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
    requiredProtocolVersion: message.requiredProtocolVersion ?? 0,
    isViewOnce: Boolean(message.isViewOnce),
    reaction: processReaction(message.reaction),
    pinMessage: processPinMessage(message.pinMessage),
    pollCreate: processPollCreate(message.pollCreate),
    pollVote: processPollVote(message.pollVote),
    pollTerminate: processPollTerminate(message.pollTerminate),
    delete: processDelete(message.delete),
    adminDelete: processAdminDelete(message.adminDelete),
    bodyRanges: filterAndClean(
      message.bodyRanges.map(processBodyRange).filter(isNotNil)
    ),
    groupCallUpdate: dropNull(message.groupCallUpdate),
    storyContext: processStoryContext(message.storyContext),
    giftBadge: processGiftBadge(message.giftBadge),
    unpinMessage: processUnpinMessage(message.unpinMessage),
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

export function processBodyRange(
  proto: Proto.BodyRange
): RawBodyRange | undefined {
  if (proto.associatedValue == null) {
    return undefined;
  }
  if (proto.associatedValue.style) {
    return {
      start: proto.start ?? 0,
      length: proto.length ?? 0,
      style: isKnownProtoEnumMember(
        Proto.BodyRange.Style,
        proto.associatedValue.style
      )
        ? proto.associatedValue.style
        : 0,
    };
  }

  const mentionAci = fromAciUuidBytesOrString(
    proto.associatedValue.mentionAciBinary,
    proto.associatedValue.mentionAci,
    'BodyRange.mentionAci'
  );
  strictAssert(mentionAci != null, 'Expected mentionAci');

  return {
    start: proto.start ?? 0,
    length: proto.length ?? 0,
    mentionAci,
  };
}
