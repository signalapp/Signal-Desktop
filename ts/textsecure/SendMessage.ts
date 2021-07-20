// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-nested-ternary */
/* eslint-disable class-methods-use-this */
/* eslint-disable more/no-then */
/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */

import { Dictionary } from 'lodash';
import PQueue from 'p-queue';
import {
  PlaintextContent,
  ProtocolAddress,
  SenderKeyDistributionMessage,
} from '@signalapp/signal-client';

import { assert } from '../util/assert';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import { SenderKeys } from '../LibSignalStores';
import {
  ChallengeType,
  GroupCredentialsType,
  GroupLogResponseType,
  MultiRecipient200ResponseType,
  ProfileRequestDataType,
  ProxiedRequestOptionsType,
  UploadAvatarHeadersType,
  WebAPIType,
} from './WebAPI';
import createTaskWithTimeout from './TaskWithTimeout';
import { CallbackResultType } from './Types.d';
import OutgoingMessage, {
  SerializedCertificateType,
  SendLogCallbackType,
} from './OutgoingMessage';
import Crypto from './Crypto';
import * as Bytes from '../Bytes';
import {
  concatenateBytes,
  getRandomBytes,
  getZeroes,
  typedArrayToArrayBuffer,
} from '../Crypto';
import {
  StorageServiceCallOptionsType,
  StorageServiceCredentials,
} from '../textsecure.d';
import {
  MessageError,
  SignedPreKeyRotationError,
  SendMessageProtoError,
} from './Errors';
import { BodyRangesType } from '../types/Util';
import {
  LinkPreviewImage,
  LinkPreviewMetadata,
} from '../linkPreviews/linkPreviewFetch';
import { concat, isEmpty, map } from '../util/iterables';
import {
  handleMessageSend,
  shouldSaveProto,
  SendTypesType,
} from '../util/handleMessageSend';
import { SignalService as Proto } from '../protobuf';

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

type PreviewType = {
  url: string;
  title: string;
  image?: AttachmentType;
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
type GroupV1InfoType = {
  id: string;
  members: Array<string>;
};

type GroupCallUpdateType = {
  eraId: string;
};

export type AttachmentType = {
  size: number;
  data: ArrayBuffer;
  contentType: string;

  fileName: string;
  flags: number;
  width: number;
  height: number;
  caption: string;

  attachmentPointer?: Proto.IAttachmentPointer;

  blurHash?: string;
};

export type MessageOptionsType = {
  attachments?: Array<AttachmentType> | null;
  body?: string;
  expireTimer?: number;
  flags?: number;
  group?: {
    id: string;
    type: number;
  };
  groupV2?: GroupV2InfoType;
  needsSync?: boolean;
  preview?: Array<PreviewType> | null;
  profileKey?: ArrayBuffer;
  quote?: any;
  recipients: Array<string>;
  sticker?: any;
  reaction?: any;
  deletedForEveryoneTimestamp?: number;
  timestamp: number;
  mentions?: BodyRangesType;
  groupCallUpdate?: GroupCallUpdateType;
};
export type GroupSendOptionsType = {
  attachments?: Array<AttachmentType>;
  expireTimer?: number;
  groupV2?: GroupV2InfoType;
  groupV1?: GroupV1InfoType;
  messageText?: string;
  preview?: any;
  profileKey?: ArrayBuffer;
  quote?: any;
  reaction?: any;
  sticker?: any;
  deletedForEveryoneTimestamp?: number;
  timestamp: number;
  mentions?: BodyRangesType;
  groupCallUpdate?: GroupCallUpdateType;
};

// TODO: remove once we move away from ArrayBuffers
const FIXMEU8 = Uint8Array;

class Message {
  attachments: Array<any>;

  body?: string;

  expireTimer?: number;

  flags?: number;

  group?: {
    id: string;
    type: number;
  };

  groupV2?: GroupV2InfoType;

  needsSync?: boolean;

  preview: any;

  profileKey?: ArrayBuffer;

  quote?: {
    id?: number;
    authorUuid?: string;
    text?: string;
    attachments?: Array<AttachmentType>;
    bodyRanges?: BodyRangesType;
  };

  recipients: Array<string>;

  sticker?: any;

  reaction?: {
    emoji?: string;
    remove?: boolean;
    targetAuthorUuid?: string;
    targetTimestamp?: number;
  };

  timestamp: number;

  dataMessage: any;

  attachmentPointers: Array<Proto.IAttachmentPointer> = [];

  deletedForEveryoneTimestamp?: number;

  mentions?: BodyRangesType;

  groupCallUpdate?: GroupCallUpdateType;

  constructor(options: MessageOptionsType) {
    this.attachments = options.attachments || [];
    this.body = options.body;
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
    if (this.dataMessage instanceof Proto.DataMessage) {
      return this.dataMessage;
    }
    const proto = new Proto.DataMessage();

    proto.timestamp = this.timestamp;
    proto.attachments = this.attachmentPointers;

    if (this.body) {
      proto.body = this.body;

      const mentionCount = this.mentions ? this.mentions.length : 0;
      const placeholders = this.body.match(/\uFFFC/g);
      const placeholderCount = placeholders ? placeholders.length : 0;
      window.log.info(
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

      if (this.sticker.attachmentPointer) {
        proto.sticker.data = this.sticker.attachmentPointer;
      }
    }
    if (this.reaction) {
      proto.reaction = new Proto.DataMessage.Reaction();
      proto.reaction.emoji = this.reaction.emoji || null;
      proto.reaction.remove = this.reaction.remove || false;
      proto.reaction.targetAuthorUuid = this.reaction.targetAuthorUuid || null;
      proto.reaction.targetTimestamp = this.reaction.targetTimestamp || null;
    }

    if (Array.isArray(this.preview)) {
      proto.preview = this.preview.map(preview => {
        const item = new Proto.DataMessage.Preview();
        item.title = preview.title;
        item.url = preview.url;
        item.description = preview.description || null;
        item.date = preview.date || null;
        item.image = preview.image || null;
        return item;
      });
    }
    if (this.quote) {
      const { QuotedAttachment } = Proto.DataMessage.Quote;
      const { BodyRange, Quote } = Proto.DataMessage;

      proto.quote = new Quote();
      const { quote } = proto;

      quote.id = this.quote.id || null;
      quote.authorUuid = this.quote.authorUuid || null;
      quote.text = this.quote.text || null;
      quote.attachments = (this.quote.attachments || []).map(
        (attachment: AttachmentType) => {
          const quotedAttachment = new QuotedAttachment();

          quotedAttachment.contentType = attachment.contentType;
          quotedAttachment.fileName = attachment.fileName;
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
      proto.profileKey = new FIXMEU8(this.profileKey);
    }
    if (this.deletedForEveryoneTimestamp) {
      proto.delete = {
        targetSentTimestamp: this.deletedForEveryoneTimestamp,
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

    this.dataMessage = proto;
    return proto;
  }

  toArrayBuffer() {
    return typedArrayToArrayBuffer(
      Proto.DataMessage.encode(this.toProto()).finish()
    );
  }
}

export default class MessageSender {
  server: WebAPIType;

  pendingMessages: {
    [id: string]: PQueue;
  };

  constructor(username: string, password: string) {
    this.server = window.WebAPI.connect({ username, password });
    this.pendingMessages = {};
  }

  async queueJobForIdentifier(
    identifier: string,
    runJob: () => Promise<any>
  ): Promise<void> {
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

  getRandomPadding(): Uint8Array {
    // Generate a random int from 1 and 512
    const buffer = getRandomBytes(2);
    const paddingLength = (new Uint16Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    return new FIXMEU8(getRandomBytes(paddingLength));
  }

  getPaddedAttachment(data: ArrayBuffer): ArrayBuffer {
    const size = data.byteLength;
    const paddedSize = this._getAttachmentSizeBucket(size);
    const padding = getZeroes(paddedSize - size);

    return concatenateBytes(data, padding);
  }

  async makeAttachmentPointer(
    attachment: AttachmentType
  ): Promise<Proto.IAttachmentPointer> {
    assert(
      typeof attachment === 'object' && attachment !== null,
      'Got null attachment in `makeAttachmentPointer`'
    );

    const { data, size } = attachment;
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      throw new Error(
        `makeAttachmentPointer: data was a '${typeof data}' instead of ArrayBuffer/ArrayBufferView`
      );
    }
    if (data.byteLength !== size) {
      throw new Error(
        `makeAttachmentPointer: Size ${size} did not match data.byteLength ${data.byteLength}`
      );
    }

    const padded = this.getPaddedAttachment(data);
    const key = getRandomBytes(64);
    const iv = getRandomBytes(16);

    const result = await Crypto.encryptAttachment(padded, key, iv);
    const id = await this.server.putAttachment(result.ciphertext);

    const proto = new Proto.AttachmentPointer();
    proto.cdnId = id;
    proto.contentType = attachment.contentType;
    proto.key = new FIXMEU8(key);
    proto.size = attachment.size;
    proto.digest = new FIXMEU8(result.digest);

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
    return Promise.all(
      message.attachments.map(this.makeAttachmentPointer.bind(this))
    )
      .then(attachmentPointers => {
        // eslint-disable-next-line no-param-reassign
        message.attachmentPointers = attachmentPointers;
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'HTTPError') {
          throw new MessageError(message, error);
        } else {
          throw error;
        }
      });
  }

  async uploadLinkPreviews(message: Message): Promise<void> {
    try {
      const preview = await Promise.all(
        (message.preview || []).map(async (item: PreviewType) => ({
          ...item,
          image: item.image
            ? await this.makeAttachmentPointer(item.image)
            : undefined,
        }))
      );
      // eslint-disable-next-line no-param-reassign
      message.preview = preview;
    } catch (error) {
      if (error instanceof Error && error.name === 'HTTPError') {
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
      if (error instanceof Error && error.name === 'HTTPError') {
        throw new MessageError(message, error);
      } else {
        throw error;
      }
    }
  }

  async uploadThumbnails(message: Message): Promise<void> {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { quote } = message;

    if (!quote || !quote.attachments || quote.attachments.length === 0) {
      return;
    }

    await Promise.all(
      quote.attachments.map((attachment: QuoteAttachmentType) => {
        if (!attachment.thumbnail) {
          return null;
        }

        return makePointer(attachment.thumbnail).then(pointer => {
          // eslint-disable-next-line no-param-reassign
          attachment.attachmentPointer = pointer;
        });
      })
    ).catch(error => {
      if (error instanceof Error && error.name === 'HTTPError') {
        throw new MessageError(message, error);
      } else {
        throw error;
      }
    });
  }

  // Proto assembly

  async getDataMessage(options: MessageOptionsType): Promise<ArrayBuffer> {
    const message = await this.getHydratedMessage(options);
    return message.toArrayBuffer();
  }

  async getContentMessage(options: MessageOptionsType): Promise<Proto.Content> {
    const message = await this.getHydratedMessage(options);
    const dataMessage = message.toProto();

    const contentMessage = new Proto.Content();
    contentMessage.dataMessage = dataMessage;

    return contentMessage;
  }

  async getHydratedMessage(attributes: MessageOptionsType): Promise<Message> {
    const message = new Message(attributes);
    await Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message),
      this.uploadLinkPreviews(message),
      this.uploadSticker(message),
    ]);

    return message;
  }

  getTypingContentMessage(options: {
    recipientId?: string;
    groupId?: ArrayBuffer;
    groupMembers: Array<string>;
    isTyping: boolean;
    timestamp?: number;
  }): Proto.Content {
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
      typingMessage.groupId = new FIXMEU8(groupId);
    }
    typingMessage.action = action;
    typingMessage.timestamp = finalTimestamp;

    const contentMessage = new Proto.Content();
    contentMessage.typingMessage = typingMessage;

    return contentMessage;
  }

  getAttrsFromGroupOptions(options: GroupSendOptionsType): MessageOptionsType {
    const {
      messageText,
      timestamp,
      attachments,
      quote,
      preview,
      sticker,
      reaction,
      expireTimer,
      profileKey,
      deletedForEveryoneTimestamp,
      groupV2,
      groupV1,
      mentions,
      groupCallUpdate,
    } = options;

    if (!groupV1 && !groupV2) {
      throw new Error(
        'getAttrsFromGroupOptions: Neither group1 nor groupv2 information provided!'
      );
    }

    const myE164 = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const groupMembers = groupV2?.members || groupV1?.members || [];

    // We should always have a UUID but have this check just in case we don't.
    let isNotMe: (recipient: string) => boolean;
    if (myUuid) {
      isNotMe = r => r !== myE164 && r !== myUuid;
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
      deletedForEveryoneTimestamp,
      expireTimer,
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
      timestamp,
    };
  }

  createSyncMessage(): Proto.SyncMessage {
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
  }: {
    messageOptions: MessageOptionsType;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
  }): Promise<CallbackResultType> {
    const message = new Message(messageOptions);

    return Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message),
      this.uploadLinkPreviews(message),
      this.uploadSticker(message),
    ]).then(
      async (): Promise<CallbackResultType> =>
        new Promise((resolve, reject) => {
          this.sendMessageProto({
            callback: (res: CallbackResultType) => {
              res.dataMessage = message.toArrayBuffer();
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
          });
        })
    );
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
  }: {
    callback: (result: CallbackResultType) => void;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    proto: Proto.Content | Proto.DataMessage | PlaintextContent;
    recipients: Array<string>;
    sendLogCallback?: SendLogCallbackType;
    timestamp: number;
  }): void {
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
  }: {
    timestamp: number;
    recipients: Array<string>;
    proto: Proto.Content | Proto.DataMessage | PlaintextContent;
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
  }): Promise<CallbackResultType> {
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
      });
    });
  }

  async sendIndividualProto({
    identifier,
    proto,
    timestamp,
    contentHint,
    options,
  }: {
    identifier: string | undefined;
    proto: Proto.DataMessage | Proto.Content | PlaintextContent;
    timestamp: number;
    contentHint: number;
    options?: SendOptionsType;
  }): Promise<CallbackResultType> {
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
        groupId: undefined,
        options,
        proto,
        recipients: [identifier],
        timestamp,
      });
    });
  }

  // You might wonder why this takes a groupId. models/messages.resend() can send a group
  //   message to just one person.
  async sendMessageToIdentifier({
    identifier,
    messageText,
    attachments,
    quote,
    preview,
    sticker,
    reaction,
    deletedForEveryoneTimestamp,
    timestamp,
    expireTimer,
    contentHint,
    groupId,
    profileKey,
    options,
  }: {
    identifier: string;
    messageText: string | undefined;
    attachments: Array<AttachmentType> | undefined;
    quote: unknown;
    preview: Array<PreviewType> | undefined;
    sticker: unknown;
    reaction: unknown;
    deletedForEveryoneTimestamp: number | undefined;
    timestamp: number;
    expireTimer: number | undefined;
    contentHint: number;
    groupId: string | undefined;
    profileKey?: ArrayBuffer;
    options?: SendOptionsType;
  }): Promise<CallbackResultType> {
    return this.sendMessage({
      messageOptions: {
        recipients: [identifier],
        body: messageText,
        timestamp,
        attachments,
        quote,
        preview,
        sticker,
        reaction,
        deletedForEveryoneTimestamp,
        expireTimer,
        profileKey,
      },
      contentHint,
      groupId,
      options,
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
    options,
  }: {
    encodedDataMessage: ArrayBuffer;
    timestamp: number;
    destination: string | undefined;
    destinationUuid: string | null | undefined;
    expirationStartTimestamp: number | null;
    conversationIdsSentTo?: Iterable<string>;
    conversationIdsWithSealedSender?: Set<string>;
    isUpdate?: boolean;
    options?: SendOptionsType;
  }): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const dataMessage = Proto.DataMessage.decode(
      new FIXMEU8(encodedDataMessage)
    );
    const sentMessage = new Proto.SyncMessage.Sent();
    sentMessage.timestamp = timestamp;
    sentMessage.message = dataMessage;
    if (destination) {
      sentMessage.destination = destination;
    }
    if (destinationUuid) {
      sentMessage.destinationUuid = destinationUuid;
    }
    if (expirationStartTimestamp) {
      sentMessage.expirationStartTimestamp = expirationStartTimestamp;
    }

    if (isUpdate) {
      sentMessage.isRecipientUpdate = true;
    }

    // Though this field has 'unidenified' in the name, it should have entries for each
    //   number we sent to.
    if (!isEmpty(conversationIdsSentTo)) {
      sentMessage.unidentifiedStatus = [
        ...map(conversationIdsSentTo, conversationId => {
          const status = new Proto.SyncMessage.Sent.UnidentifiedDeliveryStatus();
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
          status.unidentified = conversationIdsWithSealedSender.has(
            conversationId
          );
          return status;
        }),
      ];
    }

    const syncMessage = this.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp,
      contentHint: ContentHint.RESENDABLE,
      options,
    });
  }

  async sendRequestBlockSyncMessage(
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.BLOCKED;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async sendRequestConfigurationSyncMessage(
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.CONFIGURATION;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async sendRequestGroupSyncMessage(
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.GROUPS;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async sendRequestContactSyncMessage(
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.CONTACTS;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async sendFetchManifestSyncMessage(
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myUuid = window.textsecure.storage.user.getUuid();
    const myNumber = window.textsecure.storage.user.getNumber();

    const fetchLatest = new Proto.SyncMessage.FetchLatest();
    fetchLatest.type = Proto.SyncMessage.FetchLatest.Type.STORAGE_MANIFEST;

    const syncMessage = this.createSyncMessage();
    syncMessage.fetchLatest = fetchLatest;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async sendRequestKeySyncMessage(
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myUuid = window.textsecure.storage.user.getUuid();
    const myNumber = window.textsecure.storage.user.getNumber();

    const request = new Proto.SyncMessage.Request();
    request.type = Proto.SyncMessage.Request.Type.KEYS;

    const syncMessage = this.createSyncMessage();
    syncMessage.request = request;
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async syncReadMessages(
    reads: Array<{
      senderUuid?: string;
      senderE164?: string;
      timestamp: number;
    }>,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const syncMessage = this.createSyncMessage();
    syncMessage.read = [];
    for (let i = 0; i < reads.length; i += 1) {
      const proto = new Proto.SyncMessage.Read(reads[i]);

      syncMessage.read.push(proto);
    }
    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
    });
  }

  async syncViewOnceOpen(
    sender: string | undefined,
    senderUuid: string,
    timestamp: number,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const syncMessage = this.createSyncMessage();

    const viewOnceOpen = new Proto.SyncMessage.ViewOnceOpen();
    if (sender !== undefined) {
      viewOnceOpen.sender = sender;
    }
    viewOnceOpen.senderUuid = senderUuid;
    viewOnceOpen.timestamp = timestamp;
    syncMessage.viewOnceOpen = viewOnceOpen;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
    });
  }

  async syncMessageRequestResponse(
    responseArgs: {
      threadE164?: string;
      threadUuid?: string;
      groupId?: ArrayBuffer;
      type: number;
    },
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();

    const syncMessage = this.createSyncMessage();

    const response = new Proto.SyncMessage.MessageRequestResponse();
    if (responseArgs.threadE164 !== undefined) {
      response.threadE164 = responseArgs.threadE164;
    }
    if (responseArgs.threadUuid !== undefined) {
      response.threadUuid = responseArgs.threadUuid;
    }
    if (responseArgs.groupId) {
      response.groupId = new FIXMEU8(responseArgs.groupId);
    }
    response.type = responseArgs.type;
    syncMessage.messageRequestResponse = response;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
    });
  }

  async sendStickerPackSync(
    operations: Array<{
      packId: string;
      packKey: string;
      installed: boolean;
    }>,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();
    const ENUM = Proto.SyncMessage.StickerPackOperation.Type;

    const packOperations = operations.map(item => {
      const { packId, packKey, installed } = item;

      const operation = new Proto.SyncMessage.StickerPackOperation();
      operation.packId = Bytes.fromHex(packId);
      operation.packKey = Bytes.fromBase64(packKey);
      operation.type = installed ? ENUM.INSTALL : ENUM.REMOVE;

      return operation;
    });

    const syncMessage = this.createSyncMessage();
    syncMessage.stickerPackOperation = packOperations;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async syncVerification(
    destinationE164: string | undefined,
    destinationUuid: string | undefined,
    state: number,
    identityKey: ArrayBuffer,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();
    const now = Date.now();

    if (!destinationE164 && !destinationUuid) {
      throw new Error('syncVerification: Neither e164 nor UUID were provided');
    }

    // Get padding which we can share between null message and verified sync
    const padding = this.getRandomPadding();

    // First send a null message to mask the sync message.
    await handleMessageSend(
      this.sendNullMessage(
        { uuid: destinationUuid, e164: destinationE164, padding },
        options
      ),
      {
        messageIds: [],
        sendType: 'nullMessage',
      }
    );

    const verified = new Proto.Verified();
    verified.state = state;
    if (destinationE164) {
      verified.destination = destinationE164;
    }
    if (destinationUuid) {
      verified.destinationUuid = destinationUuid;
    }
    verified.identityKey = new FIXMEU8(identityKey);
    verified.nullMessage = padding;

    const syncMessage = this.createSyncMessage();
    syncMessage.verified = verified;

    const secondMessage = new Proto.Content();
    secondMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: myUuid || myNumber,
      proto: secondMessage,
      timestamp: now,
      contentHint: ContentHint.RESENDABLE,
      options,
    });
  }

  // Sending messages to contacts

  async sendProfileKeyUpdate(
    profileKey: ArrayBuffer,
    recipients: Array<string>,
    options: SendOptionsType,
    groupId?: string
  ): Promise<CallbackResultType> {
    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendMessage({
      messageOptions: {
        recipients,
        timestamp: Date.now(),
        profileKey,
        flags: Proto.DataMessage.Flags.PROFILE_KEY_UPDATE,
        ...(groupId
          ? {
              group: {
                id: groupId,
                type: Proto.GroupContext.Type.DELIVER,
              },
            }
          : {}),
      },
      contentHint: ContentHint.IMPLICIT,
      groupId: undefined,
      options,
    });
  }

  async sendCallingMessage(
    recipientId: string,
    callingMessage: Proto.ICallingMessage,
    options?: SendOptionsType
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
    });
  }

  async sendDeliveryReceipt({
    e164,
    uuid,
    timestamps,
    options,
  }: {
    e164?: string;
    uuid?: string;
    timestamps: Array<number>;
    options?: SendOptionsType;
  }): Promise<CallbackResultType> {
    if (!uuid && !e164) {
      throw new Error(
        'sendDeliveryReceipt: Neither uuid nor e164 was provided!'
      );
    }

    const receiptMessage = new Proto.ReceiptMessage();
    receiptMessage.type = Proto.ReceiptMessage.Type.DELIVERY;
    receiptMessage.timestamp = timestamps;

    const contentMessage = new Proto.Content();
    contentMessage.receiptMessage = receiptMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: uuid || e164,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
    });
  }

  async sendReadReceipts({
    senderE164,
    senderUuid,
    timestamps,
    options,
  }: {
    senderE164: string;
    senderUuid: string;
    timestamps: Array<number>;
    options?: SendOptionsType;
  }): Promise<CallbackResultType> {
    const receiptMessage = new Proto.ReceiptMessage();
    receiptMessage.type = Proto.ReceiptMessage.Type.READ;
    receiptMessage.timestamp = timestamps;

    const contentMessage = new Proto.Content();
    contentMessage.receiptMessage = receiptMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendIndividualProto({
      identifier: senderUuid || senderE164,
      proto: contentMessage,
      timestamp: Date.now(),
      contentHint: ContentHint.RESENDABLE,
      options,
    });
  }

  async sendNullMessage(
    {
      uuid,
      e164,
      padding,
    }: { uuid?: string; e164?: string; padding?: Uint8Array },
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const nullMessage = new Proto.NullMessage();

    const identifier = uuid || e164;
    if (!identifier) {
      throw new Error('sendNullMessage: Got neither uuid nor e164!');
    }

    nullMessage.padding = padding || this.getRandomPadding();

    const contentMessage = new Proto.Content();
    contentMessage.nullMessage = nullMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    // We want the NullMessage to look like a normal outgoing message
    const timestamp = Date.now();
    return this.sendIndividualProto({
      identifier,
      proto: contentMessage,
      timestamp,
      contentHint: ContentHint.IMPLICIT,
      options,
    });
  }

  async resetSession(
    uuid: string,
    e164: string,
    timestamp: number,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    window.log.info('resetSession: start');
    const proto = new Proto.DataMessage();
    proto.body = 'TERMINATE';
    proto.flags = Proto.DataMessage.Flags.END_SESSION;
    proto.timestamp = timestamp;

    const identifier = uuid || e164;

    const logError = (prefix: string) => (error: Error) => {
      window.log.error(prefix, error && error.stack ? error.stack : error);
      throw error;
    };

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    const sendToContactPromise = window.textsecure.storage.protocol
      .archiveAllSessions(identifier)
      .catch(logError('resetSession/archiveAllSessions1 error:'))
      .then(async () => {
        window.log.info(
          'resetSession: finished closing local sessions, now sending to contact'
        );
        return handleMessageSend(
          this.sendIndividualProto({
            identifier,
            proto,
            timestamp,
            contentHint: ContentHint.RESENDABLE,
            options,
          }),
          {
            messageIds: [],
            sendType: 'resetSession',
          }
        ).catch(logError('resetSession/sendToContact error:'));
      })
      .then(async result => {
        await window.textsecure.storage.protocol
          .archiveAllSessions(identifier)
          .catch(logError('resetSession/archiveAllSessions2 error:'));

        return result;
      });

    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();
    // We already sent the reset session to our other devices in the code above!
    if ((e164 && e164 === myNumber) || (uuid && uuid === myUuid)) {
      return sendToContactPromise;
    }

    const buffer = typedArrayToArrayBuffer(
      Proto.DataMessage.encode(proto).finish()
    );
    const sendSyncPromise = this.sendSyncMessage({
      encodedDataMessage: buffer,
      timestamp,
      destination: e164,
      destinationUuid: uuid,
      expirationStartTimestamp: null,
      conversationIdsSentTo: [],
      conversationIdsWithSealedSender: new Set(),
      options,
    }).catch(logError('resetSession/sendSync error:'));

    const responses = await Promise.all([
      sendToContactPromise,
      sendSyncPromise,
    ]);

    return responses[0];
  }

  async sendExpirationTimerUpdateToIdentifier(
    identifier: string,
    expireTimer: number | undefined,
    timestamp: number,
    profileKey?: ArrayBuffer,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendMessage({
      messageOptions: {
        recipients: [identifier],
        timestamp,
        expireTimer,
        profileKey,
        flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      },
      contentHint: ContentHint.RESENDABLE,
      groupId: undefined,
      options,
    });
  }

  async sendRetryRequest({
    groupId,
    options,
    plaintext,
    uuid,
  }: {
    groupId?: string;
    options?: SendOptionsType;
    plaintext: PlaintextContent;
    uuid: string;
  }): Promise<CallbackResultType> {
    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    return this.sendMessageProtoAndWait({
      timestamp: Date.now(),
      recipients: [uuid],
      proto: plaintext,
      contentHint: ContentHint.DEFAULT,
      groupId,
      options,
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
  }: {
    contentHint: number;
    messageId?: string;
    proto: Buffer;
    sendType: SendTypesType;
    timestamp: number;
  }): SendLogCallbackType {
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
        window.log.warn(
          `makeSendLogCallback: Unable to find conversation for identifier ${identifier}`
        );
        return;
      }
      const recipientUuid = conversation.get('uuid');
      if (!recipientUuid) {
        window.log.warn(
          `makeSendLogCallback: Conversation ${conversation.idForLogging()} had no UUID`
        );
        return;
      }

      if (!initialSavePromise) {
        initialSavePromise = window.Signal.Data.insertSentProto(
          {
            timestamp,
            proto,
            contentHint,
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
  }: {
    contentHint: number;
    groupId: string | undefined;
    options?: SendOptionsType;
    proto: Proto.Content;
    recipients: Array<string>;
    sendLogCallback?: SendLogCallbackType;
    timestamp: number;
  }): Promise<CallbackResultType> {
    const dataMessage = proto.dataMessage
      ? typedArrayToArrayBuffer(
          Proto.DataMessage.encode(proto.dataMessage).finish()
        )
      : undefined;

    const myE164 = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();
    const identifiers = recipients.filter(id => id !== myE164 && id !== myUuid);

    if (identifiers.length === 0) {
      return Promise.resolve({
        dataMessage,
        errors: [],
        failoverIdentifiers: [],
        successfulIdentifiers: [],
        unidentifiedDeliveries: [],
      });
    }

    return new Promise((resolve, reject) => {
      const callback = (res: CallbackResultType) => {
        res.dataMessage = dataMessage;
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
      });
    });
  }

  async getSenderKeyDistributionMessage(
    distributionId: string
  ): Promise<SenderKeyDistributionMessage> {
    const ourUuid = window.textsecure.storage.user.getUuid();
    if (!ourUuid) {
      throw new Error(
        'sendSenderKeyDistributionMessage: Failed to fetch our UUID!'
      );
    }
    const ourDeviceId = parseIntOrThrow(
      window.textsecure.storage.user.getDeviceId(),
      'sendSenderKeyDistributionMessage'
    );

    const protocolAddress = ProtocolAddress.new(ourUuid, ourDeviceId);
    const address = `${ourUuid}.${ourDeviceId}`;
    const senderKeyStore = new SenderKeys();

    return window.textsecure.storage.protocol.enqueueSenderKeyJob(
      address,
      async () =>
        SenderKeyDistributionMessage.create(
          protocolAddress,
          distributionId,
          senderKeyStore
        )
    );
  }

  // The one group send exception - a message that should never be sent via sender key
  async sendSenderKeyDistributionMessage(
    {
      contentHint,
      distributionId,
      groupId,
      identifiers,
    }: {
      contentHint: number;
      distributionId: string;
      groupId: string | undefined;
      identifiers: Array<string>;
    },
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const contentMessage = new Proto.Content();
    const timestamp = Date.now();

    const senderKeyDistributionMessage = await this.getSenderKeyDistributionMessage(
      distributionId
    );
    contentMessage.senderKeyDistributionMessage = senderKeyDistributionMessage.serialize();

    const sendLogCallback =
      identifiers.length > 1
        ? this.makeSendLogCallback({
            contentHint,
            proto: Buffer.from(Proto.Content.encode(contentMessage).finish()),
            sendType: 'senderKeyDistributionMessage',
            timestamp,
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
    });
  }

  async sendExpirationTimerUpdateToGroup(
    groupId: string,
    groupIdentifiers: Array<string>,
    expireTimer: number | undefined,
    timestamp: number,
    profileKey?: ArrayBuffer,
    options?: SendOptionsType
  ): Promise<CallbackResultType> {
    const myNumber = window.textsecure.storage.user.getNumber();
    const myUuid = window.textsecure.storage.user.getUuid();
    const recipients = groupIdentifiers.filter(
      identifier => identifier !== myNumber && identifier !== myUuid
    );
    const messageOptions = {
      recipients,
      timestamp,
      expireTimer,
      profileKey,
      flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      group: {
        id: groupId,
        type: Proto.GroupContext.Type.DELIVER,
      },
    };
    const proto = await this.getContentMessage(messageOptions);

    if (recipients.length === 0) {
      return Promise.resolve({
        successfulIdentifiers: [],
        failoverIdentifiers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: await this.getDataMessage(messageOptions),
      });
    }

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
    const contentHint = ContentHint.RESENDABLE;
    const sendLogCallback =
      groupIdentifiers.length > 1
        ? this.makeSendLogCallback({
            contentHint,
            proto: Buffer.from(Proto.Content.encode(proto).finish()),
            sendType: 'expirationTimerUpdate',
            timestamp,
          })
        : undefined;

    return this.sendGroupProto({
      contentHint,
      groupId: undefined, // only for GV2 ids
      options,
      proto,
      recipients,
      sendLogCallback,
      timestamp,
    });
  }

  // Simple pass-throughs

  async getProfile(
    number: string,
    options: {
      accessKey?: string;
      profileKeyVersion?: string;
      profileKeyCredentialRequest?: string;
    } = {}
  ): Promise<any> {
    const { accessKey } = options;

    if (accessKey) {
      const unauthOptions = {
        ...options,
        accessKey,
      };
      return this.server.getProfileUnauth(number, unauthOptions);
    }

    return this.server.getProfile(number, options);
  }

  async getUuidsForE164s(
    numbers: Array<string>
  ): Promise<Dictionary<string | null>> {
    return this.server.getUuidsForE164s(numbers);
  }

  async getAvatar(path: string): Promise<any> {
    return this.server.getAvatar(path);
  }

  async getSticker(packId: string, stickerId: number): Promise<any> {
    return this.server.getSticker(packId, stickerId);
  }

  async getStickerPackManifest(packId: string): Promise<any> {
    return this.server.getStickerPackManifest(packId);
  }

  async createGroup(
    group: Proto.IGroup,
    options: GroupCredentialsType
  ): Promise<void> {
    return this.server.createGroup(group, options);
  }

  async uploadGroupAvatar(
    avatar: Uint8Array,
    options: GroupCredentialsType
  ): Promise<string> {
    return this.server.uploadGroupAvatar(avatar, options);
  }

  async getGroup(options: GroupCredentialsType): Promise<Proto.Group> {
    return this.server.getGroup(options);
  }

  async getGroupFromLink(
    groupInviteLink: string,
    auth: GroupCredentialsType
  ): Promise<Proto.GroupJoinInfo> {
    return this.server.getGroupFromLink(groupInviteLink, auth);
  }

  async getGroupLog(
    startVersion: number,
    options: GroupCredentialsType
  ): Promise<GroupLogResponseType> {
    return this.server.getGroupLog(startVersion, options);
  }

  async getGroupAvatar(key: string): Promise<ArrayBuffer> {
    return this.server.getGroupAvatar(key);
  }

  async modifyGroup(
    changes: Proto.GroupChange.IActions,
    options: GroupCredentialsType,
    inviteLinkBase64?: string
  ): Promise<Proto.IGroupChange> {
    return this.server.modifyGroup(changes, options, inviteLinkBase64);
  }

  async sendWithSenderKey(
    data: ArrayBuffer,
    accessKeys: ArrayBuffer,
    timestamp: number,
    online?: boolean
  ): Promise<MultiRecipient200ResponseType> {
    return this.server.sendWithSenderKey(data, accessKeys, timestamp, online);
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
    options?: ProxiedRequestOptionsType
  ): Promise<any> {
    return this.server.makeProxiedRequest(url, options);
  }

  async getStorageCredentials(): Promise<StorageServiceCredentials> {
    return this.server.getStorageCredentials();
  }

  async getStorageManifest(
    options: StorageServiceCallOptionsType
  ): Promise<ArrayBuffer> {
    return this.server.getStorageManifest(options);
  }

  async getStorageRecords(
    data: ArrayBuffer,
    options: StorageServiceCallOptionsType
  ): Promise<ArrayBuffer> {
    return this.server.getStorageRecords(data, options);
  }

  async modifyStorageRecords(
    data: ArrayBuffer,
    options: StorageServiceCallOptionsType
  ): Promise<ArrayBuffer> {
    return this.server.modifyStorageRecords(data, options);
  }

  async getGroupMembershipToken(
    options: GroupCredentialsType
  ): Promise<Proto.GroupExternalCredential> {
    return this.server.getGroupExternalCredential(options);
  }

  public async sendChallengeResponse(
    challengeResponse: ChallengeType
  ): Promise<void> {
    return this.server.sendChallengeResponse(challengeResponse);
  }

  async putProfile(
    jsonData: ProfileRequestDataType
  ): Promise<UploadAvatarHeadersType | undefined> {
    return this.server.putProfile(jsonData);
  }

  async uploadAvatar(
    requestHeaders: UploadAvatarHeadersType,
    avatarData: ArrayBuffer
  ): Promise<string> {
    return this.server.uploadAvatar(requestHeaders, avatarData);
  }
}
