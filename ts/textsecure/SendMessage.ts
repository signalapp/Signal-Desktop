// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-bitwise */
/* eslint-disable max-classes-per-file */

import { z } from 'zod';
import Long from 'long';
import PQueue from 'p-queue';
import pMap from 'p-map';
import type { PlaintextContent } from '@signalapp/libsignal-client';
import {
  Pni,
  ProtocolAddress,
  SenderKeyDistributionMessage,
} from '@signalapp/libsignal-client';

import { DataWriter } from '../sql/Client';
import type { ConversationModel } from '../models/conversations';
import { GLOBAL_ZONE } from '../SignalProtocolStore';
import { assertDev, strictAssert } from '../util/assert';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { SenderKeys } from '../LibSignalStores';
import type {
  TextAttachmentType,
  UploadedAttachmentType,
} from '../types/Attachment';
import type { AciString, ServiceIdString } from '../types/ServiceId';
import {
  ServiceIdKind,
  serviceIdSchema,
  isPniString,
} from '../types/ServiceId';
import type {
  ChallengeType,
  GetGroupLogOptionsType,
  GroupCredentialsType,
  GroupLogResponseType,
  WebAPIType,
} from './WebAPI';
import createTaskWithTimeout from './TaskWithTimeout';
import type {
  CallbackResultType,
  StorageServiceCallOptionsType,
  StorageServiceCredentials,
} from './Types.d';
import type {
  SerializedCertificateType,
  SendLogCallbackType,
} from './OutgoingMessage';
import OutgoingMessage from './OutgoingMessage';
import * as Bytes from '../Bytes';
import { getRandomBytes } from '../Crypto';
import {
  MessageError,
  SendMessageProtoError,
  HTTPError,
  NoSenderKeyError,
} from './Errors';
import { BodyRange } from '../types/BodyRange';
import type { RawBodyRange } from '../types/BodyRange';
import type { StoryContextType } from '../types/Util';
import type {
  LinkPreviewImage,
  LinkPreviewMetadata,
} from '../linkPreviews/linkPreviewFetch';
import { concat, isEmpty } from '../util/iterables';
import type { SendTypesType } from '../util/handleMessageSend';
import { shouldSaveProto, sendTypesEnum } from '../util/handleMessageSend';
import type { DurationInSeconds } from '../util/durations';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import type { EmbeddedContactWithUploadedAvatar } from '../types/EmbeddedContact';
import {
  numberToPhoneType,
  numberToEmailType,
  numberToAddressType,
} from '../types/EmbeddedContact';
import { missingCaseError } from '../util/missingCaseError';
import { drop } from '../util/drop';
import type {
  ConversationToDelete,
  DeleteForMeSyncEventData,
  DeleteMessageSyncTarget,
  MessageToDelete,
} from './messageReceiverEvents';
import { getConversationFromTarget } from '../util/deleteForMe';
import type { CallDetails, CallHistoryDetails } from '../types/CallDisposition';
import {
  AdhocCallStatus,
  DirectCallStatus,
  GroupCallStatus,
  CallMode,
} from '../types/CallDisposition';
import {
  getBytesForPeerId,
  getCallIdForProto,
  getProtoForCallHistory,
} from '../util/callDisposition';
import { MAX_MESSAGE_COUNT } from '../util/deleteForMe.types';
import type { GroupSendToken } from '../types/GroupSendEndorsements';

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

export type MessageOptionsType = {
  attachments?: ReadonlyArray<UploadedAttachmentType>;
  body?: string;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
  contact?: ReadonlyArray<EmbeddedContactWithUploadedAvatar>;
  expireTimer?: DurationInSeconds;
  expireTimerVersion: number | undefined;
  flags?: number;
  group?: {
    id: string;
    type: number;
  };
  groupV2?: GroupV2InfoType;
  needsSync?: boolean;
  preview?: ReadonlyArray<OutgoingLinkPreviewType>;
  profileKey?: Uint8Array;
  quote?: OutgoingQuoteType;
  recipients: ReadonlyArray<ServiceIdString>;
  sticker?: OutgoingStickerType;
  reaction?: ReactionType;
  deletedForEveryoneTimestamp?: number;
  targetTimestampForEdit?: number;
  timestamp: number;
  groupCallUpdate?: GroupCallUpdateType;
  storyContext?: StoryContextType;
};
export type GroupSendOptionsType = {
  attachments?: ReadonlyArray<UploadedAttachmentType>;
  bodyRanges?: ReadonlyArray<RawBodyRange>;
  contact?: ReadonlyArray<EmbeddedContactWithUploadedAvatar>;
  deletedForEveryoneTimestamp?: number;
  targetTimestampForEdit?: number;
  expireTimer?: DurationInSeconds;
  flags?: number;
  groupCallUpdate?: GroupCallUpdateType;
  groupV2?: GroupV2InfoType;
  messageText?: string;
  preview?: ReadonlyArray<OutgoingLinkPreviewType>;
  profileKey?: Uint8Array;
  quote?: OutgoingQuoteType;
  reaction?: ReactionType;
  sticker?: OutgoingStickerType;
  storyContext?: StoryContextType;
  timestamp: number;
};

class Message {
  attachments: ReadonlyArray<UploadedAttachmentType>;

  body?: string;

  bodyRanges?: ReadonlyArray<RawBodyRange>;

  contact?: ReadonlyArray<EmbeddedContactWithUploadedAvatar>;

  expireTimer?: DurationInSeconds;

  expireTimerVersion?: number;

  flags?: number;

  group?: {
    id: string;
    type: number;
  };

  groupV2?: GroupV2InfoType;

  needsSync?: boolean;

  preview?: ReadonlyArray<OutgoingLinkPreviewType>;

  profileKey?: Uint8Array;

  quote?: OutgoingQuoteType;

  recipients: ReadonlyArray<ServiceIdString>;

  sticker?: OutgoingStickerType;

  reaction?: ReactionType;

  timestamp: number;

  dataMessage?: Proto.DataMessage;

  deletedForEveryoneTimestamp?: number;

  groupCallUpdate?: GroupCallUpdateType;

  storyContext?: StoryContextType;

  constructor(options: MessageOptionsType) {
    this.attachments = options.attachments || [];
    this.body = options.body;
    this.bodyRanges = options.bodyRanges;
    this.contact = options.contact;
    this.expireTimer = options.expireTimer;
    this.expireTimerVersion = options.expireTimerVersion;
    this.flags = options.flags;
    this.group = options.group;
    this.groupV2 = options.groupV2;
    this.needsSync = options.needsSync;
    this.preview = options.preview;
    this.profileKey = options.profileKey;
    this.quote = options.quote;
    this.recipients = options.recipients;
    this.sticker = options.sticker;
    this.reaction = options.reaction;
    this.timestamp = options.timestamp;
    this.deletedForEveryoneTimestamp = options.deletedForEveryoneTimestamp;
    this.groupCallUpdate = options.groupCallUpdate;
    this.storyContext = options.storyContext;

    if (!(this.recipients instanceof Array)) {
      throw new Error('Invalid recipient list');
    }

    if (!this.group && !this.groupV2 && this.recipients.length !== 1) {
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
      if (
        this.body != null ||
        this.group != null ||
        this.attachments.length !== 0
      ) {
        throw new Error('Invalid end session message');
      }
    } else {
      if (
        typeof this.timestamp !== 'number' ||
        (this.body && typeof this.body !== 'string')
      ) {
        throw new Error('Invalid message body');
      }
      if (this.group) {
        if (
          typeof this.group.id !== 'string' ||
          typeof this.group.type !== 'number'
        ) {
          throw new Error('Invalid group context');
        }
      }
    }
  }

  isEndSession() {
    return (this.flags || 0) & Proto.DataMessage.Flags.END_SESSION;
  }

  toProto(): Proto.DataMessage {
    if (this.dataMessage) {
      return this.dataMessage;
    }
    const proto = new Proto.DataMessage();

    proto.timestamp = Long.fromNumber(this.timestamp);
    proto.attachments = this.attachments.slice();

    if (this.body) {
      proto.body = this.body;

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
    if (this.flags) {
      proto.flags = this.flags;
    }
    if (this.groupV2) {
      proto.groupV2 = new Proto.GroupContextV2();
      proto.groupV2.masterKey = this.groupV2.masterKey;
      proto.groupV2.revision = this.groupV2.revision;
      proto.groupV2.groupChange = this.groupV2.groupChange || null;
    }
    if (this.sticker) {
      proto.sticker = new Proto.DataMessage.Sticker();
      proto.sticker.packId = Bytes.fromHex(this.sticker.packId);
      proto.sticker.packKey = Bytes.fromBase64(this.sticker.packKey);
      proto.sticker.stickerId = this.sticker.stickerId;
      proto.sticker.emoji = this.sticker.emoji;
      proto.sticker.data = this.sticker.data;
    }
    if (this.reaction) {
      proto.reaction = new Proto.DataMessage.Reaction();
      proto.reaction.emoji = this.reaction.emoji || null;
      proto.reaction.remove = this.reaction.remove || false;
      proto.reaction.targetAuthorAci = this.reaction.targetAuthorAci || null;
      proto.reaction.targetSentTimestamp =
        this.reaction.targetTimestamp === undefined
          ? null
          : Long.fromNumber(this.reaction.targetTimestamp);
    }

    if (Array.isArray(this.preview)) {
      proto.preview = this.preview.map(preview => {
        const item = new Proto.Preview();
        item.title = preview.title;
        item.url = preview.url;
        item.description = preview.description || null;
        item.date = preview.date || null;
        if (preview.image) {
          item.image = preview.image;
        }
        return item;
      });
    }
    if (Array.isArray(this.contact)) {
      proto.contact = this.contact.map(
        (contact: EmbeddedContactWithUploadedAvatar) => {
          const contactProto = new Proto.DataMessage.Contact();
          if (contact.name) {
            const nameProto: Proto.DataMessage.Contact.IName = {
              givenName: contact.name.givenName,
              familyName: contact.name.familyName,
              prefix: contact.name.prefix,
              suffix: contact.name.suffix,
              middleName: contact.name.middleName,
              nickname: contact.name.nickname,
            };
            contactProto.name = new Proto.DataMessage.Contact.Name(nameProto);
          }
          if (Array.isArray(contact.number)) {
            contactProto.number = contact.number.map(number => {
              const numberProto: Proto.DataMessage.Contact.IPhone = {
                value: number.value,
                type: numberToPhoneType(number.type),
                label: number.label,
              };

              return new Proto.DataMessage.Contact.Phone(numberProto);
            });
          }
          if (Array.isArray(contact.email)) {
            contactProto.email = contact.email.map(email => {
              const emailProto: Proto.DataMessage.Contact.IEmail = {
                value: email.value,
                type: numberToEmailType(email.type),
                label: email.label,
              };

              return new Proto.DataMessage.Contact.Email(emailProto);
            });
          }
          if (Array.isArray(contact.address)) {
            contactProto.address = contact.address.map(address => {
              const addressProto: Proto.DataMessage.Contact.IPostalAddress = {
                type: numberToAddressType(address.type),
                label: address.label,
                street: address.street,
                pobox: address.pobox,
                neighborhood: address.neighborhood,
                city: address.city,
                region: address.region,
                postcode: address.postcode,
                country: address.country,
              };

              return new Proto.DataMessage.Contact.PostalAddress(addressProto);
            });
          }
          if (contact.avatar?.avatar) {
            const avatarProto = new Proto.DataMessage.Contact.Avatar();
            avatarProto.avatar = contact.avatar.avatar;
            avatarProto.isProfile = Boolean(contact.avatar.isProfile);
            contactProto.avatar = avatarProto;
          }

          if (contact.organization) {
            contactProto.organization = contact.organization;
          }

          return contactProto;
        }
      );
    }

    if (this.quote) {
      const ProtoBodyRange = Proto.BodyRange;
      const { Quote } = Proto.DataMessage;

      proto.quote = new Quote();
      const { quote } = proto;

      if (this.quote.isGiftBadge) {
        quote.type = Proto.DataMessage.Quote.Type.GIFT_BADGE;
      } else {
        quote.type = Proto.DataMessage.Quote.Type.NORMAL;
      }

      quote.id =
        this.quote.id === undefined ? null : Long.fromNumber(this.quote.id);
      quote.authorAci = this.quote.authorAci || null;
      quote.text = this.quote.text || null;
      quote.attachments = this.quote.attachments.slice() || [];
      const bodyRanges = this.quote.bodyRanges || [];
      quote.bodyRanges = bodyRanges.map(range => {
        const bodyRange = new ProtoBodyRange();
        bodyRange.start = range.start;
        bodyRange.length = range.length;
        if (BodyRange.isMention(range)) {
          bodyRange.mentionAci = range.mentionAci;
        } else if (BodyRange.isFormatting(range)) {
          bodyRange.style = range.style;
        } else {
          throw missingCaseError(range);
        }
        return bodyRange;
      });
      if (
        quote.bodyRanges.length &&
        (!proto.requiredProtocolVersion ||
          proto.requiredProtocolVersion <
            Proto.DataMessage.ProtocolVersion.MENTIONS)
      ) {
        proto.requiredProtocolVersion =
          Proto.DataMessage.ProtocolVersion.MENTIONS;
      }
    }
    if (this.expireTimer) {
      proto.expireTimer = this.expireTimer;
    }
    if (this.expireTimerVersion) {
      proto.expireTimerVersion = this.expireTimerVersion;
    }
    if (this.profileKey) {
      proto.profileKey = this.profileKey;
    }
    if (this.deletedForEveryoneTimestamp) {
      proto.delete = {
        targetSentTimestamp: Long.fromNumber(this.deletedForEveryoneTimestamp),
      };
    }
    if (this.bodyRanges) {
      proto.requiredProtocolVersion =
        Proto.DataMessage.ProtocolVersion.MENTIONS;
      proto.bodyRanges = this.bodyRanges.map(bodyRange => {
        const { start, length } = bodyRange;

        if (BodyRange.isMention(bodyRange)) {
          return {
            start,
            length,
            mentionAci: bodyRange.mentionAci,
          };
        }
        if (BodyRange.isFormatting(bodyRange)) {
          return {
            start,
            length,
            style: bodyRange.style,
          };
        }
        throw missingCaseError(bodyRange);
      });
    }

    if (this.groupCallUpdate) {
      const { GroupCallUpdate } = Proto.DataMessage;

      const groupCallUpdate = new GroupCallUpdate();
      groupCallUpdate.eraId = this.groupCallUpdate.eraId;

      proto.groupCallUpdate = groupCallUpdate;
    }

    if (this.storyContext) {
      const { StoryContext } = Proto.DataMessage;

      const storyContext = new StoryContext();
      if (this.storyContext.authorAci) {
        storyContext.authorAci = this.storyContext.authorAci;
      }
      storyContext.sentTimestamp = Long.fromNumber(this.storyContext.timestamp);

      proto.storyContext = storyContext;
    }

    this.dataMessage = proto;
    return proto;
  }
}

type AddPniSignatureMessageToProtoOptionsType = Readonly<{
  conversation?: ConversationModel;
  proto: Proto.Content;
  reason: string;
}>;

function addPniSignatureMessageToProto({
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
    pni: Pni.parseFromServiceIdString(
      pniSignatureMessage.pni
    ).getRawUuidBytes(),
    signature: pniSignatureMessage.signature,
  };
}

export default class MessageSender {
  pendingMessages: {
    [id: string]: PQueue;
  };

  constructor(public readonly server: WebAPIType) {
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
    const paddingLength = (new Uint16Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    return getRandomBytes(paddingLength);
  }

  // Proto assembly

  getTextAttachmentProto(
    attachmentAttrs: OutgoingTextAttachmentType
  ): Proto.TextAttachment {
    const textAttachment = new Proto.TextAttachment();

    if (attachmentAttrs.text) {
      textAttachment.text = attachmentAttrs.text;
    }

    textAttachment.textStyle = attachmentAttrs.textStyle
      ? Number(attachmentAttrs.textStyle)
      : 0;

    if (attachmentAttrs.textForegroundColor) {
      textAttachment.textForegroundColor = attachmentAttrs.textForegroundColor;
    }

    if (attachmentAttrs.textBackgroundColor) {
      textAttachment.textBackgroundColor = attachmentAttrs.textBackgroundColor;
    }

    if (attachmentAttrs.preview) {
      textAttachment.preview = {
        image: attachmentAttrs.preview.image,
        title: attachmentAttrs.preview.title,
        url: attachmentAttrs.preview.url,
      };
    }

    if (attachmentAttrs.gradient) {
      const { colors, positions, ...rest } = attachmentAttrs.gradient;

      textAttachment.gradient = {
        ...rest,
        colors: colors?.slice(),
        positions: positions?.slice(),
      };
      textAttachment.background = 'gradient';
    } else {
      textAttachment.color = attachmentAttrs.color;
      textAttachment.background = 'color';
    }

    return textAttachment;
  }

  async getDataOrEditMessage(
    options: Readonly<MessageOptionsType>
  ): Promise<Uint8Array> {
    const message = await this.getHydratedMessage(options);
    const dataMessage = message.toProto();

    if (options.targetTimestampForEdit) {
      const editMessage = new Proto.EditMessage();
      editMessage.dataMessage = dataMessage;
      editMessage.targetSentTimestamp = Long.fromNumber(
        options.targetTimestampForEdit
      );
      return Proto.EditMessage.encode(editMessage).finish();
    }
    return Proto.DataMessage.encode(dataMessage).finish();
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
  }): Promise<Proto.StoryMessage> {
    const storyMessage = new Proto.StoryMessage();

    storyMessage.profileKey = profileKey;

    if (fileAttachment) {
      if (bodyRanges) {
        storyMessage.bodyRanges = bodyRanges;
      }
      try {
        storyMessage.fileAttachment = fileAttachment;
      } catch (error) {
        if (error instanceof HTTPError) {
          throw new MessageError(storyMessage, error);
        } else {
          throw error;
        }
      }
    }

    if (textAttachment) {
      storyMessage.textAttachment = this.getTextAttachmentProto(textAttachment);
    }

    if (groupV2) {
      const groupV2Context = new Proto.GroupContextV2();
      groupV2Context.masterKey = groupV2.masterKey;
      groupV2Context.revision = groupV2.revision;

      if (groupV2.groupChange) {
        groupV2Context.groupChange = groupV2.groupChange;
      }

      storyMessage.group = groupV2Context;
    }

    storyMessage.allowsReplies = Boolean(allowsReplies);

    return storyMessage;
  }

  async getContentMessage(
    options: Readonly<MessageOptionsType> &
      Readonly<{
        includePniSignatureMessage?: boolean;
      }>
  ): Promise<Proto.Content> {
    const message = await this.getHydratedMessage(options);
    const dataMessage = message.toProto();

    const contentMessage = new Proto.Content();
    if (options.targetTimestampForEdit) {
      const editMessage = new Proto.EditMessage();
      editMessage.dataMessage = dataMessage;
      editMessage.targetSentTimestamp = Long.fromNumber(
        options.targetTimestampForEdit
      );
      contentMessage.editMessage = editMessage;
    } else {
      contentMessage.dataMessage = dataMessage;
    }

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
  ): Proto.Content {
    const ACTION_ENUM = Proto.TypingMessage.Action;
    const { recipientId, groupId, isTyping, timestamp } = options;

    if (!recipientId && !groupId) {
      throw new Error(
        'getTypingContentMessage: Need to provide either recipientId or groupId!'
      );
    }

    const finalTimestamp = timestamp || Date.now();
    const action = isTyping ? ACTION_ENUM.STARTED : ACTION_ENUM.STOPPED;

    const typingMessage = new Proto.TypingMessage();
    if (groupId) {
      typingMessage.groupId = groupId;
    }
    typingMessage.action = action;
    typingMessage.timestamp = Long.fromNumber(finalTimestamp);

    const contentMessage = new Proto.Content();
    contentMessage.typingMessage = typingMessage;

    if (recipientId) {
      addPniSignatureMessageToProto({
        conversation: window.ConversationController.get(recipientId),
        proto: contentMessage,
        reason: `getTypingContentMessage(${finalTimestamp})`,
      });
    }

    return contentMessage;
  }

  getAttrsFromGroupOptions(
    options: Readonly<GroupSendOptionsType>
  ): MessageOptionsType {
    const {
      attachments,
      bodyRanges,
      contact,
      deletedForEveryoneTimestamp,
      expireTimer,
      flags,
      groupCallUpdate,
      groupV2,
      messageText,
      preview,
      profileKey,
      quote,
      reaction,
      sticker,
      storyContext,
      targetTimestampForEdit,
      timestamp,
    } = options;

    if (!groupV2) {
      throw new Error(
        'getAttrsFromGroupOptions: No groupv2 information provided!'
      );
    }

    const myAci = window.textsecure.storage.user.getCheckedAci();

    const groupMembers = groupV2?.members || [];

    const blockedIdentifiers = new Set(
      concat(
        window.storage.blocked.getBlockedServiceIds(),
        window.storage.blocked.getBlockedNumbers()
      )
    );

    const recipients = groupMembers.filter(
      recipient => recipient !== myAci && !blockedIdentifiers.has(recipient)
    );

    return {
      attachments,
      bodyRanges,
      body: messageText,
      contact,
      deletedForEveryoneTimestamp,
      expireTimer,
      expireTimerVersion: undefined,
      flags,
      groupCallUpdate,
      groupV2,
      preview,
      profileKey,
      quote,
      reaction,
      recipients,
      sticker,
      storyContext,
      targetTimestampForEdit,
      timestamp,
    };
  }

  static createSyncMessage(): Proto.SyncMessage {
    const syncMessage = new Proto.SyncMessage();

    syncMessage.padding = this.getRandomPadding();

    return syncMessage;
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
    proto: Proto.Content | Proto.DataMessage | PlaintextContent;
    recipients: ReadonlyArray<ServiceIdString>;
    sendLogCallback?: SendLogCallbackType;
    story?: boolean;
    timestamp: number;
    urgent: boolean;
  }>): Promise<void> {
    const accountManager = window.getAccountManager();
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
      server: this.server,
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
    proto: Proto.Content | Proto.DataMessage | PlaintextContent;
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
    proto: Proto.DataMessage | Proto.Content | PlaintextContent;
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
    attachments,
    bodyRanges,
    contact,
    contentHint,
    deletedForEveryoneTimestamp,
    expireTimer,
    expireTimerVersion,
    groupId,
    serviceId,
    messageText,
    options,
    preview,
    profileKey,
    quote,
    reaction,
    sticker,
    storyContext,
    story,
    targetTimestampForEdit,
    timestamp,
    urgent,
    includePniSignatureMessage,
  }: Readonly<{
    attachments: ReadonlyArray<UploadedAttachmentType> | undefined;
    bodyRanges?: ReadonlyArray<RawBodyRange>;
    contact?: ReadonlyArray<EmbeddedContactWithUploadedAvatar>;
    contentHint: number;
    deletedForEveryoneTimestamp: number | undefined;
    expireTimer: DurationInSeconds | undefined;
    expireTimerVersion: number | undefined;
    groupId: string | undefined;
    serviceId: ServiceIdString;
    messageText: string | undefined;
    options?: SendOptionsType;
    preview?: ReadonlyArray<OutgoingLinkPreviewType> | undefined;
    profileKey?: Uint8Array;
    quote?: OutgoingQuoteType;
    reaction?: ReactionType;
    sticker?: OutgoingStickerType;
    storyContext?: StoryContextType;
    story?: boolean;
    targetTimestampForEdit?: number;
    timestamp: number;
    urgent: boolean;
    includePniSignatureMessage?: boolean;
  }>): Promise<CallbackResultType> {
    return this.sendMessage({
      messageOptions: {
        attachments,
        bodyRanges,
        body: messageText,
        contact,
        deletedForEveryoneTimestamp,
        expireTimer,
        expireTimerVersion,
        preview,
        profileKey,
        quote,
        reaction,
        recipients: [serviceId],
        sticker,
        storyContext,
        targetTimestampForEdit,
        timestamp,
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
    storyMessage?: Proto.StoryMessage;
    storyMessageRecipients?: ReadonlyArray<Proto.SyncMessage.Sent.IStoryMessageRecipient>;
  }>): Promise<CallbackResultType> {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const sentMessage = new Proto.SyncMessage.Sent();
    sentMessage.timestamp = Long.fromNumber(timestamp);

    if (encodedEditMessage) {
      const editMessage = Proto.EditMessage.decode(encodedEditMessage);
      sentMessage.editMessage = editMessage;
    } else if (encodedDataMessage) {
      const dataMessage = Proto.DataMessage.decode(encodedDataMessage);
      sentMessage.message = dataMessage;
    }
    if (destinationE164) {
      sentMessage.destinationE164 = destinationE164;
    }
    if (destinationServiceId) {
      sentMessage.destinationServiceId = destinationServiceId;
    }
    if (expirationStartTimestamp) {
      sentMessage.expirationStartTimestamp = Long.fromNumber(
        expirationStartTimestamp
      );
    }
    if (storyMessage) {
      sentMessage.storyMessage = storyMessage;
    }
    if (storyMessageRecipients) {
      sentMessage.storyMessageRecipients = storyMessageRecipients.slice();
    }

    if (isUpdate) {
      sentMessage.isRecipientUpdate = true;
    }

    // Though this field has 'unidentified' in the name, it should have entries for each
    //   number we sent to.
    if (!isEmpty(conversationIdsSentTo)) {
      sentMessage.unidentifiedStatus = await pMap(
        conversationIdsSentTo,
        async conversationId => {
          const status =
            new Proto.SyncMessage.Sent.UnidentifiedDeliveryStatus();
          const conv = window.ConversationController.get(conversationId);
          if (conv) {
            const serviceId = conv.getServiceId();
            if (serviceId) {
              status.destinationServiceId = serviceId;
            }
            if (isPniString(serviceId)) {
              const pniIdentityKey =
                await window.textsecure.storage.protocol.loadIdentityKey(
                  serviceId
                );
              if (pniIdentityKey) {
                status.destinationPniIdentityKey = pniIdentityKey;
              }
            }
          }
          status.unidentified =
            conversationIdsWithSealedSender.has(conversationId);
          return status;
        },
        { concurrency: 10 }
      );
    }

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: contentMessage,
      timestamp,
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent,
    });
  }

  static getRequestBlockSyncMessage(): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.BLOCKED;
    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'blockSyncRequest',
      urgent: false,
    };
  }

  static getRequestConfigurationSyncMessage(): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.CONFIGURATION;
    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'configurationSyncRequest',
      urgent: false,
    };
  }

  static getRequestContactSyncMessage(): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.CONTACTS;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'contactSyncRequest',
      urgent: true,
    };
  }

  static getFetchManifestSyncMessage(): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const fetchLatest = new Proto.SyncMessage.FetchLatest();
    fetchLatest.type = Proto.SyncMessage.FetchLatest.Type.STORAGE_MANIFEST;

    const syncMessage = this.createSyncMessage();
    syncMessage.fetchLatest = fetchLatest;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'fetchLatestManifestSync',
      urgent: false,
    };
  }

  static getFetchLocalProfileSyncMessage(): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const fetchLatest = new Proto.SyncMessage.FetchLatest();
    fetchLatest.type = Proto.SyncMessage.FetchLatest.Type.LOCAL_PROFILE;

    const syncMessage = this.createSyncMessage();
    syncMessage.fetchLatest = fetchLatest;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'fetchLocalProfileSync',
      urgent: false,
    };
  }

  static getRequestKeySyncMessage(): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.KEYS;

    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'keySyncRequest',
      urgent: true,
    };
  }

  static getDeleteForMeSyncMessage(
    data: DeleteForMeSyncEventData
  ): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const deleteForMe = new Proto.SyncMessage.DeleteForMe();
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
          item.mostRecentNonExpiringMessages?.map(toAddressableMessage);
        const conversation = toConversationIdentifier(item.conversation);

        deleteForMe.conversationDeletes = deleteForMe.conversationDeletes || [];
        deleteForMe.conversationDeletes.push({
          conversation,
          isFullDelete: true,
          mostRecentMessages,
          mostRecentNonExpiringMessages,
        });
      } else if (item.type === 'delete-local-conversation') {
        const conversation = toConversationIdentifier(item.conversation);

        deleteForMe.localOnlyConversationDeletes =
          deleteForMe.localOnlyConversationDeletes || [];
        deleteForMe.localOnlyConversationDeletes.push({
          conversation,
        });
      } else if (item.type === 'delete-single-attachment') {
        throw new Error(
          "getDeleteForMeSyncMessage: Desktop currently does not support sending 'delete-single-attachment' messages"
        );
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

        deleteForMe.messageDeletes = deleteForMe.messageDeletes || [];
        deleteForMe.messageDeletes.push({
          messages,
          conversation,
        });
      }
    }

    const syncMessage = this.createSyncMessage();
    syncMessage.deleteForMe = deleteForMe;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'deleteForMeSync',
      urgent: false,
    };
  }

  static getClearCallHistoryMessage(
    latestCall: CallHistoryDetails
  ): SingleProtoJobData {
    const ourAci = window.textsecure.storage.user.getCheckedAci();
    const callLogEvent = new Proto.SyncMessage.CallLogEvent({
      type: Proto.SyncMessage.CallLogEvent.Type.CLEAR,
      timestamp: Long.fromNumber(latestCall.timestamp),
      peerId: getBytesForPeerId(latestCall),
      callId: getCallIdForProto(latestCall),
    });

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.callLogEvent = callLogEvent;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'callLogEventSync',
      urgent: false,
    };
  }

  static getDeleteCallEvent(callDetails: CallDetails): SingleProtoJobData {
    const ourAci = window.textsecure.storage.user.getCheckedAci();
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

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.callEvent = callEvent;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'callLogEventSync',
      urgent: false,
    };
  }

  async syncReadMessages(
    reads: ReadonlyArray<{
      senderAci?: AciString;
      senderE164?: string;
      timestamp: number;
    }>,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.read = [];
    for (let i = 0; i < reads.length; i += 1) {
      const proto = new Proto.SyncMessage.Read({
        ...reads[i],
        timestamp: Long.fromNumber(reads[i].timestamp),
      });

      syncMessage.read.push(proto);
    }
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent: true,
    });
  }

  async syncView(
    views: ReadonlyArray<{
      senderAci?: AciString;
      senderE164?: string;
      timestamp: number;
    }>,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.viewed = views.map(
      view =>
        new Proto.SyncMessage.Viewed({
          ...view,
          timestamp: Long.fromNumber(view.timestamp),
        })
    );
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
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
    const { senderAci, timestamp } = viewOnceOpens[0];

    if (!senderAci) {
      throw new Error('syncViewOnceOpen: Missing senderAci');
    }

    const myAci = window.textsecure.storage.user.getCheckedAci();

    const syncMessage = MessageSender.createSyncMessage();

    const viewOnceOpen = new Proto.SyncMessage.ViewOnceOpen();
    viewOnceOpen.senderAci = senderAci;
    viewOnceOpen.timestamp = Long.fromNumber(timestamp);
    syncMessage.viewOnceOpen = viewOnceOpen;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      serviceId: myAci,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent: false,
    });
  }

  static getBlockSync(
    options: Readonly<{
      e164s: Array<string>;
      acis: Array<string>;
      groupIds: Array<Uint8Array>;
    }>
  ): SingleProtoJobData {
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const syncMessage = MessageSender.createSyncMessage();

    const blocked = new Proto.SyncMessage.Blocked();
    blocked.numbers = options.e164s;
    blocked.acis = options.acis;
    blocked.groupIds = options.groupIds;
    syncMessage.blocked = blocked;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
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
    const myAci = window.textsecure.storage.user.getCheckedAci();

    const syncMessage = MessageSender.createSyncMessage();

    const response = new Proto.SyncMessage.MessageRequestResponse();
    if (options.threadAci !== undefined) {
      response.threadAci = options.threadAci;
    }
    if (options.groupId) {
      response.groupId = options.groupId;
    }
    response.type = options.type;
    syncMessage.messageRequestResponse = response;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
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
    const myAci = window.textsecure.storage.user.getCheckedAci();
    const ENUM = Proto.SyncMessage.StickerPackOperation.Type;

    const packOperations = operations.map(item => {
      const { packId, packKey, installed } = item;

      const operation = new Proto.SyncMessage.StickerPackOperation();
      operation.packId = Bytes.fromHex(packId);
      operation.packKey = Bytes.fromBase64(packKey);
      operation.type = installed ? ENUM.INSTALL : ENUM.REMOVE;

      return operation;
    });

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.stickerPackOperation = packOperations;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
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
    const myAci = window.textsecure.storage.user.getCheckedAci();

    if (!destinationE164 && !destinationAci) {
      throw new Error('syncVerification: Neither e164 nor UUID were provided');
    }

    const padding = MessageSender.getRandomPadding();

    const verified = new Proto.Verified();
    verified.state = state;
    if (destinationAci) {
      verified.destinationAci = destinationAci;
    }
    verified.identityKey = identityKey;
    verified.nullMessage = padding;

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.verified = verified;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      serviceId: myAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'verificationSync',
      urgent: false,
    };
  }

  // Sending messages to contacts

  async sendCallingMessage(
    serviceId: ServiceIdString,
    callingMessage: Readonly<Proto.ICallMessage>,
    timestamp: number,
    urgent: boolean,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    const recipients = [serviceId];

    const contentMessage = new Proto.Content();
    contentMessage.callMessage = callingMessage;

    const conversation = window.ConversationController.get(serviceId);

    addPniSignatureMessageToProto({
      conversation,
      proto: contentMessage,
      reason: `sendCallingMessage(${timestamp})`,
    });

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendMessageProtoAndWait({
      timestamp,
      recipients,
      proto: contentMessage,
      contentHint: ContentHint.DEFAULT,
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

    const receiptMessage = new Proto.ReceiptMessage();
    receiptMessage.type = type;
    receiptMessage.timestamp = timestamps.map(receiptTimestamp =>
      Long.fromNumber(receiptTimestamp)
    );

    const contentMessage = new Proto.Content();
    contentMessage.receiptMessage = receiptMessage;

    if (isDirectConversation) {
      const conversation = window.ConversationController.get(senderAci);

      addPniSignatureMessageToProto({
        conversation,
        proto: contentMessage,
        reason: `sendReceiptMessage(${type}, ${timestamp})`,
      });
    }

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      serviceId: senderAci,
      proto: contentMessage,
      timestamp,
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent: false,
    });
  }

  static getNullMessage(
    options: Readonly<{
      padding?: Uint8Array;
    }> = {}
  ): Proto.Content {
    const nullMessage = new Proto.NullMessage();
    nullMessage.padding = options.padding || MessageSender.getRandomPadding();

    const contentMessage = new Proto.Content();
    contentMessage.nullMessage = nullMessage;

    return contentMessage;
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
    proto: Buffer;
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
    proto: Proto.Content;
    recipients: ReadonlyArray<ServiceIdString>;
    sendLogCallback?: SendLogCallbackType;
    story?: boolean;
    timestamp: number;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    const myE164 = window.textsecure.storage.user.getNumber();
    const myAci = window.textsecure.storage.user.getAci();
    const serviceIds = recipients.filter(id => id !== myE164 && id !== myAci);

    if (serviceIds.length === 0) {
      const dataMessage = proto.dataMessage
        ? Proto.DataMessage.encode(proto.dataMessage).finish()
        : undefined;

      const editMessage = proto.editMessage
        ? Proto.EditMessage.encode(proto.editMessage).finish()
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
  ): Promise<Proto.Content> {
    const ourAci = window.textsecure.storage.user.getCheckedAci();
    const ourDeviceId = parseIntOrThrow(
      window.textsecure.storage.user.getDeviceId(),
      'getSenderKeyDistributionMessage'
    );

    const protocolAddress = ProtocolAddress.new(ourAci, ourDeviceId);
    const address = new QualifiedAddress(
      ourAci,
      new Address(ourAci, ourDeviceId)
    );

    const senderKeyDistributionMessage =
      await window.textsecure.storage.protocol.enqueueSenderKeyJob(
        address,
        async () => {
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
        }
      );

    log.info(
      `getSenderKeyDistributionMessage: Building ${distributionId} with timestamp ${timestamp}`
    );
    const contentMessage = new Proto.Content();
    contentMessage.senderKeyDistributionMessage =
      senderKeyDistributionMessage.serialize();

    return contentMessage;
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
    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
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
            contentHint: contentHint ?? ContentHint.IMPLICIT,
            proto: Buffer.from(Proto.Content.encode(contentMessage).finish()),
            sendType: 'senderKeyDistributionMessage',
            timestamp,
            urgent,
            hasPniSignatureMessage: false,
          })
        : undefined;

    return this.sendGroupProto({
      contentHint: contentHint ?? ContentHint.IMPLICIT,
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

  // Simple pass-throughs

  // Note: instead of updating these functions, or adding new ones, remove these and go
  //   directly to window.textsecure.messaging.server.<function>

  async getAvatar(path: string): Promise<ReturnType<WebAPIType['getAvatar']>> {
    return this.server.getAvatar(path);
  }

  async getSticker(
    packId: string,
    stickerId: number
  ): Promise<ReturnType<WebAPIType['getSticker']>> {
    return this.server.getSticker(packId, stickerId);
  }

  async getStickerPackManifest(
    packId: string
  ): Promise<ReturnType<WebAPIType['getStickerPackManifest']>> {
    return this.server.getStickerPackManifest(packId);
  }

  async createGroup(
    group: Readonly<Proto.IGroup>,
    options: Readonly<GroupCredentialsType>
  ): Promise<Proto.IGroupResponse> {
    return this.server.createGroup(group, options);
  }

  async uploadGroupAvatar(
    avatar: Readonly<Uint8Array>,
    options: Readonly<GroupCredentialsType>
  ): Promise<string> {
    return this.server.uploadGroupAvatar(avatar, options);
  }

  async getGroup(
    options: Readonly<GroupCredentialsType>
  ): Promise<Proto.IGroupResponse> {
    return this.server.getGroup(options);
  }

  async getGroupFromLink(
    groupInviteLink: string | undefined,
    auth: Readonly<GroupCredentialsType>
  ): Promise<Proto.GroupJoinInfo> {
    return this.server.getGroupFromLink(groupInviteLink, auth);
  }

  async getGroupLog(
    options: GetGroupLogOptionsType,
    credentials: GroupCredentialsType
  ): Promise<GroupLogResponseType> {
    return this.server.getGroupLog(options, credentials);
  }

  async getGroupAvatar(key: string): Promise<Uint8Array> {
    return this.server.getGroupAvatar(key);
  }

  async modifyGroup(
    changes: Readonly<Proto.GroupChange.IActions>,
    options: Readonly<GroupCredentialsType>,
    inviteLinkBase64?: string
  ): Promise<Proto.IGroupChangeResponse> {
    return this.server.modifyGroup(changes, options, inviteLinkBase64);
  }

  async fetchLinkPreviewMetadata(
    href: string,
    abortSignal: AbortSignal
  ): Promise<null | LinkPreviewMetadata> {
    return this.server.fetchLinkPreviewMetadata(href, abortSignal);
  }

  async fetchLinkPreviewImage(
    href: string,
    abortSignal: AbortSignal
  ): Promise<null | LinkPreviewImage> {
    return this.server.fetchLinkPreviewImage(href, abortSignal);
  }

  async getStorageCredentials(): Promise<StorageServiceCredentials> {
    return this.server.getStorageCredentials();
  }

  async getStorageManifest(
    options: Readonly<StorageServiceCallOptionsType>
  ): Promise<Uint8Array> {
    return this.server.getStorageManifest(options);
  }

  async getStorageRecords(
    data: Readonly<Uint8Array>,
    options: Readonly<StorageServiceCallOptionsType>
  ): Promise<Uint8Array> {
    return this.server.getStorageRecords(data, options);
  }

  async modifyStorageRecords(
    data: Readonly<Uint8Array>,
    options: Readonly<StorageServiceCallOptionsType>
  ): Promise<Uint8Array> {
    return this.server.modifyStorageRecords(data, options);
  }

  async getGroupMembershipToken(
    options: Readonly<GroupCredentialsType>
  ): Promise<Proto.IExternalGroupCredential> {
    return this.server.getExternalGroupCredential(options);
  }

  public async sendChallengeResponse(
    challengeResponse: Readonly<ChallengeType>
  ): Promise<void> {
    return this.server.sendChallengeResponse(challengeResponse);
  }
}

// Helpers

function toAddressableMessage(message: MessageToDelete) {
  const targetMessage = new Proto.SyncMessage.DeleteForMe.AddressableMessage();
  targetMessage.sentTimestamp = Long.fromNumber(message.sentAt);

  if (message.type === 'aci') {
    targetMessage.authorServiceId = message.authorAci;
  } else if (message.type === 'e164') {
    targetMessage.authorE164 = message.authorE164;
  } else if (message.type === 'pni') {
    targetMessage.authorServiceId = message.authorPni;
  } else {
    throw missingCaseError(message);
  }

  return targetMessage;
}

function toConversationIdentifier(conversation: ConversationToDelete) {
  const targetConversation =
    new Proto.SyncMessage.DeleteForMe.ConversationIdentifier();

  if (conversation.type === 'aci') {
    targetConversation.threadServiceId = conversation.aci;
  } else if (conversation.type === 'pni') {
    targetConversation.threadServiceId = conversation.pni;
  } else if (conversation.type === 'group') {
    targetConversation.threadGroupId = Bytes.fromBase64(conversation.groupId);
  } else if (conversation.type === 'e164') {
    targetConversation.threadE164 = conversation.e164;
  } else {
    throw missingCaseError(conversation);
  }

  return targetConversation;
}
