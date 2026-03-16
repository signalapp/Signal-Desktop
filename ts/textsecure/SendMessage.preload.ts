// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-bitwise */
/* eslint-disable max-classes-per-file */

import { z } from 'zod';
import PQueue from 'p-queue';
import pMap from 'p-map';
import type { PlaintextContent } from '@signalapp/libsignal-client';
import {
  ContentHint,
  ProtocolAddress,
  SenderKeyDistributionMessage,
} from '@signalapp/libsignal-client';
import type { RequireExactlyOne } from 'type-fest';

import {
  GLOBAL_ZONE,
  signalProtocolStore,
} from '../SignalProtocolStore.preload.js';
import { DataWriter } from '../sql/Client.preload.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import { assertDev, strictAssert } from '../util/assert.std.js';
import { parseIntOrThrow } from '../util/parseIntOrThrow.std.js';
import { uuidToBytes } from '../util/uuidToBytes.std.js';
import { Address } from '../types/Address.std.js';
import { QualifiedAddress } from '../types/QualifiedAddress.std.js';
import type { StoryMessageRecipientsType } from '../types/Stories.std.js';
import { SenderKeys } from '../LibSignalStores.preload.js';
import type {
  TextAttachmentType,
  UploadedAttachmentType,
} from '../types/Attachment.std.js';
import type { AciString, ServiceIdString } from '../types/ServiceId.std.js';
import {
  ServiceIdKind,
  serviceIdSchema,
  isPniString,
} from '../types/ServiceId.std.js';
import {
  toAciObject,
  toPniObject,
  toServiceIdObject,
} from '../util/ServiceId.node.js';
import createTaskWithTimeout from './TaskWithTimeout.std.js';
import type { CallbackResultType } from './Types.d.ts';
import type {
  SerializedCertificateType,
  SendLogCallbackType,
} from './OutgoingMessage.preload.js';
import OutgoingMessage from './OutgoingMessage.preload.js';
import * as Bytes from '../Bytes.std.js';
import { getRandomBytes } from '../Crypto.node.js';
import { SendMessageProtoError, NoSenderKeyError } from './Errors.std.js';
import { BodyRange } from '../types/BodyRange.std.js';
import type { RawBodyRange } from '../types/BodyRange.std.js';
import type { StoryContextType } from '../types/Util.std.js';
import { concat, isEmpty } from '../util/iterables.std.js';
import type { SendTypesType } from '../util/handleMessageSend.preload.js';
import {
  shouldSaveProto,
  sendTypesEnum,
} from '../util/handleMessageSend.preload.js';
import type { DurationInSeconds } from '../util/durations/index.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { createLogger } from '../logging/log.std.js';
import type { EmbeddedContactWithUploadedAvatar } from '../types/EmbeddedContact.std.js';
import {
  numberToPhoneType,
  numberToEmailType,
  numberToAddressType,
} from '../types/EmbeddedContact.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { drop } from '../util/drop.std.js';
import type {
  ConversationIdentifier,
  DeleteForMeSyncEventData,
  DeleteMessageSyncTarget,
  AddressableMessage,
} from './messageReceiverEvents.std.js';
import { getConversationFromTarget } from '../util/syncIdentifiers.preload.js';
import type {
  CallDetails,
  CallHistoryDetails,
} from '../types/CallDisposition.std.js';
import {
  AdhocCallStatus,
  DirectCallStatus,
  GroupCallStatus,
  CallMode,
} from '../types/CallDisposition.std.js';
import {
  getBytesForPeerId,
  getCallIdForProto,
  getProtoForCallHistory,
} from '../util/callDisposition.preload.js';
import { MAX_MESSAGE_COUNT } from '../util/deleteForMe.types.std.js';
import { isProtoBinaryEncodingEnabled } from '../util/isProtoBinaryEncodingEnabled.dom.js';
import type { GroupSendToken } from '../types/GroupSendEndorsements.std.js';
import type { OutgoingPollVote, PollCreateType } from '../types/Polls.dom.js';
import { itemStorage } from './Storage.preload.js';
import { accountManager } from './AccountManager.preload.js';
import type {
  SendPinMessageType,
  SendUnpinMessageType,
} from '../types/PinnedMessage.std.js';

const log = createLogger('SendMessage');

const MAX_EMBEDDED_GROUP_CHANGE_BYTES = 2048;

export type SendIdentifierData =
  | {
      accessKey: string;
      senderCertificate: SerializedCertificateType | null;
      groupSendToken: null;
    }
  | {
      accessKey: null;
      senderCertificate: SerializedCertificateType | null;
      groupSendToken: GroupSendToken;
    };

export type SendMetadataType = {
  [serviceId: ServiceIdString]: SendIdentifierData;
};

export type SendOptionsType = {
  sendMetadata?: SendMetadataType;
  online?: boolean;
};

export type OutgoingQuoteAttachmentType = Readonly<{
  contentType: string;
  fileName?: string;
  thumbnail?: UploadedAttachmentType;
}>;

export type OutgoingQuoteType = Readonly<{
  isGiftBadge?: boolean;
  id?: number;
  authorAci?: AciString;
  text?: string;
  attachments: ReadonlyArray<OutgoingQuoteAttachmentType>;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
}>;

export type OutgoingLinkPreviewType = Readonly<{
  title?: string;
  description?: string;
  domain?: string;
  url: string;
  isStickerPack?: boolean;
  image?: Readonly<UploadedAttachmentType>;
  date?: number;
}>;

export type OutgoingTextAttachmentType = Omit<TextAttachmentType, 'preview'> & {
  preview?: OutgoingLinkPreviewType;
};

export type GroupV2InfoType = {
  groupChange?: Uint8Array;
  masterKey: Uint8Array;
  revision: number;
  members: ReadonlyArray<ServiceIdString>;
};

type GroupCallUpdateType = {
  eraId: string;
};

export type OutgoingStickerType = Readonly<{
  packId: string;
  packKey: string;
  stickerId: number;
  emoji?: string;
  data: Readonly<UploadedAttachmentType>;
}>;

export type ReactionType = {
  emoji?: string;
  remove?: boolean;
  targetAuthorAci?: AciString;
  targetTimestamp?: number;
};

export const singleProtoJobDataSchema = z.object({
  contentHint: z.number(),
  serviceId: serviceIdSchema,
  isSyncMessage: z.boolean(),
  messageIds: z.array(z.string()).optional(),
  protoBase64: z.string(),
  type: sendTypesEnum,
  urgent: z.boolean().optional(),
});

export type SingleProtoJobData = z.infer<typeof singleProtoJobDataSchema>;

export type SendDeleteForEveryoneType = Readonly<{
  isAdminDelete: boolean;
  targetSentTimestamp: number;
  targetAuthorAci: AciString;
}>;

export type SharedMessageOptionsType = Readonly<{
  // required
  timestamp: number;
  // optional
  attachments?: ReadonlyArray<Proto.AttachmentPointer.Params>;
  body?: string;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
  contact?: ReadonlyArray<EmbeddedContactWithUploadedAvatar>;
  deleteForEveryone?: SendDeleteForEveryoneType;
  expireTimer?: DurationInSeconds;
  flags?: number;
  groupCallUpdate?: GroupCallUpdateType;
  groupV2?: GroupV2InfoType;
  isViewOnce?: boolean;
  pinMessage?: SendPinMessageType;
  pollCreate?: PollCreateType;
  preview?: ReadonlyArray<OutgoingLinkPreviewType>;
  profileKey?: Uint8Array;
  quote?: OutgoingQuoteType;
  reaction?: ReactionType;
  sticker?: OutgoingStickerType;
  storyContext?: StoryContextType;
  targetTimestampForEdit?: number;
  unpinMessage?: SendUnpinMessageType;
}>;

export type MessageOptionsType = Readonly<
  SharedMessageOptionsType & {
    // Not needed for group messages, lives in group state
    expireTimerVersion?: number | undefined;
    recipients: ReadonlyArray<ServiceIdString>;
  }
>;

export type GroupMessageOptionsType = Readonly<
  SharedMessageOptionsType & {
    groupV2: GroupV2InfoType;
  }
>;

export type PollVoteBuildOptions = Readonly<{
  timestamp: number;
  pollVote: OutgoingPollVote;
}> &
  Pick<
    MessageOptionsType,
    'groupV2' | 'profileKey' | 'expireTimer' | 'expireTimerVersion'
  >;

export type PollTerminateBuildOptions = Readonly<{
  timestamp: number;
  pollTerminate: Readonly<{
    targetTimestamp: number;
  }>;
}> &
  Pick<
    MessageOptionsType,
    'groupV2' | 'profileKey' | 'expireTimer' | 'expireTimerVersion'
  >;

class Message {
  attachments: ReadonlyArray<Proto.AttachmentPointer.Params>;

  body?: string;

  bodyRanges?: ReadonlyArray<RawBodyRange>;

  contact?: ReadonlyArray<EmbeddedContactWithUploadedAvatar>;

  expireTimer?: DurationInSeconds;

  expireTimerVersion?: number;

  flags?: number;

  groupV2?: GroupV2InfoType;

  isViewOnce?: boolean;

  preview?: ReadonlyArray<OutgoingLinkPreviewType>;

  profileKey?: Uint8Array;

  quote?: OutgoingQuoteType;

  recipients: ReadonlyArray<ServiceIdString>;

  sticker?: OutgoingStickerType;

  reaction?: ReactionType;

  pollCreate?: PollCreateType;

  pollTerminate?: Readonly<{
    targetTimestamp: number;
  }>;

  pinMessage?: SendPinMessageType;
  unpinMessage?: SendUnpinMessageType;

  timestamp: number;

  dataMessage?: Proto.DataMessage.Params;

  deleteForEveryone?: SendDeleteForEveryoneType;

  groupCallUpdate?: GroupCallUpdateType;

  storyContext?: StoryContextType;

  pollVote?: OutgoingPollVote;

  constructor(options: MessageOptionsType) {
    this.attachments = options.attachments || [];
    this.body = options.body;
    this.bodyRanges = options.bodyRanges;
    this.contact = options.contact;
    this.expireTimer = options.expireTimer;
    this.expireTimerVersion = options.expireTimerVersion;
    this.flags = options.flags;
    this.groupV2 = options.groupV2;
    this.isViewOnce = options.isViewOnce;
    this.preview = options.preview;
    this.profileKey = options.profileKey;
    this.quote = options.quote;
    this.recipients = options.recipients;
    this.sticker = options.sticker;
    this.reaction = options.reaction;
    this.pollCreate = options.pollCreate;
    this.timestamp = options.timestamp;
    this.deleteForEveryone = options.deleteForEveryone;
    this.groupCallUpdate = options.groupCallUpdate;
    this.storyContext = options.storyContext;
    this.pinMessage = options.pinMessage;
    this.unpinMessage = options.unpinMessage;

    if (!(this.recipients instanceof Array)) {
      throw new Error('Invalid recipient list');
    }

    if (!this.groupV2 && this.recipients.length !== 1) {
      throw new Error('Invalid recipient list for non-group');
    }

    if (typeof this.timestamp !== 'number') {
      throw new Error('Invalid timestamp');
    }

    if (this.expireTimer != null) {
      if (typeof this.expireTimer !== 'number' || !(this.expireTimer >= 0)) {
        throw new Error('Invalid expireTimer');
      }
    }

    if (this.attachments) {
      if (!(this.attachments instanceof Array)) {
        throw new Error('Invalid message attachments');
      }
    }
    if (this.flags !== undefined) {
      if (typeof this.flags !== 'number') {
        throw new Error('Invalid message flags');
      }
    }
    if (this.isEndSession()) {
      if (this.body != null || this.attachments.length !== 0) {
        throw new Error('Invalid end session message');
      }
    } else if (
      typeof this.timestamp !== 'number' ||
      (this.body && typeof this.body !== 'string')
    ) {
      throw new Error('Invalid message body');
    }
  }

  isEndSession() {
    return (this.flags || 0) & Proto.DataMessage.Flags.END_SESSION;
  }

  toProto(): Proto.DataMessage.Params {
    if (this.dataMessage) {
      return this.dataMessage;
    }

    let requiredProtocolVersion = 0;

    if (this.body) {
      const mentionCount = this.bodyRanges
        ? this.bodyRanges.filter(BodyRange.isMention).length
        : 0;
      const otherRangeCount = this.bodyRanges
        ? this.bodyRanges.length - mentionCount
        : 0;
      const placeholders = this.body.match(/\uFFFC/g);
      const placeholderCount = placeholders ? placeholders.length : 0;
      const storyInfo = this.storyContext
        ? `, story: ${this.storyContext.timestamp}`
        : '';
      log.info(
        `Sending a message with ${mentionCount} mentions, ` +
          `${placeholderCount} placeholders, ` +
          `and ${otherRangeCount} other ranges${storyInfo}`
      );
    }

    if (
      this.groupV2?.groupChange &&
      this.groupV2.groupChange.byteLength > MAX_EMBEDDED_GROUP_CHANGE_BYTES
    ) {
      // As a message-size optimization, we do not embed large updates and receiving
      // devices fetch them from the group server instead
      log.info(
        'Discarding oversized group change proto ' +
          `(${this.groupV2.groupChange.byteLength} bytes)`
      );
    }

    let contact: Array<Proto.DataMessage.Contact.Params> | null = null;
    if (Array.isArray(this.contact)) {
      contact = this.contact.map(
        (contactEntry: EmbeddedContactWithUploadedAvatar) => {
          let name: Proto.DataMessage.Contact.Name.Params | null = null;
          if (contactEntry.name) {
            name = {
              givenName: contactEntry.name.givenName ?? null,
              familyName: contactEntry.name.familyName ?? null,
              prefix: contactEntry.name.prefix ?? null,
              suffix: contactEntry.name.suffix ?? null,
              middleName: contactEntry.name.middleName ?? null,
              nickname: contactEntry.name.nickname ?? null,
            };
          }
          let number: Array<Proto.DataMessage.Contact.Phone.Params> | null =
            null;
          if (Array.isArray(contactEntry.number)) {
            number = contactEntry.number.map(
              (entry): Proto.DataMessage.Contact.Phone.Params => {
                return {
                  value: entry.value,
                  type: numberToPhoneType(entry.type),
                  label: entry.label,
                };
              }
            );
          }
          let email: Array<Proto.DataMessage.Contact.Email.Params> | null =
            null;
          if (Array.isArray(contactEntry.email)) {
            email = contactEntry.email.map(
              (entry): Proto.DataMessage.Contact.Email.Params => {
                return {
                  value: entry.value,
                  type: numberToEmailType(entry.type),
                  label: entry.label,
                };
              }
            );
          }
          let address: Array<Proto.DataMessage.Contact.PostalAddress.Params> | null =
            null;
          if (Array.isArray(contactEntry.address)) {
            address = contactEntry.address.map(
              (entry): Proto.DataMessage.Contact.PostalAddress.Params => {
                return {
                  type: numberToAddressType(entry.type),
                  label: entry.label,
                  street: entry.street,
                  pobox: entry.pobox,
                  neighborhood: entry.neighborhood,
                  city: entry.city,
                  region: entry.region,
                  postcode: entry.postcode,
                  country: entry.country,
                };
              }
            );
          }
          let avatar: Proto.DataMessage.Contact.Avatar.Params | null = null;
          if (contactEntry.avatar?.avatar) {
            avatar = {
              avatar: contactEntry.avatar.avatar,
              isProfile: Boolean(contactEntry.avatar.isProfile),
            };
          }

          let organization: string | null = null;
          if (contactEntry.organization) {
            organization = contactEntry.organization;
          }

          return {
            name,
            email,
            number,
            address,
            avatar,
            organization,
          };
        }
      );
    }

    let quote: Proto.DataMessage.Quote.Params | null = null;
    if (this.quote) {
      quote = {
        type: this.quote.isGiftBadge
          ? Proto.DataMessage.Quote.Type.GIFT_BADGE
          : Proto.DataMessage.Quote.Type.NORMAL,
        id: this.quote.id === undefined ? null : BigInt(this.quote.id),
        authorAciBinary:
          this.quote.authorAci && isProtoBinaryEncodingEnabled()
            ? toAciObject(this.quote.authorAci).getRawUuidBytes()
            : null,
        authorAci: isProtoBinaryEncodingEnabled()
          ? null
          : (this.quote.authorAci ?? null),
        text: this.quote.text ?? null,
        attachments: this.quote.attachments.map(attachment => {
          return {
            contentType: attachment.contentType,
            fileName: attachment.fileName ?? null,
            thumbnail: attachment.thumbnail ?? null,
          };
        }),
        bodyRanges: this.quote.bodyRanges?.map(toBodyRange) ?? null,
      };

      if (quote?.bodyRanges?.length) {
        requiredProtocolVersion = Math.max(
          requiredProtocolVersion,
          Proto.DataMessage.ProtocolVersion.MENTIONS
        );
      }
    }

    let adminDelete: Proto.DataMessage.AdminDelete.Params | null = null;
    let del: Proto.DataMessage.Delete.Params | null = null;
    if (this.deleteForEveryone) {
      const { isAdminDelete, targetSentTimestamp, targetAuthorAci } =
        this.deleteForEveryone;
      if (isAdminDelete) {
        adminDelete = {
          targetSentTimestamp: BigInt(targetSentTimestamp),
          targetAuthorAciBinary: uuidToBytes(targetAuthorAci),
        };
      } else {
        del = {
          targetSentTimestamp: BigInt(targetSentTimestamp),
        };
      }
    }

    if (this.bodyRanges?.length) {
      requiredProtocolVersion = Math.max(
        requiredProtocolVersion,
        Proto.DataMessage.ProtocolVersion.MENTIONS
      );
    }

    let groupCallUpdate: Proto.DataMessage.GroupCallUpdate.Params | null = null;
    if (this.groupCallUpdate) {
      groupCallUpdate = {
        eraId: this.groupCallUpdate.eraId,
      };
    }

    let storyContext: Proto.DataMessage.StoryContext.Params | null = null;
    if (this.storyContext) {
      storyContext = {
        sentTimestamp: BigInt(this.storyContext.timestamp),
        authorAciBinary:
          this.storyContext.authorAci && isProtoBinaryEncodingEnabled()
            ? toAciObject(this.storyContext.authorAci).getRawUuidBytes()
            : null,
        authorAci: isProtoBinaryEncodingEnabled()
          ? null
          : (this.storyContext.authorAci ?? null),
      };
    }

    let pollCreate: Proto.DataMessage.PollCreate.Params | null = null;
    if (this.pollCreate) {
      pollCreate = {
        question: this.pollCreate.question,
        allowMultiple: Boolean(this.pollCreate.allowMultiple),
        options: this.pollCreate.options.slice(),
      };
      requiredProtocolVersion = Math.max(
        requiredProtocolVersion,
        Proto.DataMessage.ProtocolVersion.POLLS
      );
    }

    let pinMessage: Proto.DataMessage.PinMessage.Params | null = null;
    if (this.pinMessage != null) {
      const { targetAuthorAci, targetSentTimestamp, pinDurationSeconds } =
        this.pinMessage;

      pinMessage = {
        targetAuthorAciBinary: toAciObject(targetAuthorAci).getRawUuidBytes(),
        targetSentTimestamp: BigInt(targetSentTimestamp),
        pinDuration:
          pinDurationSeconds != null
            ? {
                pinDurationSeconds,
              }
            : {
                pinDurationForever: true,
              },
      };
    }

    let unpinMessage: Proto.DataMessage.UnpinMessage.Params | null = null;
    if (this.unpinMessage != null) {
      const { targetAuthorAci, targetSentTimestamp } = this.unpinMessage;

      unpinMessage = {
        targetAuthorAciBinary: toAciObject(targetAuthorAci).getRawUuidBytes(),
        targetSentTimestamp: BigInt(targetSentTimestamp),
      };
    }

    const dataMessage: Proto.DataMessage.Params = {
      timestamp: BigInt(this.timestamp),
      attachments: this.attachments.slice(),
      flags: this.flags ?? 0,
      body: this.body ?? null,
      bodyRanges: this.bodyRanges?.map(toBodyRange) ?? null,
      groupV2: this.groupV2
        ? {
            masterKey: this.groupV2.masterKey,
            revision: this.groupV2.revision,
            groupChange:
              this.groupV2.groupChange != null &&
              this.groupV2.groupChange.byteLength <
                MAX_EMBEDDED_GROUP_CHANGE_BYTES
                ? this.groupV2.groupChange
                : null,
          }
        : null,
      sticker: this.sticker
        ? ({
            packId: Bytes.fromHex(this.sticker.packId),
            packKey: Bytes.fromBase64(this.sticker.packKey),
            stickerId: this.sticker.stickerId,
            emoji: this.sticker.emoji ?? null,
            data: this.sticker.data,
          } satisfies Proto.DataMessage.Sticker.Params)
        : null,
      reaction: this.reaction
        ? ({
            emoji: this.reaction.emoji ?? null,
            remove: Boolean(this.reaction.remove),
            targetAuthorAciBinary:
              this.reaction.targetAuthorAci && isProtoBinaryEncodingEnabled()
                ? toAciObject(this.reaction.targetAuthorAci).getRawUuidBytes()
                : null,
            targetAuthorAci: isProtoBinaryEncodingEnabled()
              ? null
              : (this.reaction.targetAuthorAci ?? null),
            targetSentTimestamp:
              this.reaction.targetTimestamp == null
                ? null
                : BigInt(this.reaction.targetTimestamp),
          } satisfies Proto.DataMessage.Reaction.Params)
        : null,

      preview:
        this.preview?.map((preview): Proto.Preview.Params => {
          return {
            title: preview.title ?? null,
            url: preview.url,
            description: preview.description ?? null,
            date: preview.date ? BigInt(preview.date) : null,
            image: preview.image ?? null,
          };
        }) ?? null,

      contact,
      quote,
      adminDelete,
      delete: del,
      groupCallUpdate,
      storyContext,
      pollCreate,
      pinMessage,
      unpinMessage,

      // Handled separately
      pollVote: null,
      pollTerminate: null,

      expireTimer: this.expireTimer ?? null,
      expireTimerVersion: this.expireTimerVersion ?? null,
      profileKey: this.profileKey ?? null,
      isViewOnce: Boolean(this.isViewOnce),
      requiredProtocolVersion,

      payment: null,
      giftBadge: null,
    };
    this.dataMessage = dataMessage;
    return dataMessage;
  }
}

export type AddPniSignatureMessageToProtoOptionsType = Readonly<{
  conversation?: ConversationModel;
  proto: Proto.Content.Params;
  reason: string;
}>;

export function addPniSignatureMessageToProto({
  conversation,
  proto,
  reason,
}: AddPniSignatureMessageToProtoOptionsType): void {
  if (!conversation) {
    return;
  }

  const pniSignatureMessage = conversation?.getPniSignatureMessage();
  if (!pniSignatureMessage) {
    return;
  }

  log.info(
    `addPniSignatureMessageToProto(${reason}): ` +
      `adding pni signature for ${conversation.idForLogging()}`
  );

  // eslint-disable-next-line no-param-reassign
  proto.pniSignatureMessage = {
    pni: toPniObject(pniSignatureMessage.pni).getRawUuidBytes(),
    signature: pniSignatureMessage.signature,
  };
}

export class MessageSender {
  pendingMessages: {
    [id: string]: PQueue;
  };

  constructor() {
    this.pendingMessages = {};
  }

  async queueJobForServiceId<T>(
    serviceId: ServiceIdString,
    runJob: () => Promise<T>
  ): Promise<T> {
    const { id } = await window.ConversationController.getOrCreateAndWait(
      serviceId,
      'private'
    );
    this.pendingMessages[id] =
      this.pendingMessages[id] || new PQueue({ concurrency: 1 });

    const queue = this.pendingMessages[id];

    const taskWithTimeout = createTaskWithTimeout(
      runJob,
      `queueJobForServiceId ${serviceId} ${id}`
    );

    return queue.add(taskWithTimeout);
  }

  // Attachment upload functions

  static getRandomPadding(): Uint8Array {
    // Generate a random int from 1 and 512
    const buffer = getRandomBytes(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const paddingLength = (new Uint16Array(buffer)[0]! & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    return getRandomBytes(paddingLength);
  }

  // Proto assembly

  getTextAttachmentProto(
    attachmentAttrs: OutgoingTextAttachmentType
  ): Proto.TextAttachment.Params {
    const { preview, gradient } = attachmentAttrs;

    let background: Proto.TextAttachment.Params['background'];
    if (gradient) {
      background = {
        gradient: {
          startColor: gradient.startColor ?? null,
          endColor: gradient.endColor ?? null,
          angle: gradient.angle ?? null,
          colors: gradient.colors?.slice() ?? null,
          positions: gradient.positions?.slice() ?? null,
        },
      };
    } else if (attachmentAttrs.color) {
      background = {
        color: attachmentAttrs.color,
      };
    } else {
      background = null;
    }

    return {
      text: attachmentAttrs.text ?? null,
      textStyle: attachmentAttrs.textStyle
        ? Number(attachmentAttrs.textStyle)
        : 0,

      textForegroundColor: attachmentAttrs.textForegroundColor ?? null,
      textBackgroundColor: attachmentAttrs.textBackgroundColor ?? null,

      preview: preview
        ? {
            image: preview.image ?? null,
            title: preview.title ?? null,
            url: preview.url,
            description: null,
            date: null,
          }
        : null,

      background,
    };
  }

  async getDataOrEditMessage(
    options: Readonly<MessageOptionsType>
  ): Promise<Uint8Array> {
    const message = await this.getHydratedMessage(options);
    const dataMessage = message.toProto();

    if (options.targetTimestampForEdit) {
      return Proto.EditMessage.encode({
        dataMessage,
        targetSentTimestamp: BigInt(options.targetTimestampForEdit),
      });
    }
    return Proto.DataMessage.encode(dataMessage);
  }

  createDataMessageProtoForPollVote({
    groupV2,
    timestamp,
    profileKey,
    expireTimer,
    expireTimerVersion,
    pollVote,
  }: PollVoteBuildOptions): Proto.DataMessage.Params {
    return {
      timestamp: BigInt(timestamp),
      groupV2: groupV2
        ? {
            masterKey: groupV2.masterKey,
            revision: groupV2.revision,
            groupChange: null,
          }
        : null,
      expireTimer: expireTimer ?? null,
      expireTimerVersion: expireTimerVersion ?? null,
      profileKey: profileKey ?? null,
      pollVote: {
        targetAuthorAciBinary: toAciObject(
          pollVote.targetAuthorAci
        ).getRawUuidBytes(),
        targetSentTimestamp: BigInt(pollVote.targetTimestamp),
        optionIndexes: pollVote.optionIndexes.slice(),
        voteCount: pollVote.voteCount,
      },

      body: null,
      attachments: null,
      flags: null,
      quote: null,
      contact: null,
      preview: null,
      sticker: null,
      requiredProtocolVersion: null,
      isViewOnce: null,
      reaction: null,
      delete: null,
      bodyRanges: null,
      groupCallUpdate: null,
      payment: null,
      storyContext: null,
      giftBadge: null,
      pollCreate: null,
      pollTerminate: null,
      pinMessage: null,
      unpinMessage: null,
      adminDelete: null,
    };
  }

  async getPollVoteDataMessage({
    groupV2,
    timestamp,
    profileKey,
    expireTimer,
    expireTimerVersion,
    pollVote,
  }: PollVoteBuildOptions): Promise<Uint8Array> {
    const proto = this.createDataMessageProtoForPollVote({
      groupV2,
      timestamp,
      profileKey,
      expireTimer,
      expireTimerVersion,
      pollVote,
    });
    return Proto.DataMessage.encode(proto);
  }

  async getPollVoteContentMessage({
    groupV2,
    timestamp,
    profileKey,
    expireTimer,
    expireTimerVersion,
    pollVote,
  }: PollVoteBuildOptions): Promise<Proto.Content.Params> {
    const dataMessage = this.createDataMessageProtoForPollVote({
      groupV2,
      timestamp,
      profileKey,
      expireTimer,
      expireTimerVersion,
      pollVote,
    });
    return {
      content: {
        dataMessage,
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
  }

  createDataMessageProtoForPollTerminate({
    groupV2,
    timestamp,
    profileKey,
    expireTimer,
    expireTimerVersion,
    pollTerminate,
  }: PollTerminateBuildOptions): Proto.DataMessage.Params {
    return {
      timestamp: BigInt(timestamp),
      groupV2: groupV2
        ? {
            masterKey: groupV2.masterKey,
            revision: groupV2.revision,
            groupChange: null,
          }
        : null,
      expireTimer: expireTimer ?? null,
      expireTimerVersion: expireTimerVersion ?? null,
      profileKey: profileKey ?? null,
      pollTerminate: {
        targetSentTimestamp: BigInt(pollTerminate.targetTimestamp),
      },

      body: null,
      attachments: null,
      flags: null,
      quote: null,
      contact: null,
      preview: null,
      sticker: null,
      requiredProtocolVersion: null,
      isViewOnce: null,
      reaction: null,
      delete: null,
      bodyRanges: null,
      groupCallUpdate: null,
      payment: null,
      storyContext: null,
      giftBadge: null,
      pollCreate: null,
      pollVote: null,
      pinMessage: null,
      unpinMessage: null,
      adminDelete: null,
    };
  }

  async getPollTerminateContentMessage({
    groupV2,
    timestamp,
    profileKey,
    expireTimer,
    expireTimerVersion,
    pollTerminate,
  }: PollTerminateBuildOptions): Promise<Proto.Content.Params> {
    const dataMessage = this.createDataMessageProtoForPollTerminate({
      groupV2,
      timestamp,
      profileKey,
      expireTimer,
      expireTimerVersion,
      pollTerminate,
    });
    return {
      content: {
        dataMessage,
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
  }

  async getStoryMessage({
    allowsReplies,
    bodyRanges,
    fileAttachment,
    groupV2,
    profileKey,
    textAttachment,
  }: {
    allowsReplies?: boolean;
    bodyRanges?: Array<RawBodyRange>;
    fileAttachment?: UploadedAttachmentType;
    groupV2?: GroupV2InfoType;
    profileKey: Uint8Array;
    textAttachment?: OutgoingTextAttachmentType;
  }): Promise<Proto.StoryMessage.Params> {
    let attachment: Proto.StoryMessage.Params['attachment'];

    if (textAttachment) {
      attachment = {
        textAttachment: this.getTextAttachmentProto(textAttachment),
      };
    } else if (fileAttachment) {
      attachment = { fileAttachment };
    } else {
      attachment = null;
    }

    return {
      profileKey,
      allowsReplies: Boolean(allowsReplies),
      group: groupV2
        ? {
            masterKey: groupV2.masterKey,
            revision: groupV2.revision,
            groupChange: groupV2.groupChange ?? null,
          }
        : null,
      bodyRanges: fileAttachment
        ? (bodyRanges?.map(toBodyRange) ?? null)
        : null,
      attachment,
    };
  }

  async getContentMessage(
    options: Readonly<MessageOptionsType> &
      Readonly<{
        includePniSignatureMessage?: boolean;
      }>
  ): Promise<Proto.Content.Params> {
    const message = await this.getHydratedMessage(options);
    const dataMessage = message.toProto();

    const contentMessage: Proto.Content.Params = options.targetTimestampForEdit
      ? {
          content: {
            editMessage: {
              dataMessage,
              targetSentTimestamp: BigInt(options.targetTimestampForEdit),
            },
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        }
      : {
          content: {
            dataMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        };

    const { includePniSignatureMessage } = options;
    if (includePniSignatureMessage) {
      strictAssert(
        message.recipients.length === 1,
        'getContentMessage: includePniSignatureMessage is single recipient only'
      );

      const conversation = window.ConversationController.get(
        message.recipients[0]
      );

      addPniSignatureMessageToProto({
        conversation,
        proto: contentMessage,
        reason: `getContentMessage(${message.timestamp})`,
      });
    }

    return contentMessage;
  }

  async getHydratedMessage(
    attributes: Readonly<MessageOptionsType>
  ): Promise<Message> {
    const message = new Message(attributes);

    return message;
  }

  getTypingContentMessage(
    options: Readonly<{
      recipientId?: ServiceIdString;
      groupId?: Uint8Array;
      groupMembers: ReadonlyArray<ServiceIdString>;
      isTyping: boolean;
      timestamp?: number;
    }>
  ): Proto.Content.Params {
    const ACTION_ENUM = Proto.TypingMessage.Action;
    const { recipientId, groupId, isTyping, timestamp } = options;

    if (!recipientId && !groupId) {
      throw new Error(
        'getTypingContentMessage: Need to provide either recipientId or groupId!'
      );
    }

    const finalTimestamp = timestamp || Date.now();
    const action = isTyping ? ACTION_ENUM.STARTED : ACTION_ENUM.STOPPED;

    const content: Proto.Content.Params = {
      content: {
        typingMessage: {
          groupId: groupId ?? null,
          action,
          timestamp: BigInt(finalTimestamp),
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };

    if (recipientId) {
      addPniSignatureMessageToProto({
        conversation: window.ConversationController.get(recipientId),
        proto: content,
        reason: `getTypingContentMessage(${finalTimestamp})`,
      });
    }

    return content;
  }

  getAttrsFromGroupOptions(
    options: Readonly<GroupMessageOptionsType>
  ): MessageOptionsType {
    const {
      deleteForEveryone,
      attachments,
      bodyRanges,
      contact,
      expireTimer,
      flags,
      groupCallUpdate,
      groupV2,
      isViewOnce,
      body,
      preview,
      profileKey,
      quote,
      reaction,
      sticker,
      storyContext,
      targetTimestampForEdit,
      timestamp,
      pinMessage,
      unpinMessage,
      pollCreate,
    } = options;

    if (!groupV2) {
      throw new Error(
        'getAttrsFromGroupOptions: No groupv2 information provided!'
      );
    }

    const myAci = itemStorage.user.getCheckedAci();

    const groupMembers = groupV2?.members || [];

    const blockedIdentifiers = new Set(
      concat(
        itemStorage.blocked.getBlockedServiceIds(),
        itemStorage.blocked.getBlockedNumbers()
      )
    );

    const recipients = groupMembers.filter(
      recipient => recipient !== myAci && !blockedIdentifiers.has(recipient)
    );

    return {
      deleteForEveryone,
      attachments,
      bodyRanges,
      body,
      contact,
      expireTimer,
      expireTimerVersion: undefined,
      flags,
      groupCallUpdate,
      groupV2,
      isViewOnce,
      preview,
      profileKey,
      quote,
      reaction,
      recipients,
      sticker,
      storyContext,
      targetTimestampForEdit,
      timestamp,
      pinMessage,
      unpinMessage,
      pollCreate,
    };
  }

  static padSyncMessage(
    params: RequireExactlyOne<Omit<Proto.SyncMessage.Params, 'padding'>>
  ): Proto.SyncMessage.Params {
    return {
      read: null,
      viewed: null,
      stickerPackOperation: null,
      content: null,
      ...params,
      padding: this.getRandomPadding(),
    };
  }

  // Low-level sends

  async sendMessage({
    messageOptions,
    contentHint,
    groupId,
    options,
    urgent,
    story,
    includePniSignatureMessage,
  }: Readonly<{
    messageOptions: MessageOptionsType;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    urgent: boolean;
    story?: boolean;
    includePniSignatureMessage?: boolean;
  }>): Promise<CallbackResultType> {
    const proto = await this.getContentMessage({
      ...messageOptions,
      includePniSignatureMessage,
    });

    return new Promise((resolve, reject) => {
      drop(
        this.sendMessageProto({
          callback: (res: CallbackResultType) => {
            if (res.errors && res.errors.length > 0) {
              reject(new SendMessageProtoError(res));
            } else {
              resolve(res);
            }
          },
          contentHint,
          groupId,
          options,
          proto,
          recipients: messageOptions.recipients || [],
          timestamp: messageOptions.timestamp,
          urgent,
          story,
        })
      );
    });
  }

  // Note: all the other low-level sends call this, so it is a chokepoint for 1:1 sends
  //   The chokepoint for group sends is sendContentMessageToGroup
  async sendMessageProto({
    callback,
    contentHint,
    groupId,
    options,
    proto,
    recipients,
    sendLogCallback,
    story,
    timestamp,
    urgent,
  }: Readonly<{
    callback: (result: CallbackResultType) => void;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    proto: Proto.Content.Params | PlaintextContent;
    recipients: ReadonlyArray<ServiceIdString>;
    sendLogCallback?: SendLogCallbackType;
    story?: boolean;
    timestamp: number;
    urgent: boolean;
  }>): Promise<void> {
    try {
      if (accountManager.areKeysOutOfDate(ServiceIdKind.ACI)) {
        log.warn(
          `sendMessageProto/${timestamp}: Keys are out of date; updating before send`
        );
        await accountManager.maybeUpdateKeys(ServiceIdKind.ACI);
        if (accountManager.areKeysOutOfDate(ServiceIdKind.ACI)) {
          throw new Error('Keys still out of date after update');
        }
      }
    } catch (error) {
      // TODO: DESKTOP-5642
      callback({
        dataMessage: undefined,
        editMessage: undefined,
        errors: [error],
      });
      return;
    }

    const outgoing = new OutgoingMessage({
      callback,
      contentHint,
      groupId,
      serviceIds: recipients,
      message: proto,
      options,
      sendLogCallback,
      story,
      timestamp,
      urgent,
    });

    recipients.forEach(serviceId => {
      drop(
        this.queueJobForServiceId(serviceId, async () =>
          outgoing.sendToServiceId(serviceId)
        )
      );
    });
  }

  async sendMessageProtoAndWait({
    timestamp,
    recipients,
    proto,
    contentHint,
    groupId,
    options,
    urgent,
    story,
  }: Readonly<{
    timestamp: number;
    recipients: Array<ServiceIdString>;
    proto: Proto.Content.Params | PlaintextContent;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    urgent: boolean;
    story?: boolean;
  }>): Promise<CallbackResultType> {
    return new Promise((resolve, reject) => {
      const callback = (result: CallbackResultType) => {
        if (result && result.errors && result.errors.length > 0) {
          reject(new SendMessageProtoError(result));
          return;
        }
        resolve(result);
      };

      drop(
        this.sendMessageProto({
          callback,
          contentHint,
          groupId,
          options,
          proto,
          recipients,
          timestamp,
          urgent,
          story,
        })
      );
    });
  }

  async sendIndividualProto({
    contentHint,
    groupId,
    serviceId,
    options,
    proto,
    timestamp,
    urgent,
  }: Readonly<{
    contentHint: number;
    groupId?: string;
    serviceId: ServiceIdString | undefined;
    options?: SendOptionsType;
    proto: Proto.Content.Params | PlaintextContent;
    timestamp: number;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    assertDev(serviceId, "ServiceId can't be undefined");
    return new Promise((resolve, reject) => {
      const callback = (res: CallbackResultType) => {
        if (res && res.errors && res.errors.length > 0) {
          reject(new SendMessageProtoError(res));
        } else {
          resolve(res);
        }
      };
      drop(
        this.sendMessageProto({
          callback,
          contentHint,
          groupId,
          options,
          proto,
          recipients: [serviceId],
          timestamp,
          urgent,
        })
      );
    });
  }

  // You might wonder why this takes a groupId. models/messages.resend() can send a group
  //   message to just one person.
  async sendMessageToServiceId({
    messageOptions,
    contentHint,
    groupId,
    serviceId,
    options,
    story,
    urgent,
    includePniSignatureMessage,
  }: Readonly<{
    serviceId: ServiceIdString;
    groupId: string | undefined;
    messageOptions: Omit<MessageOptionsType, 'recipients'>;
    contentHint: number;
    options?: SendOptionsType;
    story?: boolean;
    urgent: boolean;
    includePniSignatureMessage?: boolean;
  }>): Promise<CallbackResultType> {
    return this.sendMessage({
      messageOptions: {
        ...messageOptions,
        recipients: [serviceId],
      },
      contentHint,
      groupId,
      options,
      story,
      urgent,
      includePniSignatureMessage,
    });
  }

  // Support for sync messages

  // Note: this is used for sending real messages to your other devices after sending a
  //   message to others.
  async sendSyncMessage({
    encodedDataMessage,
    encodedEditMessage,
    timestamp,
    destinationE164,
    destinationServiceId,
    expirationStartTimestamp,
    conversationIdsSentTo = [],
    conversationIdsWithSealedSender = new Set(),
    isUpdate,
    urgent,
    options,
    storyMessage,
    storyMessageRecipients,
  }: Readonly<{
    encodedDataMessage?: Uint8Array;
    encodedEditMessage?: Uint8Array;
    timestamp: number;
    destinationE164: string | undefined;
    destinationServiceId: ServiceIdString | undefined;
    expirationStartTimestamp: number | null;
    conversationIdsSentTo?: Iterable<string>;
    conversationIdsWithSealedSender?: Set<string>;
    isUpdate?: boolean;
    urgent: boolean;
    options?: SendOptionsType;
    storyMessage?: Proto.StoryMessage.Params;
    storyMessageRecipients?: StoryMessageRecipientsType;
  }>): Promise<CallbackResultType> {
    const myAci = itemStorage.user.getCheckedAci();

    let editMessage: Proto.EditMessage.Params | null;
    let message: Proto.DataMessage.Params | null;
    if (encodedEditMessage) {
      editMessage = Proto.EditMessage.decode(encodedEditMessage);
      message = null;
    } else if (encodedDataMessage) {
      message = Proto.DataMessage.decode(encodedDataMessage);
      editMessage = null;
    } else {
      message = null;
      editMessage = null;
    }

    // Though this field has 'unidentified' in the name, it should have entries for each
    //   number we sent to.
    let unidentifiedStatus: Array<Proto.SyncMessage.Sent.UnidentifiedDeliveryStatus.Params> | null;
    if (isEmpty(conversationIdsSentTo)) {
      unidentifiedStatus = null;
    } else {
      unidentifiedStatus = await pMap(
        conversationIdsSentTo,
        async (
          conversationId
        ): Promise<Proto.SyncMessage.Sent.UnidentifiedDeliveryStatus.Params> => {
          const conv = window.ConversationController.get(conversationId);
          const serviceId = conv?.getServiceId();
          let destinationPniIdentityKey: Uint8Array | null = null;
          if (conv) {
            if (isPniString(serviceId)) {
              const pniIdentityKey =
                await signalProtocolStore.loadIdentityKey(serviceId);
              if (pniIdentityKey) {
                destinationPniIdentityKey = pniIdentityKey;
              }
            }
          }
          return {
            unidentified: conversationIdsWithSealedSender.has(conversationId),
            ...(isProtoBinaryEncodingEnabled()
              ? {
                  destinationServiceId: null,
                  destinationServiceIdBinary: serviceId
                    ? toServiceIdObject(serviceId).getServiceIdBinary()
                    : null,
                }
              : {
                  destinationServiceId: serviceId ?? null,
                  destinationServiceIdBinary: null,
                }),
            destinationPniIdentityKey,
          };
        },
        { concurrency: 10 }
      );
    }

    const syncMessage = MessageSender.padSyncMessage({
      content: {
        sent: {
          timestamp: BigInt(timestamp),
          destinationE164: destinationE164 ?? null,
          ...(isProtoBinaryEncodingEnabled()
            ? {
                destinationServiceId: null,
                destinationServiceIdBinary: destinationServiceId
                  ? toServiceIdObject(destinationServiceId).getServiceIdBinary()
                  : null,
              }
            : {
                destinationServiceId: destinationServiceId ?? null,
                destinationServiceIdBinary: null,
              }),
          expirationStartTimestamp: expirationStartTimestamp
            ? BigInt(expirationStartTimestamp)
            : null,
          storyMessage: storyMessage ?? null,
          storyMessageRecipients:
            storyMessageRecipients?.map(
              (
                recipient
              ): Proto.SyncMessage.Sent.StoryMessageRecipient.Params => {
                return {
                  ...(isProtoBinaryEncodingEnabled()
                    ? {
                        destinationServiceId: null,
                        destinationServiceIdBinary:
                          recipient.destinationServiceId
                            ? toServiceIdObject(
                                recipient.destinationServiceId
                              ).getServiceIdBinary()
                            : null,
                      }
                    : {
                        destinationServiceId:
                          recipient.destinationServiceId ?? null,
                        destinationServiceIdBinary: null,
                      }),
                  isAllowedToReply: recipient.isAllowedToReply,
                  distributionListIds: recipient.distributionListIds,
                };
              }
            ) ?? null,
          unidentifiedStatus,
          editMessage,
          message,
          isRecipientUpdate: Boolean(isUpdate),
        },
      },
    });

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: {
        content: {
          syncMessage,
        },
        pniSignatureMessage: null,
        senderKeyDistributionMessage: null,
      },
      timestamp,
      contentHint: ContentHint.Resendable,
      options,
      urgent,
    });
  }

  static getRequestBlockSyncMessage(): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const request: Proto.SyncMessage.Request.Params = {
      type: Proto.SyncMessage.Request.Type.BLOCKED,
    };

    const syncMessage = this.padSyncMessage({
      content: {
        request,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'blockSyncRequest',
      urgent: false,
    };
  }

  static getRequestConfigurationSyncMessage(): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const request: Proto.SyncMessage.Request.Params = {
      type: Proto.SyncMessage.Request.Type.CONFIGURATION,
    };

    const syncMessage = this.padSyncMessage({
      content: {
        request,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'configurationSyncRequest',
      urgent: false,
    };
  }

  static getRequestContactSyncMessage(): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const request: Proto.SyncMessage.Request.Params = {
      type: Proto.SyncMessage.Request.Type.CONTACTS,
    };

    const syncMessage = this.padSyncMessage({
      content: {
        request,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'contactSyncRequest',
      urgent: true,
    };
  }

  static getFetchManifestSyncMessage(): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const fetchLatest: Proto.SyncMessage.FetchLatest.Params = {
      type: Proto.SyncMessage.FetchLatest.Type.STORAGE_MANIFEST,
    };

    const syncMessage = this.padSyncMessage({
      content: {
        fetchLatest,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'fetchLatestManifestSync',
      urgent: false,
    };
  }

  static getFetchLocalProfileSyncMessage(): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const fetchLatest: Proto.SyncMessage.FetchLatest.Params = {
      type: Proto.SyncMessage.FetchLatest.Type.LOCAL_PROFILE,
    };

    const syncMessage = this.padSyncMessage({
      content: {
        fetchLatest,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'fetchLocalProfileSync',
      urgent: false,
    };
  }

  static getRequestKeySyncMessage(): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const request: Proto.SyncMessage.Request.Params = {
      type: Proto.SyncMessage.Request.Type.KEYS,
    };

    const syncMessage = this.padSyncMessage({
      content: {
        request,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'keySyncRequest',
      urgent: true,
    };
  }

  static getDeleteForMeSyncMessage(
    data: DeleteForMeSyncEventData
  ): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const deleteForMe = {
      messageDeletes:
        new Array<Proto.SyncMessage.DeleteForMe.MessageDeletes.Params>(),
      conversationDeletes:
        new Array<Proto.SyncMessage.DeleteForMe.ConversationDelete.Params>(),
      localOnlyConversationDeletes:
        new Array<Proto.SyncMessage.DeleteForMe.LocalOnlyConversationDelete.Params>(),
      attachmentDeletes:
        new Array<Proto.SyncMessage.DeleteForMe.AttachmentDelete.Params>(),
    } satisfies Proto.SyncMessage.DeleteForMe.Params;

    const messageDeletes: Map<
      string,
      Array<DeleteMessageSyncTarget>
    > = new Map();

    data.forEach(item => {
      if (item.type === 'delete-message') {
        const conversation = getConversationFromTarget(item.conversation);
        if (!conversation) {
          throw new Error(
            'getDeleteForMeSyncMessage: Failed to find conversation for delete-message'
          );
        }
        const existing = messageDeletes.get(conversation.id);
        if (existing) {
          existing.push(item);
        } else {
          messageDeletes.set(conversation.id, [item]);
        }
      } else if (item.type === 'delete-conversation') {
        const mostRecentMessages =
          item.mostRecentMessages.map(toAddressableMessage);
        const mostRecentNonExpiringMessages =
          item.mostRecentNonExpiringMessages?.map(toAddressableMessage) ?? null;
        const conversation = toConversationIdentifier(item.conversation);

        deleteForMe.conversationDeletes.push({
          conversation,
          isFullDelete: true,
          mostRecentMessages,
          mostRecentNonExpiringMessages,
        });
      } else if (item.type === 'delete-local-conversation') {
        const conversation = toConversationIdentifier(item.conversation);

        deleteForMe.localOnlyConversationDeletes.push({
          conversation,
        });
      } else if (item.type === 'delete-single-attachment') {
        const conversation = toConversationIdentifier(item.conversation);
        const targetMessage = toAddressableMessage(item.message);

        deleteForMe.attachmentDeletes.push({
          conversation,
          targetMessage,
          clientUuid:
            item.clientUuid == null ? null : uuidToBytes(item.clientUuid),
          fallbackDigest:
            item.fallbackDigest == null
              ? null
              : Bytes.fromBase64(item.fallbackDigest),
          fallbackPlaintextHash:
            item.fallbackPlaintextHash == null
              ? null
              : Bytes.fromHex(item.fallbackPlaintextHash),
        });
      } else {
        throw missingCaseError(item);
      }
    });

    if (messageDeletes.size > 0) {
      for (const [conversationId, items] of messageDeletes.entries()) {
        const first = items[0];
        if (!first) {
          throw new Error('Failed to fetch first from items');
        }
        const messages = items.map(item => toAddressableMessage(item.message));
        const conversation = toConversationIdentifier(first.conversation);

        if (items.length > MAX_MESSAGE_COUNT) {
          log.warn(
            `getDeleteForMeSyncMessage: Sending ${items.length} message deletes for conversationId ${conversationId}`
          );
        }

        deleteForMe.messageDeletes.push({
          messages,
          conversation,
        });
      }
    }

    const syncMessage = this.padSyncMessage({
      content: {
        deleteForMe,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'deleteForMeSync',
      urgent: false,
    };
  }

  static getAttachmentBackfillSyncMessage(
    targetConversation: ConversationIdentifier,
    targetMessage: AddressableMessage
  ): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const syncMessage = this.padSyncMessage({
      content: {
        attachmentBackfillRequest: {
          targetMessage: toAddressableMessage(targetMessage),
          targetConversation: toConversationIdentifier(targetConversation),
        },
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'attachmentBackfillRequestSync',
      urgent: false,
    };
  }

  static getClearCallHistoryMessage(
    latestCall: CallHistoryDetails
  ): SingleProtoJobData {
    const ourAci = itemStorage.user.getCheckedAci();
    const callLogEvent: Proto.SyncMessage.CallLogEvent.Params = {
      type: Proto.SyncMessage.CallLogEvent.Type.CLEAR,
      timestamp: BigInt(latestCall.timestamp),
      conversationId: getBytesForPeerId(latestCall),
      callId: getCallIdForProto(latestCall),
    };

    const syncMessage = MessageSender.padSyncMessage({
      content: {
        callLogEvent,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'callLogEventSync',
      urgent: false,
    };
  }

  static getDeleteCallEvent(callDetails: CallDetails): SingleProtoJobData {
    const ourAci = itemStorage.user.getCheckedAci();
    const { mode } = callDetails;
    let status;
    if (mode === CallMode.Adhoc) {
      status = AdhocCallStatus.Deleted;
    } else if (mode === CallMode.Direct) {
      status = DirectCallStatus.Deleted;
    } else if (mode === CallMode.Group) {
      status = GroupCallStatus.Deleted;
    } else {
      throw missingCaseError(mode);
    }
    const callEvent = getProtoForCallHistory({
      ...callDetails,
      status,
    });

    const syncMessage = MessageSender.padSyncMessage({
      content: {
        callEvent,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'callLogEventSync',
      urgent: false,
    };
  }

  async syncReadMessages(
    reads: ReadonlyArray<{
      senderAci?: AciString;
      timestamp: number;
    }>,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    const myAci = itemStorage.user.getCheckedAci();

    const read = new Array<Proto.SyncMessage.Read.Params>();
    for (const r of reads) {
      if (isProtoBinaryEncodingEnabled()) {
        read.push({
          timestamp: BigInt(r.timestamp),
          senderAci: null,
          senderAciBinary: r.senderAci
            ? toAciObject(r.senderAci).getRawUuidBytes()
            : null,
        });
      } else {
        read.push({
          timestamp: BigInt(r.timestamp),
          senderAci: r.senderAci ?? null,
          senderAciBinary: null,
        });
      }
    }

    const syncMessage = MessageSender.padSyncMessage({
      read,
    });

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: {
        content: {
          syncMessage,
        },
        pniSignatureMessage: null,
        senderKeyDistributionMessage: null,
      },
      timestamp: Date.now(),
      contentHint: ContentHint.Resendable,
      options,
      urgent: true,
    });
  }

  async syncView(
    views: ReadonlyArray<{
      senderAci?: AciString;
      timestamp: number;
    }>,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myAci = itemStorage.user.getCheckedAci();

    const viewed = views.map(
      ({ senderAci, timestamp }): Proto.SyncMessage.Viewed.Params => {
        if (isProtoBinaryEncodingEnabled()) {
          return {
            timestamp: BigInt(timestamp),
            senderAci: null,
            senderAciBinary: senderAci
              ? toAciObject(senderAci).getRawUuidBytes()
              : null,
          };
        }
        return {
          timestamp: BigInt(timestamp),
          senderAci: senderAci ?? null,
          senderAciBinary: null,
        };
      }
    );

    const syncMessage = MessageSender.padSyncMessage({
      viewed,
    });

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: {
        content: {
          syncMessage,
        },
        pniSignatureMessage: null,
        senderKeyDistributionMessage: null,
      },
      timestamp: Date.now(),
      contentHint: ContentHint.Resendable,
      options,
      urgent: false,
    });
  }

  async syncViewOnceOpen(
    viewOnceOpens: ReadonlyArray<{
      senderAci?: AciString;
      senderE164?: string;
      timestamp: number;
    }>,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    if (viewOnceOpens.length !== 1) {
      throw new Error(
        `syncViewOnceOpen: ${viewOnceOpens.length} opens provided. Can only handle one.`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { senderAci, timestamp } = viewOnceOpens[0]!;

    if (!senderAci) {
      throw new Error('syncViewOnceOpen: Missing senderAci');
    }

    const myAci = itemStorage.user.getCheckedAci();

    const viewOnceOpen: Proto.SyncMessage.ViewOnceOpen.Params = {
      timestamp: BigInt(timestamp),
      senderAci: null,
      senderAciBinary: null,
    };
    if (isProtoBinaryEncodingEnabled()) {
      viewOnceOpen.senderAciBinary = toAciObject(senderAci).getRawUuidBytes();
    } else {
      viewOnceOpen.senderAci = senderAci;
    }

    const syncMessage = MessageSender.padSyncMessage({
      content: {
        viewOnceOpen,
      },
    });

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: {
        content: {
          syncMessage,
        },
        pniSignatureMessage: null,
        senderKeyDistributionMessage: null,
      },
      timestamp: Date.now(),
      contentHint: ContentHint.Resendable,
      options,
      urgent: false,
    });
  }

  static getBlockSync(
    options: Readonly<{
      e164s: Array<string>;
      acis: Array<AciString>;
      groupIds: Array<Uint8Array>;
    }>
  ): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const blocked: Proto.SyncMessage.Blocked.Params = {
      numbers: options.e164s,
      acisBinary: null,
      acis: null,
      groupIds: options.groupIds,
    };
    if (isProtoBinaryEncodingEnabled()) {
      blocked.acisBinary = options.acis.map(aci =>
        toAciObject(aci).getRawUuidBytes()
      );
    } else {
      blocked.acis = options.acis;
    }

    const syncMessage = MessageSender.padSyncMessage({
      content: {
        blocked,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'blockSync',
      urgent: false,
    };
  }

  static getMessageRequestResponseSync(
    options: Readonly<{
      threadAci?: AciString;
      groupId?: Uint8Array;
      type: number;
    }>
  ): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    const messageRequestResponse: Proto.SyncMessage.MessageRequestResponse.Params =
      {
        type: options.type,
        groupId: options.groupId ? options.groupId : null,
        threadAciBinary: null,
        threadAci: null,
      };

    if (options.threadAci !== undefined) {
      if (isProtoBinaryEncodingEnabled()) {
        messageRequestResponse.threadAciBinary = toAciObject(
          options.threadAci
        ).getRawUuidBytes();
      } else {
        messageRequestResponse.threadAci = options.threadAci;
      }
    }
    const syncMessage = MessageSender.padSyncMessage({
      content: {
        messageRequestResponse,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'messageRequestSync',
      urgent: false,
    };
  }

  static getStickerPackSync(
    operations: ReadonlyArray<{
      packId: string;
      packKey: string;
      installed: boolean;
    }>
  ): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();
    const ENUM = Proto.SyncMessage.StickerPackOperation.Type;

    const stickerPackOperation = operations.map(
      (item): Proto.SyncMessage.StickerPackOperation.Params => {
        const { packId, packKey, installed } = item;

        return {
          packId: Bytes.fromHex(packId),
          packKey: Bytes.fromBase64(packKey),
          type: installed ? ENUM.INSTALL : ENUM.REMOVE,
        };
      }
    );

    const syncMessage = MessageSender.padSyncMessage({
      stickerPackOperation,
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'stickerPackSync',
      urgent: false,
    };
  }

  static getVerificationSync(
    destinationE164: string | undefined,
    destinationAci: AciString | undefined,
    state: number,
    identityKey: Readonly<Uint8Array>
  ): SingleProtoJobData {
    const myAci = itemStorage.user.getCheckedAci();

    if (!destinationE164 && !destinationAci) {
      throw new Error('syncVerification: Neither e164 nor UUID were provided');
    }

    const verified: Proto.Verified.Params = {
      state,
      identityKey,
      nullMessage: MessageSender.getRandomPadding(),
      destinationAci: null,
      destinationAciBinary: null,
    };
    if (destinationAci) {
      if (isProtoBinaryEncodingEnabled()) {
        verified.destinationAciBinary =
          toAciObject(destinationAci).getRawUuidBytes();
      } else {
        verified.destinationAci = destinationAci;
      }
    }

    const syncMessage = MessageSender.padSyncMessage({
      content: {
        verified,
      },
    });

    return {
      contentHint: ContentHint.Resendable,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          pniSignatureMessage: null,
          senderKeyDistributionMessage: null,
        })
      ),
      type: 'verificationSync',
      urgent: false,
    };
  }

  // Sending messages to contacts

  async sendCallingMessage(
    serviceId: ServiceIdString,
    callMessage: Readonly<Proto.CallMessage.Params>,
    timestamp: number,
    urgent: boolean,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    const recipients = [serviceId];

    const contentMessage: Proto.Content.Params = {
      content: {
        callMessage,
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };

    const conversation = window.ConversationController.get(serviceId);

    addPniSignatureMessageToProto({
      conversation,
      proto: contentMessage,
      reason: `sendCallingMessage(${timestamp})`,
    });

    return this.sendMessageProtoAndWait({
      timestamp,
      recipients,
      proto: contentMessage,
      contentHint: ContentHint.Default,
      groupId: undefined,
      options,
      urgent,
    });
  }

  async sendDeliveryReceipt(
    options: Readonly<{
      senderAci: AciString;
      timestamps: Array<number>;
      isDirectConversation: boolean;
      options?: Readonly<SendOptionsType>;
    }>
  ): Promise<CallbackResultType> {
    return this.#sendReceiptMessage({
      ...options,
      type: Proto.ReceiptMessage.Type.DELIVERY,
    });
  }

  async sendReadReceipt(
    options: Readonly<{
      senderAci: AciString;
      timestamps: Array<number>;
      isDirectConversation: boolean;
      options?: Readonly<SendOptionsType>;
    }>
  ): Promise<CallbackResultType> {
    return this.#sendReceiptMessage({
      ...options,
      type: Proto.ReceiptMessage.Type.READ,
    });
  }

  async sendViewedReceipt(
    options: Readonly<{
      senderAci: AciString;
      timestamps: Array<number>;
      isDirectConversation: boolean;
      options?: Readonly<SendOptionsType>;
    }>
  ): Promise<CallbackResultType> {
    return this.#sendReceiptMessage({
      ...options,
      type: Proto.ReceiptMessage.Type.VIEWED,
    });
  }

  async #sendReceiptMessage({
    senderAci,
    timestamps,
    type,
    isDirectConversation,
    options,
  }: Readonly<{
    senderAci: AciString;
    timestamps: Array<number>;
    type: Proto.ReceiptMessage.Type;
    isDirectConversation: boolean;
    options?: Readonly<SendOptionsType>;
  }>): Promise<CallbackResultType> {
    const timestamp = Date.now();

    const receiptMessage: Proto.ReceiptMessage.Params = {
      type,
      timestamp: timestamps.map(receiptTimestamp => BigInt(receiptTimestamp)),
    };

    const contentMessage = {
      content: {
        receiptMessage,
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };

    if (isDirectConversation) {
      const conversation = window.ConversationController.get(senderAci);

      addPniSignatureMessageToProto({
        conversation,
        proto: contentMessage,
        reason: `sendReceiptMessage(${type}, ${timestamp})`,
      });
    }

    return this.sendIndividualProto({
      serviceId: senderAci,
      proto: contentMessage,
      timestamp,
      contentHint: ContentHint.Resendable,
      options,
      urgent: false,
    });
  }

  static getNullMessage(
    options: Readonly<{
      padding?: Uint8Array;
    }> = {}
  ): Proto.Content.Params {
    return {
      content: {
        nullMessage: {
          padding: options.padding || MessageSender.getRandomPadding(),
        },
      },
      pniSignatureMessage: null,
      senderKeyDistributionMessage: null,
    };
  }

  // Group sends

  // Used to ensure that when we send to a group the old way, we save to the send log as
  //   we send to each recipient. Then we don't have a long delay between the first send
  //   and the final save to the database with all recipients.
  makeSendLogCallback({
    contentHint,
    messageId,
    proto,
    sendType,
    timestamp,
    urgent,
    hasPniSignatureMessage,
  }: Readonly<{
    contentHint: number;
    messageId?: string;
    proto: Uint8Array;
    sendType: SendTypesType;
    timestamp: number;
    urgent: boolean;
    hasPniSignatureMessage: boolean;
  }>): SendLogCallbackType {
    let initialSavePromise: Promise<number>;

    return async ({
      serviceId,
      deviceIds,
    }: {
      serviceId: ServiceIdString;
      deviceIds: Array<number>;
    }) => {
      if (!shouldSaveProto(sendType)) {
        return;
      }

      const conversation = window.ConversationController.get(serviceId);
      if (!conversation) {
        log.warn(
          `makeSendLogCallback: Unable to find conversation for serviceId ${serviceId}`
        );
        return;
      }
      const recipientServiceId = conversation.getServiceId();
      if (!recipientServiceId) {
        log.warn(
          `makeSendLogCallback: Conversation ${conversation.idForLogging()} had no UUID`
        );
        return;
      }

      if (initialSavePromise === undefined) {
        initialSavePromise = DataWriter.insertSentProto(
          {
            contentHint,
            proto,
            timestamp,
            urgent,
            hasPniSignatureMessage,
          },
          {
            recipients: { [recipientServiceId]: deviceIds },
            messageIds: messageId ? [messageId] : [],
          }
        );
        await initialSavePromise;
      } else {
        const id = await initialSavePromise;
        await DataWriter.insertProtoRecipients({
          id,
          recipientServiceId,
          deviceIds,
        });
      }
    };
  }

  // No functions should really call this; since most group sends are now via Sender Key
  async sendGroupProto({
    contentHint,
    groupId,
    options,
    proto,
    recipients,
    sendLogCallback,
    story,
    timestamp = Date.now(),
    urgent,
  }: Readonly<{
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    proto: Proto.Content.Params;
    recipients: ReadonlyArray<ServiceIdString>;
    sendLogCallback?: SendLogCallbackType;
    story?: boolean;
    timestamp: number;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    const myE164 = itemStorage.user.getNumber();
    const myAci = itemStorage.user.getAci();
    const serviceIds = recipients.filter(id => id !== myE164 && id !== myAci);

    if (serviceIds.length === 0) {
      const dataMessage = proto.content?.dataMessage
        ? Proto.DataMessage.encode(proto.content.dataMessage)
        : undefined;

      const editMessage = proto.content?.editMessage
        ? Proto.EditMessage.encode(proto.content.editMessage)
        : undefined;

      return Promise.resolve({
        dataMessage,
        editMessage,
        errors: [],
        failoverServiceIds: [],
        successfulServiceIds: [],
        unidentifiedDeliveries: [],
        contentHint,
        urgent,
      });
    }

    return new Promise((resolve, reject) => {
      const callback = (res: CallbackResultType) => {
        if (res.errors && res.errors.length > 0) {
          reject(new SendMessageProtoError(res));
        } else {
          resolve(res);
        }
      };

      drop(
        this.sendMessageProto({
          callback,
          contentHint,
          groupId,
          options,
          proto,
          recipients: serviceIds,
          sendLogCallback,
          story,
          timestamp,
          urgent,
        })
      );
    });
  }

  async getSenderKeyDistributionMessage(
    distributionId: string,
    {
      throwIfNotInDatabase,
      timestamp,
    }: { throwIfNotInDatabase?: boolean; timestamp: number }
  ): Promise<Proto.Content.Params> {
    const ourAci = itemStorage.user.getCheckedAci();
    const ourDeviceId = parseIntOrThrow(
      itemStorage.user.getDeviceId(),
      'getSenderKeyDistributionMessage'
    );

    const protocolAddress = ProtocolAddress.new(ourAci, ourDeviceId);
    const address = new QualifiedAddress(
      ourAci,
      new Address(ourAci, ourDeviceId)
    );

    const senderKeyDistributionMessage =
      await signalProtocolStore.enqueueSenderKeyJob(address, async () => {
        const senderKeyStore = new SenderKeys({
          ourServiceId: ourAci,
          zone: GLOBAL_ZONE,
        });

        if (throwIfNotInDatabase) {
          const key = await senderKeyStore.getSenderKey(
            protocolAddress,
            distributionId
          );
          if (!key) {
            throw new NoSenderKeyError(
              `getSenderKeyDistributionMessage: Distribution ${distributionId} was not in database as expected`
            );
          }
        }

        return SenderKeyDistributionMessage.create(
          protocolAddress,
          distributionId,
          senderKeyStore
        );
      });

    log.info(
      `getSenderKeyDistributionMessage: Building ${distributionId} with timestamp ${timestamp}`
    );
    return {
      content: null,
      pniSignatureMessage: null,
      senderKeyDistributionMessage: senderKeyDistributionMessage.serialize(),
    };
  }

  // The one group send exception - a message that should never be sent via sender key
  async sendSenderKeyDistributionMessage(
    {
      contentHint,
      distributionId,
      groupId,
      serviceIds,
      throwIfNotInDatabase,
      story,
      urgent,
    }: Readonly<{
      contentHint?: number;
      distributionId: string;
      groupId: string | undefined;
      serviceIds: ReadonlyArray<ServiceIdString>;
      throwIfNotInDatabase?: boolean;
      story?: boolean;
      urgent: boolean;
    }>,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    const timestamp = Date.now();
    const contentMessage = await this.getSenderKeyDistributionMessage(
      distributionId,
      {
        throwIfNotInDatabase,
        timestamp,
      }
    );

    const sendLogCallback =
      serviceIds.length > 1
        ? this.makeSendLogCallback({
            contentHint: contentHint ?? ContentHint.Implicit,
            proto: Proto.Content.encode(contentMessage),
            sendType: 'senderKeyDistributionMessage',
            timestamp,
            urgent,
            hasPniSignatureMessage: false,
          })
        : undefined;

    return this.sendGroupProto({
      contentHint: contentHint ?? ContentHint.Implicit,
      groupId,
      options,
      proto: contentMessage,
      recipients: serviceIds,
      sendLogCallback,
      story,
      timestamp,
      urgent,
    });
  }
}

export const messageSender = new MessageSender();

// Helpers

function toAddressableMessage(
  message: AddressableMessage
): Proto.AddressableMessage.Params {
  const sentTimestamp = BigInt(message.sentAt);

  let author: Proto.AddressableMessage.Params['author'];
  if (message.type === 'aci') {
    if (isProtoBinaryEncodingEnabled()) {
      author = {
        authorServiceIdBinary: toAciObject(
          message.authorAci
        ).getServiceIdBinary(),
      };
    } else {
      author = {
        authorServiceId: message.authorAci,
      };
    }
  } else if (message.type === 'e164') {
    author = {
      authorE164: message.authorE164,
    };
  } else if (message.type === 'pni') {
    if (isProtoBinaryEncodingEnabled()) {
      author = {
        authorServiceIdBinary: toPniObject(
          message.authorPni
        ).getServiceIdBinary(),
      };
    } else {
      author = {
        authorServiceId: message.authorPni,
      };
    }
  } else {
    throw missingCaseError(message);
  }

  return {
    sentTimestamp,
    author,
  };
}

function toConversationIdentifier(
  conversation: ConversationIdentifier
): Proto.ConversationIdentifier.Params {
  if (conversation.type === 'aci') {
    if (isProtoBinaryEncodingEnabled()) {
      return {
        identifier: {
          threadServiceIdBinary: toAciObject(
            conversation.aci
          ).getServiceIdBinary(),
        },
      };
    }
    return {
      identifier: {
        threadServiceId: conversation.aci,
      },
    };
  }
  if (conversation.type === 'pni') {
    if (isProtoBinaryEncodingEnabled()) {
      return {
        identifier: {
          threadServiceIdBinary: toPniObject(
            conversation.pni
          ).getServiceIdBinary(),
        },
      };
    }
    return {
      identifier: {
        threadServiceId: conversation.pni,
      },
    };
  }
  if (conversation.type === 'group') {
    return {
      identifier: {
        threadGroupId: Bytes.fromBase64(conversation.groupId),
      },
    };
  }
  if (conversation.type === 'e164') {
    return {
      identifier: {
        threadE164: conversation.e164,
      },
    };
  }
  throw missingCaseError(conversation);
}

function toBodyRange(bodyRange: RawBodyRange): Proto.BodyRange.Params {
  const { start, length } = bodyRange;

  let associatedValue: Proto.BodyRange.Params['associatedValue'];
  if (BodyRange.isMention(bodyRange)) {
    if (isProtoBinaryEncodingEnabled()) {
      associatedValue = {
        mentionAciBinary: toAciObject(bodyRange.mentionAci).getRawUuidBytes(),
      };
    } else {
      associatedValue = {
        mentionAci: bodyRange.mentionAci,
      };
    }
  } else if (BodyRange.isFormatting(bodyRange)) {
    associatedValue = {
      style: bodyRange.style,
    };
  } else {
    throw missingCaseError(bodyRange);
  }

  return {
    start,
    length,
    associatedValue,
  };
}
