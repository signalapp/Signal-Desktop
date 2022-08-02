// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-bitwise */
/* eslint-disable max-classes-per-file */

import { z } from 'zod';
import type { Dictionary } from 'lodash';
import Long from 'long';
import PQueue from 'p-queue';
import type { PlaintextContent } from '@signalapp/libsignal-client';
import {
  ProtocolAddress,
  SenderKeyDistributionMessage,
} from '@signalapp/libsignal-client';

import type { QuotedMessageType } from '../model-types.d';
import { GLOBAL_ZONE } from '../SignalProtocolStore';
import { assert } from '../util/assert';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { SenderKeys } from '../LibSignalStores';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import { MIMETypeToString } from '../types/MIME';
import type * as Attachment from '../types/Attachment';
import type { UUID, UUIDStringType } from '../types/UUID';
import type {
  ChallengeType,
  GetGroupLogOptionsType,
  GetProfileOptionsType,
  GetProfileUnauthOptionsType,
  GroupCredentialsType,
  GroupLogResponseType,
  ProfileRequestDataType,
  ProxiedRequestOptionsType,
  UploadAvatarHeadersType,
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
import type { CDSResponseType } from './cds/Types.d';
import * as Bytes from '../Bytes';
import { getRandomBytes, getZeroes, encryptAttachment } from '../Crypto';
import {
  MessageError,
  SignedPreKeyRotationError,
  SendMessageProtoError,
  HTTPError,
} from './Errors';
import type { BodyRangesType, StoryContextType } from '../types/Util';
import type {
  LinkPreviewImage,
  LinkPreviewMetadata,
} from '../linkPreviews/linkPreviewFetch';
import { concat, isEmpty, map } from '../util/iterables';
import type { SendTypesType } from '../util/handleMessageSend';
import { shouldSaveProto, sendTypesEnum } from '../util/handleMessageSend';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import type { Avatar, EmbeddedContactType } from '../types/EmbeddedContact';
import {
  numberToPhoneType,
  numberToEmailType,
  numberToAddressType,
} from '../types/EmbeddedContact';
import type { StickerWithHydratedData } from '../types/Stickers';

export type SendMetadataType = {
  [identifier: string]: {
    accessKey: string;
    senderCertificate?: SerializedCertificateType;
  };
};

export type SendOptionsType = {
  sendMetadata?: SendMetadataType;
  online?: boolean;
};

type QuoteAttachmentType = {
  thumbnail?: AttachmentType;
  attachmentPointer?: Proto.IAttachmentPointer;
};

export type GroupV2InfoType = {
  groupChange?: Uint8Array;
  masterKey: Uint8Array;
  revision: number;
  members: Array<string>;
};
export type GroupV1InfoType = {
  id: string;
  members: Array<string>;
};

type GroupCallUpdateType = {
  eraId: string;
};

export type StickerType = StickerWithHydratedData & {
  attachmentPointer?: Proto.IAttachmentPointer;
};

export type ReactionType = {
  emoji?: string;
  remove?: boolean;
  targetAuthorUuid?: string;
  targetTimestamp?: number;
};

export type AttachmentType = {
  size: number;
  data: Uint8Array;
  contentType: string;

  fileName?: string;
  flags?: number;
  width?: number;
  height?: number;
  caption?: string;

  attachmentPointer?: Proto.IAttachmentPointer;

  blurHash?: string;
};

export const singleProtoJobDataSchema = z.object({
  contentHint: z.number(),
  identifier: z.string(),
  isSyncMessage: z.boolean(),
  messageIds: z.array(z.string()).optional(),
  protoBase64: z.string(),
  type: sendTypesEnum,
  urgent: z.boolean().optional(),
});

export type SingleProtoJobData = z.infer<typeof singleProtoJobDataSchema>;

function makeAttachmentSendReady(
  attachment: Attachment.AttachmentType
): AttachmentType | undefined {
  const { data } = attachment;

  if (!data) {
    throw new Error(
      'makeAttachmentSendReady: Missing data, returning undefined'
    );
  }

  return {
    ...attachment,
    contentType: MIMETypeToString(attachment.contentType),
    data,
  };
}

export type ContactWithHydratedAvatar = EmbeddedContactType & {
  avatar?: Avatar & {
    attachmentPointer?: Proto.IAttachmentPointer;
  };
};

export type MessageOptionsType = {
  attachments?: ReadonlyArray<AttachmentType> | null;
  body?: string;
  contact?: Array<ContactWithHydratedAvatar>;
  expireTimer?: number;
  flags?: number;
  group?: {
    id: string;
    type: number;
  };
  groupV2?: GroupV2InfoType;
  needsSync?: boolean;
  preview?: ReadonlyArray<LinkPreviewType>;
  profileKey?: Uint8Array;
  quote?: QuotedMessageType | null;
  recipients: ReadonlyArray<string>;
  sticker?: StickerWithHydratedData;
  reaction?: ReactionType;
  deletedForEveryoneTimestamp?: number;
  timestamp: number;
  mentions?: BodyRangesType;
  groupCallUpdate?: GroupCallUpdateType;
  storyContext?: StoryContextType;
};
export type GroupSendOptionsType = {
  attachments?: Array<AttachmentType>;
  contact?: Array<ContactWithHydratedAvatar>;
  deletedForEveryoneTimestamp?: number;
  expireTimer?: number;
  flags?: number;
  groupCallUpdate?: GroupCallUpdateType;
  groupV1?: GroupV1InfoType;
  groupV2?: GroupV2InfoType;
  mentions?: BodyRangesType;
  messageText?: string;
  preview?: ReadonlyArray<LinkPreviewType>;
  profileKey?: Uint8Array;
  quote?: QuotedMessageType | null;
  reaction?: ReactionType;
  sticker?: StickerWithHydratedData;
  storyContext?: StoryContextType;
  timestamp: number;
};

class Message {
  attachments: ReadonlyArray<AttachmentType>;

  body?: string;

  contact?: Array<ContactWithHydratedAvatar>;

  expireTimer?: number;

  flags?: number;

  group?: {
    id: string;
    type: number;
  };

  groupV2?: GroupV2InfoType;

  needsSync?: boolean;

  preview?: ReadonlyArray<LinkPreviewType>;

  profileKey?: Uint8Array;

  quote?: QuotedMessageType | null;

  recipients: ReadonlyArray<string>;

  sticker?: StickerType;

  reaction?: ReactionType;

  timestamp: number;

  dataMessage?: Proto.DataMessage;

  attachmentPointers: Array<Proto.IAttachmentPointer> = [];

  deletedForEveryoneTimestamp?: number;

  mentions?: BodyRangesType;

  groupCallUpdate?: GroupCallUpdateType;

  storyContext?: StoryContextType;

  constructor(options: MessageOptionsType) {
    this.attachments = options.attachments || [];
    this.body = options.body;
    this.contact = options.contact;
    this.expireTimer = options.expireTimer;
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
    this.mentions = options.mentions;
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

    if (this.expireTimer !== undefined && this.expireTimer !== null) {
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
        this.body !== null ||
        this.group !== null ||
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
    proto.attachments = this.attachmentPointers;

    if (this.body) {
      proto.body = this.body;

      const mentionCount = this.mentions ? this.mentions.length : 0;
      const placeholders = this.body.match(/\uFFFC/g);
      const placeholderCount = placeholders ? placeholders.length : 0;
      log.info(
        `Sending a message with ${mentionCount} mentions and ${placeholderCount} placeholders`
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
    } else if (this.group) {
      proto.group = new Proto.GroupContext();
      proto.group.id = Bytes.fromString(this.group.id);
      proto.group.type = this.group.type;
    }
    if (this.sticker) {
      proto.sticker = new Proto.DataMessage.Sticker();
      proto.sticker.packId = Bytes.fromHex(this.sticker.packId);
      proto.sticker.packKey = Bytes.fromBase64(this.sticker.packKey);
      proto.sticker.stickerId = this.sticker.stickerId;
      proto.sticker.emoji = this.sticker.emoji;

      if (this.sticker.attachmentPointer) {
        proto.sticker.data = this.sticker.attachmentPointer;
      }
    }
    if (this.reaction) {
      proto.reaction = new Proto.DataMessage.Reaction();
      proto.reaction.emoji = this.reaction.emoji || null;
      proto.reaction.remove = this.reaction.remove || false;
      proto.reaction.targetAuthorUuid = this.reaction.targetAuthorUuid || null;
      proto.reaction.targetTimestamp =
        this.reaction.targetTimestamp === undefined
          ? null
          : Long.fromNumber(this.reaction.targetTimestamp);
    }

    if (Array.isArray(this.preview)) {
      proto.preview = this.preview.map(preview => {
        const item = new Proto.DataMessage.Preview();
        item.title = preview.title;
        item.url = preview.url;
        item.description = preview.description || null;
        item.date = preview.date || null;
        if (preview.attachmentPointer) {
          item.image = preview.attachmentPointer;
        }
        return item;
      });
    }
    if (Array.isArray(this.contact)) {
      proto.contact = this.contact.map(contact => {
        const contactProto = new Proto.DataMessage.Contact();
        if (contact.name) {
          const nameProto: Proto.DataMessage.Contact.IName = {
            givenName: contact.name.givenName,
            familyName: contact.name.familyName,
            prefix: contact.name.prefix,
            suffix: contact.name.suffix,
            middleName: contact.name.middleName,
            displayName: contact.name.displayName,
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
        if (contact.avatar && contact.avatar.attachmentPointer) {
          const avatarProto = new Proto.DataMessage.Contact.Avatar();
          avatarProto.avatar = contact.avatar.attachmentPointer;
          avatarProto.isProfile = Boolean(contact.avatar.isProfile);
          contactProto.avatar = avatarProto;
        }

        if (contact.organization) {
          contactProto.organization = contact.organization;
        }

        return contactProto;
      });
    }

    if (this.quote) {
      const { QuotedAttachment } = Proto.DataMessage.Quote;
      const { BodyRange, Quote } = Proto.DataMessage;

      proto.quote = new Quote();
      const { quote } = proto;

      if (this.quote.isGiftBadge) {
        quote.type = Proto.DataMessage.Quote.Type.GIFT_BADGE;
      } else {
        quote.type = Proto.DataMessage.Quote.Type.NORMAL;
      }

      quote.id =
        this.quote.id === undefined ? null : Long.fromNumber(this.quote.id);
      quote.authorUuid = this.quote.authorUuid || null;
      quote.text = this.quote.text || null;
      quote.attachments = (this.quote.attachments || []).map(
        (attachment: AttachmentType) => {
          const quotedAttachment = new QuotedAttachment();

          quotedAttachment.contentType = attachment.contentType;
          if (attachment.fileName) {
            quotedAttachment.fileName = attachment.fileName;
          }
          if (attachment.attachmentPointer) {
            quotedAttachment.thumbnail = attachment.attachmentPointer;
          }

          return quotedAttachment;
        }
      );
      const bodyRanges: BodyRangesType = this.quote.bodyRanges || [];
      quote.bodyRanges = bodyRanges.map(range => {
        const bodyRange = new BodyRange();
        bodyRange.start = range.start;
        bodyRange.length = range.length;
        if (range.mentionUuid !== undefined) {
          bodyRange.mentionUuid = range.mentionUuid;
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
    if (this.profileKey) {
      proto.profileKey = this.profileKey;
    }
    if (this.deletedForEveryoneTimestamp) {
      proto.delete = {
        targetSentTimestamp: Long.fromNumber(this.deletedForEveryoneTimestamp),
      };
    }
    if (this.mentions) {
      proto.requiredProtocolVersion =
        Proto.DataMessage.ProtocolVersion.MENTIONS;
      proto.bodyRanges = this.mentions.map(
        ({ start, length, mentionUuid }) => ({
          start,
          length,
          mentionUuid,
        })
      );
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
      if (this.storyContext.authorUuid) {
        storyContext.authorUuid = this.storyContext.authorUuid;
      }
      storyContext.sentTimestamp = Long.fromNumber(this.storyContext.timestamp);

      proto.storyContext = storyContext;
    }

    this.dataMessage = proto;
    return proto;
  }

  encode() {
    return Proto.DataMessage.encode(this.toProto()).finish();
  }
}

export default class MessageSender {
  pendingMessages: {
    [id: string]: PQueue;
  };

  constructor(public readonly server: WebAPIType) {
    this.pendingMessages = {};
  }

  async queueJobForIdentifier<T>(
    identifier: string,
    runJob: () => Promise<T>
  ): Promise<T> {
    const { id } = await window.ConversationController.getOrCreateAndWait(
      identifier,
      'private'
    );
    this.pendingMessages[id] =
      this.pendingMessages[id] || new PQueue({ concurrency: 1 });

    const queue = this.pendingMessages[id];

    const taskWithTimeout = createTaskWithTimeout(
      runJob,
      `queueJobForIdentifier ${identifier} ${id}`
    );

    return queue.add(taskWithTimeout);
  }

  // Attachment upload functions

  _getAttachmentSizeBucket(size: number): number {
    return Math.max(
      541,
      Math.floor(1.05 ** Math.ceil(Math.log(size) / Math.log(1.05)))
    );
  }

  static getRandomPadding(): Uint8Array {
    // Generate a random int from 1 and 512
    const buffer = getRandomBytes(2);
    const paddingLength = (new Uint16Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    return getRandomBytes(paddingLength);
  }

  getPaddedAttachment(data: Readonly<Uint8Array>): Uint8Array {
    const size = data.byteLength;
    const paddedSize = this._getAttachmentSizeBucket(size);
    const padding = getZeroes(paddedSize - size);

    return Bytes.concatenate([data, padding]);
  }

  async makeAttachmentPointer(
    attachment: Readonly<
      Partial<AttachmentType> &
        Pick<AttachmentType, 'data' | 'size' | 'contentType'>
    >
  ): Promise<Proto.IAttachmentPointer> {
    assert(
      typeof attachment === 'object' && attachment !== null,
      'Got null attachment in `makeAttachmentPointer`'
    );

    const { data, size, contentType } = attachment;
    if (!(data instanceof Uint8Array)) {
      throw new Error(
        `makeAttachmentPointer: data was a '${typeof data}' instead of Uint8Array`
      );
    }
    if (data.byteLength !== size) {
      throw new Error(
        `makeAttachmentPointer: Size ${size} did not match data.byteLength ${data.byteLength}`
      );
    }
    if (typeof contentType !== 'string') {
      throw new Error(
        `makeAttachmentPointer: contentType ${contentType} was not a string`
      );
    }

    const padded = this.getPaddedAttachment(data);
    const key = getRandomBytes(64);
    const iv = getRandomBytes(16);

    const result = encryptAttachment(padded, key, iv);
    const id = await this.server.putAttachment(result.ciphertext);

    const proto = new Proto.AttachmentPointer();
    proto.cdnId = Long.fromString(id);
    proto.contentType = attachment.contentType;
    proto.key = key;
    proto.size = data.byteLength;
    proto.digest = result.digest;

    if (attachment.fileName) {
      proto.fileName = attachment.fileName;
    }
    if (attachment.flags) {
      proto.flags = attachment.flags;
    }
    if (attachment.width) {
      proto.width = attachment.width;
    }
    if (attachment.height) {
      proto.height = attachment.height;
    }
    if (attachment.caption) {
      proto.caption = attachment.caption;
    }
    if (attachment.blurHash) {
      proto.blurHash = attachment.blurHash;
    }

    return proto;
  }

  async uploadAttachments(message: Message): Promise<void> {
    try {
      // eslint-disable-next-line no-param-reassign
      message.attachmentPointers = await Promise.all(
        message.attachments.map(attachment =>
          this.makeAttachmentPointer(attachment)
        )
      );
    } catch (error) {
      if (error instanceof HTTPError) {
        throw new MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  async uploadLinkPreviews(message: Message): Promise<void> {
    try {
      const preview = await Promise.all(
        (message.preview || []).map(async (item: Readonly<LinkPreviewType>) => {
          if (!item.image) {
            return item;
          }
          const attachment = makeAttachmentSendReady(item.image);
          if (!attachment) {
            return item;
          }

          return {
            ...item,
            attachmentPointer: await this.makeAttachmentPointer(attachment),
          };
        })
      );
      // eslint-disable-next-line no-param-reassign
      message.preview = preview;
    } catch (error) {
      if (error instanceof HTTPError) {
        throw new MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  async uploadSticker(message: Message): Promise<void> {
    try {
      const { sticker } = message;

      if (!sticker) {
        return;
      }
      if (!sticker.data) {
        throw new Error('uploadSticker: No sticker data to upload!');
      }

      // eslint-disable-next-line no-param-reassign
      message.sticker = {
        ...sticker,
        attachmentPointer: await this.makeAttachmentPointer(sticker.data),
      };
    } catch (error) {
      if (error instanceof HTTPError) {
        throw new MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  async uploadContactAvatar(message: Message): Promise<void> {
    const { contact } = message;
    if (!contact || contact.length === 0) {
      return;
    }

    try {
      await Promise.all(
        contact.map(async (item: ContactWithHydratedAvatar) => {
          const itemAvatar = item?.avatar;
          const avatar = itemAvatar?.avatar;

          if (!itemAvatar || !avatar || !avatar.data) {
            return;
          }

          const attachment = makeAttachmentSendReady(avatar);
          if (!attachment) {
            return;
          }

          itemAvatar.attachmentPointer = await this.makeAttachmentPointer(
            attachment
          );
        })
      );
    } catch (error) {
      if (error instanceof HTTPError) {
        throw new MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  async uploadThumbnails(message: Message): Promise<void> {
    const { quote } = message;
    if (!quote || !quote.attachments || quote.attachments.length === 0) {
      return;
    }

    try {
      await Promise.all(
        quote.attachments.map(async (attachment: QuoteAttachmentType) => {
          if (!attachment.thumbnail) {
            return;
          }

          // eslint-disable-next-line no-param-reassign
          attachment.attachmentPointer = await this.makeAttachmentPointer(
            attachment.thumbnail
          );
        })
      );
    } catch (error) {
      if (error instanceof HTTPError) {
        throw new MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  // Proto assembly

  async getTextAttachmentProto(
    attachmentAttrs: Attachment.TextAttachmentType
  ): Promise<Proto.TextAttachment> {
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
      const previewImage = attachmentAttrs.preview.image;
      // This cast is OK because we're ensuring that previewImage.data is truthy
      const image =
        previewImage && previewImage.data
          ? await this.makeAttachmentPointer(previewImage as AttachmentType)
          : undefined;

      textAttachment.preview = {
        image,
        title: attachmentAttrs.preview.title,
        url: attachmentAttrs.preview.url,
      };
    }

    if (attachmentAttrs.gradient) {
      textAttachment.gradient = attachmentAttrs.gradient;
      textAttachment.background = 'gradient';
    } else {
      textAttachment.color = attachmentAttrs.color;
      textAttachment.background = 'color';
    }

    return textAttachment;
  }

  async getDataMessage(
    options: Readonly<MessageOptionsType>
  ): Promise<Uint8Array> {
    const message = await this.getHydratedMessage(options);
    return message.encode();
  }

  async getStoryMessage({
    allowsReplies,
    fileAttachment,
    groupV2,
    profileKey,
    textAttachment,
  }: {
    allowsReplies?: boolean;
    fileAttachment?: AttachmentType;
    groupV2?: GroupV2InfoType;
    profileKey: Uint8Array;
    textAttachment?: Attachment.TextAttachmentType;
  }): Promise<Proto.StoryMessage> {
    const storyMessage = new Proto.StoryMessage();
    storyMessage.profileKey = profileKey;

    if (fileAttachment) {
      try {
        const attachmentPointer = await this.makeAttachmentPointer(
          fileAttachment
        );
        storyMessage.fileAttachment = attachmentPointer;
      } catch (error) {
        if (error instanceof HTTPError) {
          throw new MessageError(message, error);
        } else {
          throw error;
        }
      }
    }

    if (textAttachment) {
      storyMessage.textAttachment = await this.getTextAttachmentProto(
        textAttachment
      );
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
    options: Readonly<MessageOptionsType>
  ): Promise<Proto.Content> {
    const message = await this.getHydratedMessage(options);
    const dataMessage = message.toProto();

    const contentMessage = new Proto.Content();
    contentMessage.dataMessage = dataMessage;

    return contentMessage;
  }

  async getHydratedMessage(
    attributes: Readonly<MessageOptionsType>
  ): Promise<Message> {
    const message = new Message(attributes);
    await Promise.all([
      this.uploadAttachments(message),
      this.uploadContactAvatar(message),
      this.uploadThumbnails(message),
      this.uploadLinkPreviews(message),
      this.uploadSticker(message),
    ]);

    return message;
  }

  getTypingContentMessage(
    options: Readonly<{
      recipientId?: string;
      groupId?: Uint8Array;
      groupMembers: ReadonlyArray<string>;
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

    return contentMessage;
  }

  getAttrsFromGroupOptions(
    options: Readonly<GroupSendOptionsType>
  ): MessageOptionsType {
    const {
      attachments,
      contact,
      deletedForEveryoneTimestamp,
      expireTimer,
      flags,
      groupCallUpdate,
      groupV1,
      groupV2,
      mentions,
      messageText,
      preview,
      profileKey,
      quote,
      reaction,
      sticker,
      storyContext,
      timestamp,
    } = options;

    if (!groupV1 && !groupV2) {
      throw new Error(
        'getAttrsFromGroupOptions: Neither group1 nor groupv2 information provided!'
      );
    }

    const myE164 = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid()?.toString();

    const groupMembers = groupV2?.members || groupV1?.members || [];

    // We should always have a UUID but have this check just in case we don't.
    let isNotMe: (recipient: string) => boolean;
    if (myUuid) {
      isNotMe = r => r !== myE164 && r !== myUuid.toString();
    } else {
      isNotMe = r => r !== myE164;
    }

    const blockedIdentifiers = new Set(
      concat(
        window.storage.blocked.getBlockedUuids(),
        window.storage.blocked.getBlockedNumbers()
      )
    );

    const recipients = groupMembers.filter(
      recipient => isNotMe(recipient) && !blockedIdentifiers.has(recipient)
    );

    return {
      attachments,
      body: messageText,
      contact,
      deletedForEveryoneTimestamp,
      expireTimer,
      flags,
      groupCallUpdate,
      groupV2,
      group: groupV1
        ? {
            id: groupV1.id,
            type: Proto.GroupContext.Type.DELIVER,
          }
        : undefined,
      mentions,
      preview,
      profileKey,
      quote,
      reaction,
      recipients,
      sticker,
      storyContext,
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
  }: Readonly<{
    messageOptions: MessageOptionsType;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    const message = await this.getHydratedMessage(messageOptions);

    return new Promise((resolve, reject) => {
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
        proto: message.toProto(),
        recipients: message.recipients || [],
        timestamp: message.timestamp,
        urgent,
      });
    });
  }

  sendMessageProto({
    callback,
    contentHint,
    groupId,
    options,
    proto,
    recipients,
    sendLogCallback,
    timestamp,
    urgent,
  }: Readonly<{
    callback: (result: CallbackResultType) => void;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    proto: Proto.Content | Proto.DataMessage | PlaintextContent;
    recipients: ReadonlyArray<string>;
    sendLogCallback?: SendLogCallbackType;
    timestamp: number;
    urgent: boolean;
  }>): void {
    const rejections = window.textsecure.storage.get(
      'signedKeyRotationRejected',
      0
    );
    if (rejections > 5) {
      throw new SignedPreKeyRotationError();
    }

    const outgoing = new OutgoingMessage({
      callback,
      contentHint,
      groupId,
      identifiers: recipients,
      message: proto,
      options,
      sendLogCallback,
      server: this.server,
      timestamp,
      urgent,
    });

    recipients.forEach(identifier => {
      this.queueJobForIdentifier(identifier, async () =>
        outgoing.sendToIdentifier(identifier)
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
  }: Readonly<{
    timestamp: number;
    recipients: Array<string>;
    proto: Proto.Content | Proto.DataMessage | PlaintextContent;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    return new Promise((resolve, reject) => {
      const callback = (result: CallbackResultType) => {
        if (result && result.errors && result.errors.length > 0) {
          reject(new SendMessageProtoError(result));
          return;
        }
        resolve(result);
      };

      this.sendMessageProto({
        callback,
        contentHint,
        groupId,
        options,
        proto,
        recipients,
        timestamp,
        urgent,
      });
    });
  }

  async sendIndividualProto({
    contentHint,
    groupId,
    identifier,
    options,
    proto,
    timestamp,
    urgent,
  }: Readonly<{
    contentHint: number;
    groupId?: string;
    identifier: string | undefined;
    options?: SendOptionsType;
    proto: Proto.DataMessage | Proto.Content | PlaintextContent;
    timestamp: number;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    assert(identifier, "Identifier can't be undefined");
    return new Promise((resolve, reject) => {
      const callback = (res: CallbackResultType) => {
        if (res && res.errors && res.errors.length > 0) {
          reject(new SendMessageProtoError(res));
        } else {
          resolve(res);
        }
      };
      this.sendMessageProto({
        callback,
        contentHint,
        groupId,
        options,
        proto,
        recipients: [identifier],
        timestamp,
        urgent,
      });
    });
  }

  // You might wonder why this takes a groupId. models/messages.resend() can send a group
  //   message to just one person.
  async sendMessageToIdentifier({
    attachments,
    contact,
    contentHint,
    deletedForEveryoneTimestamp,
    expireTimer,
    groupId,
    identifier,
    messageText,
    options,
    preview,
    profileKey,
    quote,
    reaction,
    sticker,
    storyContext,
    timestamp,
    urgent,
  }: Readonly<{
    attachments: ReadonlyArray<AttachmentType> | undefined;
    contact?: Array<ContactWithHydratedAvatar>;
    contentHint: number;
    deletedForEveryoneTimestamp: number | undefined;
    expireTimer: number | undefined;
    groupId: string | undefined;
    identifier: string;
    messageText: string | undefined;
    options?: SendOptionsType;
    preview?: ReadonlyArray<LinkPreviewType> | undefined;
    profileKey?: Uint8Array;
    quote?: QuotedMessageType | null;
    reaction?: ReactionType;
    sticker?: StickerWithHydratedData;
    storyContext?: StoryContextType;
    timestamp: number;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    return this.sendMessage({
      messageOptions: {
        attachments,
        body: messageText,
        contact,
        deletedForEveryoneTimestamp,
        expireTimer,
        preview,
        profileKey,
        quote,
        reaction,
        recipients: [identifier],
        sticker,
        storyContext,
        timestamp,
      },
      contentHint,
      groupId,
      options,
      urgent,
    });
  }

  // Support for sync messages

  // Note: this is used for sending real messages to your other devices after sending a
  //   message to others.
  async sendSyncMessage({
    encodedDataMessage,
    timestamp,
    destination,
    destinationUuid,
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
    timestamp: number;
    destination: string | undefined;
    destinationUuid: string | null | undefined;
    expirationStartTimestamp: number | null;
    conversationIdsSentTo?: Iterable<string>;
    conversationIdsWithSealedSender?: Set<string>;
    isUpdate?: boolean;
    urgent: boolean;
    options?: SendOptionsType;
    storyMessage?: Proto.StoryMessage;
    storyMessageRecipients?: Array<{
      destinationUuid: string;
      distributionListIds: Array<string>;
      isAllowedToReply: boolean;
    }>;
  }>): Promise<CallbackResultType> {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const sentMessage = new Proto.SyncMessage.Sent();
    sentMessage.timestamp = Long.fromNumber(timestamp);

    if (encodedDataMessage) {
      const dataMessage = Proto.DataMessage.decode(encodedDataMessage);
      sentMessage.message = dataMessage;
    }
    if (destination) {
      sentMessage.destination = destination;
    }
    if (destinationUuid) {
      sentMessage.destinationUuid = destinationUuid;
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
      sentMessage.storyMessageRecipients = storyMessageRecipients.map(
        recipient => {
          const storyMessageRecipient =
            new Proto.SyncMessage.Sent.StoryMessageRecipient();
          storyMessageRecipient.destinationUuid = recipient.destinationUuid;
          storyMessageRecipient.distributionListIds =
            recipient.distributionListIds;
          storyMessageRecipient.isAllowedToReply = recipient.isAllowedToReply;
          return storyMessageRecipient;
        }
      );
    }

    if (isUpdate) {
      sentMessage.isRecipientUpdate = true;
    }

    // Though this field has 'unidentified' in the name, it should have entries for each
    //   number we sent to.
    if (!isEmpty(conversationIdsSentTo)) {
      sentMessage.unidentifiedStatus = [
        ...map(conversationIdsSentTo, conversationId => {
          const status =
            new Proto.SyncMessage.Sent.UnidentifiedDeliveryStatus();
          const conv = window.ConversationController.get(conversationId);
          if (conv) {
            const e164 = conv.get('e164');
            if (e164) {
              status.destination = e164;
            }
            const uuid = conv.get('uuid');
            if (uuid) {
              status.destinationUuid = uuid;
            }
          }
          status.unidentified =
            conversationIdsWithSealedSender.has(conversationId);
          return status;
        }),
      ];
    }

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid.toString(),
      proto: contentMessage,
      timestamp,
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent,
    });
  }

  static getRequestBlockSyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.BLOCKED;
    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'blockSyncRequest',
      urgent: false,
    };
  }

  static getRequestConfigurationSyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.CONFIGURATION;
    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'configurationSyncRequest',
      urgent: false,
    };
  }

  static getRequestGroupSyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.GROUPS;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'groupSyncRequest',
      urgent: false,
    };
  }

  static getRequestContactSyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.CONTACTS;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'contactSyncRequest',
      urgent: true,
    };
  }

  static getRequestPniIdentitySyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.PNI_IDENTITY;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'pniIdentitySyncRequest',
      urgent: true,
    };
  }

  static getFetchManifestSyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const fetchLatest = new Proto.SyncMessage.FetchLatest();
    fetchLatest.type = Proto.SyncMessage.FetchLatest.Type.STORAGE_MANIFEST;

    const syncMessage = this.createSyncMessage();
    syncMessage.fetchLatest = fetchLatest;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'fetchLatestManifestSync',
      urgent: false,
    };
  }

  static getFetchLocalProfileSyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const fetchLatest = new Proto.SyncMessage.FetchLatest();
    fetchLatest.type = Proto.SyncMessage.FetchLatest.Type.LOCAL_PROFILE;

    const syncMessage = this.createSyncMessage();
    syncMessage.fetchLatest = fetchLatest;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'fetchLocalProfileSync',
      urgent: false,
    };
  }

  static getRequestKeySyncMessage(): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.KEYS;

    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier: myUuid.toString(),
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'keySyncRequest',
      urgent: true,
    };
  }

  async syncReadMessages(
    reads: ReadonlyArray<{
      senderUuid?: string;
      senderE164?: string;
      timestamp: number;
    }>,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

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
      identifier: myUuid.toString(),
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent: true,
    });
  }

  async syncView(
    views: ReadonlyArray<{
      senderUuid?: string;
      senderE164?: string;
      timestamp: number;
    }>,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

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
      identifier: myUuid.toString(),
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent: false,
    });
  }

  async syncViewOnceOpen(
    viewOnceOpens: ReadonlyArray<{
      senderUuid?: string;
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
    const { senderE164, senderUuid, timestamp } = viewOnceOpens[0];

    if (!senderUuid) {
      throw new Error('syncViewOnceOpen: Missing senderUuid');
    }

    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const syncMessage = MessageSender.createSyncMessage();

    const viewOnceOpen = new Proto.SyncMessage.ViewOnceOpen();
    if (senderE164 !== undefined) {
      viewOnceOpen.sender = senderE164;
    }
    viewOnceOpen.senderUuid = senderUuid;
    viewOnceOpen.timestamp = Long.fromNumber(timestamp);
    syncMessage.viewOnceOpen = viewOnceOpen;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid.toString(),
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent: false,
    });
  }

  static getMessageRequestResponseSync(
    options: Readonly<{
      threadE164?: string;
      threadUuid?: string;
      groupId?: Uint8Array;
      type: number;
    }>
  ): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    const syncMessage = MessageSender.createSyncMessage();

    const response = new Proto.SyncMessage.MessageRequestResponse();
    if (options.threadE164 !== undefined) {
      response.threadE164 = options.threadE164;
    }
    if (options.threadUuid !== undefined) {
      response.threadUuid = options.threadUuid;
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
      identifier: myUuid.toString(),
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
    const myUuid = window.textsecure.storage.user.getCheckedUuid();
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
      identifier: myUuid.toString(),
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
    destinationUuid: string | undefined,
    state: number,
    identityKey: Readonly<Uint8Array>
  ): SingleProtoJobData {
    const myUuid = window.textsecure.storage.user.getCheckedUuid();

    if (!destinationE164 && !destinationUuid) {
      throw new Error('syncVerification: Neither e164 nor UUID were provided');
    }

    const padding = MessageSender.getRandomPadding();

    const verified = new Proto.Verified();
    verified.state = state;
    if (destinationE164) {
      verified.destination = destinationE164;
    }
    if (destinationUuid) {
      verified.destinationUuid = destinationUuid;
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
      identifier: myUuid.toString(),
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
    recipientId: string,
    callingMessage: Readonly<Proto.ICallingMessage>,
    options?: Readonly<SendOptionsType>
  ): Promise<CallbackResultType> {
    const recipients = [recipientId];
    const finalTimestamp = Date.now();

    const contentMessage = new Proto.Content();
    contentMessage.callingMessage = callingMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendMessageProtoAndWait({
      timestamp: finalTimestamp,
      recipients,
      proto: contentMessage,
      contentHint: ContentHint.DEFAULT,
      groupId: undefined,
      options,
      urgent: true,
    });
  }

  async sendDeliveryReceipt(
    options: Readonly<{
      senderE164?: string;
      senderUuid?: string;
      timestamps: Array<number>;
      options?: Readonly<SendOptionsType>;
    }>
  ): Promise<CallbackResultType> {
    return this.sendReceiptMessage({
      ...options,
      type: Proto.ReceiptMessage.Type.DELIVERY,
    });
  }

  async sendReadReceipt(
    options: Readonly<{
      senderE164?: string;
      senderUuid?: string;
      timestamps: Array<number>;
      options?: Readonly<SendOptionsType>;
    }>
  ): Promise<CallbackResultType> {
    return this.sendReceiptMessage({
      ...options,
      type: Proto.ReceiptMessage.Type.READ,
    });
  }

  async sendViewedReceipt(
    options: Readonly<{
      senderE164?: string;
      senderUuid?: string;
      timestamps: Array<number>;
      options?: Readonly<SendOptionsType>;
    }>
  ): Promise<CallbackResultType> {
    return this.sendReceiptMessage({
      ...options,
      type: Proto.ReceiptMessage.Type.VIEWED,
    });
  }

  private async sendReceiptMessage({
    senderE164,
    senderUuid,
    timestamps,
    type,
    options,
  }: Readonly<{
    senderE164?: string;
    senderUuid?: string;
    timestamps: Array<number>;
    type: Proto.ReceiptMessage.Type;
    options?: Readonly<SendOptionsType>;
  }>): Promise<CallbackResultType> {
    if (!senderUuid && !senderE164) {
      throw new Error(
        'sendReceiptMessage: Neither uuid nor e164 was provided!'
      );
    }

    const receiptMessage = new Proto.ReceiptMessage();
    receiptMessage.type = type;
    receiptMessage.timestamp = timestamps.map(timestamp =>
      Long.fromNumber(timestamp)
    );

    const contentMessage = new Proto.Content();
    contentMessage.receiptMessage = receiptMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: senderUuid || senderE164,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
      urgent: false,
    });
  }

  static getNullMessage({
    uuid,
    e164,
    padding,
  }: Readonly<{
    uuid?: string;
    e164?: string;
    padding?: Uint8Array;
  }>): SingleProtoJobData {
    const nullMessage = new Proto.NullMessage();

    const identifier = uuid || e164;
    if (!identifier) {
      throw new Error('sendNullMessage: Got neither uuid nor e164!');
    }

    nullMessage.padding = padding || MessageSender.getRandomPadding();

    const contentMessage = new Proto.Content();
    contentMessage.nullMessage = nullMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return {
      contentHint: ContentHint.RESENDABLE,
      identifier,
      isSyncMessage: false,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'nullMessage',
      urgent: false,
    };
  }

  async sendRetryRequest({
    groupId,
    options,
    plaintext,
    uuid,
  }: Readonly<{
    groupId?: string;
    options?: SendOptionsType;
    plaintext: PlaintextContent;
    uuid: string;
  }>): Promise<CallbackResultType> {
    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendMessageProtoAndWait({
      timestamp: Date.now(),
      recipients: [uuid],
      proto: plaintext,
      contentHint: ContentHint.DEFAULT,
      groupId,
      options,
      urgent: false,
    });
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
  }: Readonly<{
    contentHint: number;
    messageId?: string;
    proto: Buffer;
    sendType: SendTypesType;
    timestamp: number;
    urgent: boolean;
  }>): SendLogCallbackType {
    let initialSavePromise: Promise<number>;

    return async ({
      identifier,
      deviceIds,
    }: {
      identifier: string;
      deviceIds: Array<number>;
    }) => {
      if (!shouldSaveProto(sendType)) {
        return;
      }

      const conversation = window.ConversationController.get(identifier);
      if (!conversation) {
        log.warn(
          `makeSendLogCallback: Unable to find conversation for identifier ${identifier}`
        );
        return;
      }
      const recipientUuid = conversation.get('uuid');
      if (!recipientUuid) {
        log.warn(
          `makeSendLogCallback: Conversation ${conversation.idForLogging()} had no UUID`
        );
        return;
      }

      if (!initialSavePromise) {
        initialSavePromise = window.Signal.Data.insertSentProto(
          {
            contentHint,
            proto,
            timestamp,
            urgent,
          },
          {
            recipients: { [recipientUuid]: deviceIds },
            messageIds: messageId ? [messageId] : [],
          }
        );
        await initialSavePromise;
      } else {
        const id = await initialSavePromise;
        await window.Signal.Data.insertProtoRecipients({
          id,
          recipientUuid,
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
    timestamp = Date.now(),
    urgent,
  }: Readonly<{
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    proto: Proto.Content;
    recipients: ReadonlyArray<string>;
    sendLogCallback?: SendLogCallbackType;
    timestamp: number;
    urgent: boolean;
  }>): Promise<CallbackResultType> {
    const myE164 = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid()?.toString();
    const identifiers = recipients.filter(id => id !== myE164 && id !== myUuid);

    if (identifiers.length === 0) {
      const dataMessage = proto.dataMessage
        ? Proto.DataMessage.encode(proto.dataMessage).finish()
        : undefined;

      return Promise.resolve({
        dataMessage,
        errors: [],
        failoverIdentifiers: [],
        successfulIdentifiers: [],
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

      this.sendMessageProto({
        callback,
        contentHint,
        groupId,
        options,
        proto,
        recipients: identifiers,
        sendLogCallback,
        timestamp,
        urgent,
      });
    });
  }

  async getSenderKeyDistributionMessage(
    distributionId: string,
    {
      throwIfNotInDatabase,
      timestamp,
    }: { throwIfNotInDatabase?: boolean; timestamp: number }
  ): Promise<Proto.Content> {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid();
    const ourDeviceId = parseIntOrThrow(
      window.textsecure.storage.user.getDeviceId(),
      'getSenderKeyDistributionMessage'
    );

    const protocolAddress = ProtocolAddress.new(
      ourUuid.toString(),
      ourDeviceId
    );
    const address = new QualifiedAddress(
      ourUuid,
      new Address(ourUuid, ourDeviceId)
    );

    const senderKeyDistributionMessage =
      await window.textsecure.storage.protocol.enqueueSenderKeyJob(
        address,
        async () => {
          const senderKeyStore = new SenderKeys({ ourUuid, zone: GLOBAL_ZONE });

          if (throwIfNotInDatabase) {
            const key = await senderKeyStore.getSenderKey(
              protocolAddress,
              distributionId
            );
            if (!key) {
              throw new Error(
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
      identifiers,
      throwIfNotInDatabase,
      urgent,
    }: Readonly<{
      contentHint: number;
      distributionId: string;
      groupId: string | undefined;
      identifiers: ReadonlyArray<string>;
      throwIfNotInDatabase?: boolean;
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
      identifiers.length > 1
        ? this.makeSendLogCallback({
            contentHint,
            proto: Buffer.from(Proto.Content.encode(contentMessage).finish()),
            sendType: 'senderKeyDistributionMessage',
            timestamp,
            urgent,
          })
        : undefined;

    return this.sendGroupProto({
      contentHint,
      groupId,
      options,
      proto: contentMessage,
      recipients: identifiers,
      sendLogCallback,
      timestamp,
      urgent,
    });
  }

  // GroupV1-only functions; not to be used in the future

  async leaveGroup(
    groupId: string,
    groupIdentifiers: Array<string>,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const timestamp = Date.now();
    const proto = new Proto.Content({
      dataMessage: {
        group: {
          id: Bytes.fromString(groupId),
          type: Proto.GroupContext.Type.QUIT,
        },
      },
    });

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    const contentHint = ContentHint.RESENDABLE;
    const sendLogCallback =
      groupIdentifiers.length > 1
        ? this.makeSendLogCallback({
            contentHint,
            proto: Buffer.from(Proto.Content.encode(proto).finish()),
            sendType: 'legacyGroupChange',
            timestamp,
            urgent: false,
          })
        : undefined;

    return this.sendGroupProto({
      contentHint,
      groupId: undefined, // only for GV2 ids
      options,
      proto,
      recipients: groupIdentifiers,
      sendLogCallback,
      timestamp,
      urgent: false,
    });
  }

  // Simple pass-throughs

  // Note: instead of updating these functions, or adding new ones, remove these and go
  //   directly to window.textsecure.messaging.server.<function>

  async getProfile(
    uuid: UUID,
    options: GetProfileOptionsType | GetProfileUnauthOptionsType
  ): ReturnType<WebAPIType['getProfile']> {
    if (options.accessKey !== undefined) {
      return this.server.getProfileUnauth(uuid.toString(), options);
    }

    return this.server.getProfile(uuid.toString(), options);
  }

  async checkAccountExistence(uuid: UUID): Promise<boolean> {
    return this.server.checkAccountExistence(uuid);
  }

  async getProfileForUsername(
    username: string
  ): ReturnType<WebAPIType['getProfileForUsername']> {
    return this.server.getProfileForUsername(username);
  }

  async getUuidsForE164s(
    numbers: ReadonlyArray<string>
  ): Promise<Dictionary<UUIDStringType | null>> {
    return this.server.getUuidsForE164s(numbers);
  }

  async getUuidsForE164sV2(
    e164s: ReadonlyArray<string>,
    acis: ReadonlyArray<UUIDStringType>,
    accessKeys: ReadonlyArray<string>
  ): Promise<CDSResponseType> {
    return this.server.getUuidsForE164sV2({
      e164s,
      acis,
      accessKeys,
    });
  }

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
  ): Promise<void> {
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
  ): Promise<Proto.Group> {
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
  ): Promise<Proto.IGroupChange> {
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

  async makeProxiedRequest(
    url: string,
    options?: Readonly<ProxiedRequestOptionsType>
  ): Promise<ReturnType<WebAPIType['makeProxiedRequest']>> {
    return this.server.makeProxiedRequest(url, options);
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
  ): Promise<Proto.GroupExternalCredential> {
    return this.server.getGroupExternalCredential(options);
  }

  public async sendChallengeResponse(
    challengeResponse: Readonly<ChallengeType>
  ): Promise<void> {
    return this.server.sendChallengeResponse(challengeResponse);
  }

  async putProfile(
    jsonData: Readonly<ProfileRequestDataType>
  ): Promise<UploadAvatarHeadersType | undefined> {
    return this.server.putProfile(jsonData);
  }

  async uploadAvatar(
    requestHeaders: Readonly<UploadAvatarHeadersType>,
    avatarData: Readonly<Uint8Array>
  ): Promise<string> {
    return this.server.uploadAvatar(requestHeaders, avatarData);
  }

  async putUsername(
    username: string
  ): Promise<ReturnType<WebAPIType['putUsername']>> {
    return this.server.putUsername(username);
  }
  async deleteUsername(): Promise<ReturnType<WebAPIType['deleteUsername']>> {
    return this.server.deleteUsername();
  }
}
