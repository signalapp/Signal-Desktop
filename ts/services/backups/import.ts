// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni } from '@signalapp/libsignal-client';
import { v4 as generateUuid } from 'uuid';
import pMap from 'p-map';
import { Writable } from 'stream';

import { Backups } from '../../protobuf';
import Data from '../../sql/Client';
import * as log from '../../logging/log';
import { StorySendMode } from '../../types/Stories';
import { fromAciObject, fromPniObject } from '../../types/ServiceId';
import * as Errors from '../../types/errors';
import type {
  ConversationAttributesType,
  MessageAttributesType,
} from '../../model-types.d';
import { assertDev, strictAssert } from '../../util/assert';
import { getTimestampFromLong } from '../../util/timestampLongUtils';
import { DurationInSeconds } from '../../util/durations';
import { dropNull } from '../../util/dropNull';
import {
  deriveGroupID,
  deriveGroupSecretParams,
  deriveGroupPublicParams,
} from '../../util/zkgroup';
import { incrementMessageCounter } from '../../util/incrementMessageCounter';
import { isAciString } from '../../util/isAciString';
import { createBatcher } from '../../util/batcher';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SendStatus } from '../../messages/MessageSendState';
import type { SendStateByConversationId } from '../../messages/MessageSendState';
import { SeenStatus } from '../../MessageSeenStatus';
import * as Bytes from '../../Bytes';
import { BACKUP_VERSION } from './constants';

const MAX_CONCURRENCY = 10;

type ConversationOpType = Readonly<{
  isUpdate: boolean;
  attributes: ConversationAttributesType;
}>;

async function processConversationOpBatch(
  batch: ReadonlyArray<ConversationOpType>
): Promise<void> {
  // Note that we might have duplicates since we update attributes in-place
  const saves = [
    ...new Set(batch.filter(x => x.isUpdate === false).map(x => x.attributes)),
  ];
  const updates = [
    ...new Set(batch.filter(x => x.isUpdate === true).map(x => x.attributes)),
  ];

  log.info(
    `backups: running conversation op batch, saves=${saves.length} ` +
      `updates=${updates.length}`
  );

  await Data.saveConversations(saves);
  await Data.updateConversations(updates);
}

export class BackupImportStream extends Writable {
  private parsedBackupInfo = false;
  private logId = 'BackupImportStream(unknown)';

  private readonly recipientIdToConvo = new Map<
    number,
    ConversationAttributesType
  >();
  private readonly chatIdToConvo = new Map<
    number,
    ConversationAttributesType
  >();
  private readonly conversationOpBatcher = createBatcher<{
    isUpdate: boolean;
    attributes: ConversationAttributesType;
  }>({
    name: 'BackupImport.conversationOpBatcher',
    wait: 0,
    maxSize: 1000,
    processBatch: processConversationOpBatch,
  });
  private readonly saveMessageBatcher = createBatcher<MessageAttributesType>({
    name: 'BackupImport.saveMessageBatcher',
    wait: 0,
    maxSize: 1000,
    processBatch: batch => {
      const ourAci = this.ourConversation?.serviceId;
      assertDev(isAciString(ourAci), 'Our conversation must have ACI');
      return Data.saveMessages(batch, {
        forceSave: true,
        ourAci,
      });
    },
  });
  private ourConversation?: ConversationAttributesType;

  constructor() {
    super({ objectMode: true });
  }

  override async _write(
    data: Buffer,
    _enc: BufferEncoding,
    done: (error?: Error) => void
  ): Promise<void> {
    try {
      if (!this.parsedBackupInfo) {
        const info = Backups.BackupInfo.decode(data);
        this.parsedBackupInfo = true;

        this.logId = `BackupImport.run(${info.backupTimeMs})`;

        log.info(`${this.logId}: got BackupInfo`);

        if (info.version?.toNumber() !== BACKUP_VERSION) {
          throw new Error(`Unsupported backup version: ${info.version}`);
        }
      } else {
        const frame = Backups.Frame.decode(data);

        await this.processFrame(frame);
      }
      done();
    } catch (error) {
      const entryType = this.parsedBackupInfo ? 'frame' : 'info';
      log.error(`${this.logId}: failed to process ${entryType}`);
      done(error);
    }
  }

  override async _final(done: (error?: Error) => void): Promise<void> {
    try {
      // Finish saving remaining conversations/messages
      await this.conversationOpBatcher.flushAndWait();
      await this.saveMessageBatcher.flushAndWait();

      // Reset and reload conversations and storage again
      window.ConversationController.reset();

      await window.ConversationController.load();
      await window.ConversationController.checkForConflicts();

      window.storage.reset();
      await window.storage.fetch();

      // Update last message in every active conversation now that we have
      // them loaded into memory.
      await pMap(
        window.ConversationController.getAll().filter(convo => {
          return convo.get('active_at') || convo.get('isPinned');
        }),
        convo => convo.updateLastMessage(),
        { concurrency: MAX_CONCURRENCY }
      );

      done();
    } catch (error) {
      done(error);
    }
  }

  public cleanup(): void {
    this.conversationOpBatcher.unregister();
    this.saveMessageBatcher.unregister();
  }

  private async processFrame(frame: Backups.Frame): Promise<void> {
    if (frame.account) {
      await this.fromAccount(frame.account);

      // We run this outside of try catch below because failure to restore
      // the account data is fatal.
      return;
    }

    try {
      if (frame.recipient) {
        const { recipient } = frame;
        strictAssert(recipient.id != null, 'Recipient must have an id');
        let convo: ConversationAttributesType;
        if (recipient.contact) {
          convo = await this.fromContact(recipient.contact);
        } else if (recipient.self) {
          strictAssert(this.ourConversation != null, 'Missing account data');
          convo = this.ourConversation;
        } else if (recipient.group) {
          convo = await this.fromGroup(recipient.group);
        } else {
          log.warn(`${this.logId}: unsupported recipient item`);
          return;
        }

        if (convo !== this.ourConversation) {
          this.saveConversation(convo);
        }

        this.recipientIdToConvo.set(recipient.id.toNumber(), convo);
      } else if (frame.chat) {
        await this.fromChat(frame.chat);
      } else if (frame.chatItem) {
        await this.fromChatItem(frame.chatItem);
      } else {
        log.warn(`${this.logId}: unsupported frame item ${frame.item}`);
      }
    } catch (error) {
      log.error(
        `${this.logId}: failed to process a frame ${frame.item}, ` +
          `${Errors.toLogFormat(error)}`
      );
    }
  }

  private saveConversation(attributes: ConversationAttributesType): void {
    this.conversationOpBatcher.add({ isUpdate: false, attributes });
  }

  private updateConversation(attributes: ConversationAttributesType): void {
    this.conversationOpBatcher.add({ isUpdate: true, attributes });
  }

  private saveMessage(attributes: MessageAttributesType): void {
    this.saveMessageBatcher.add(attributes);
  }

  private async fromAccount(_account: Backups.IAccountData): Promise<void> {
    strictAssert(this.ourConversation === undefined, 'Duplicate AccountData');
    this.ourConversation =
      window.ConversationController.getOurConversationOrThrow().attributes;
  }

  private async fromContact(
    contact: Backups.IContact
  ): Promise<ConversationAttributesType> {
    strictAssert(
      contact.aci != null || contact.pni != null || contact.e164 != null,
      'fromContact: either aci, pni, or e164 must be present'
    );

    const aci = contact.aci
      ? fromAciObject(Aci.fromUuidBytes(contact.aci))
      : undefined;
    const pni = contact.pni
      ? fromPniObject(Pni.fromUuidBytes(contact.pni))
      : undefined;
    const e164 = contact.e164 ? `+${contact.e164}` : undefined;

    const attrs: ConversationAttributesType = {
      id: generateUuid(),
      type: 'private',
      version: 2,
      serviceId: aci ?? pni,
      pni,
      e164,
      removalStage: contact.hidden ? 'messageRequest' : undefined,
      profileKey: contact.profileKey
        ? Bytes.toBase64(contact.profileKey)
        : undefined,
      profileSharing: contact.profileSharing === true,
      profileName: dropNull(contact.profileGivenName),
      profileFamilyName: dropNull(contact.profileFamilyName),
      hideStory: contact.hideStory === true,
    };

    if (contact.registered === Backups.Contact.Registered.NOT_REGISTERED) {
      const timestamp = contact.unregisteredTimestamp?.toNumber() ?? Date.now();
      attrs.discoveredUnregisteredAt = timestamp;
      attrs.firstUnregisteredAt = timestamp;
    }

    if (contact.blocked) {
      const serviceId = aci || pni;
      if (serviceId) {
        await window.storage.blocked.addBlockedServiceId(serviceId);
      }
      if (e164) {
        await window.storage.blocked.addBlockedNumber(e164);
      }
    }

    return attrs;
  }

  private async fromGroup(
    group: Backups.IGroup
  ): Promise<ConversationAttributesType> {
    strictAssert(group.masterKey != null, 'fromGroup: missing masterKey');

    const secretParams = deriveGroupSecretParams(group.masterKey);
    const publicParams = deriveGroupPublicParams(secretParams);
    const groupId = Bytes.toBase64(deriveGroupID(secretParams));

    const attrs: ConversationAttributesType = {
      id: generateUuid(),
      type: 'group',
      version: 2,
      groupVersion: 2,
      masterKey: Bytes.toBase64(group.masterKey),
      groupId,
      secretParams: Bytes.toBase64(secretParams),
      publicParams: Bytes.toBase64(publicParams),
      profileSharing: group.whitelisted === true,
      hideStory: group.hideStory === true,
    };

    if (group.storySendMode === Backups.Group.StorySendMode.ENABLED) {
      attrs.storySendMode = StorySendMode.Always;
    } else if (group.storySendMode === Backups.Group.StorySendMode.DISABLED) {
      attrs.storySendMode = StorySendMode.Never;
    }

    return attrs;
  }

  private async fromChat(chat: Backups.IChat): Promise<void> {
    strictAssert(chat.id != null, 'chat must have an id');
    strictAssert(chat.recipientId != null, 'chat must have a recipientId');

    const conversation = this.recipientIdToConvo.get(
      chat.recipientId.toNumber()
    );
    strictAssert(conversation !== undefined, 'unknown conversation');

    this.chatIdToConvo.set(chat.id.toNumber(), conversation);

    conversation.isArchived = chat.archived === true;
    conversation.isPinned = chat.pinnedOrder != null;

    conversation.expireTimer = chat.expirationTimerMs
      ? DurationInSeconds.fromMillis(chat.expirationTimerMs.toNumber())
      : undefined;
    conversation.muteExpiresAt = chat.muteUntilMs
      ? getTimestampFromLong(chat.muteUntilMs)
      : undefined;
    conversation.markedUnread = chat.markedUnread === true;
    conversation.dontNotifyForMentionsIfMuted =
      chat.dontNotifyForMentionsIfMuted === true;

    this.updateConversation(conversation);

    if (chat.pinnedOrder != null) {
      const pinnedConversationIds = new Set(
        window.storage.get('pinnedConversationIds', new Array<string>())
      );

      pinnedConversationIds.add(conversation.id);

      await window.storage.put('pinnedConversationIds', [
        ...pinnedConversationIds,
      ]);
    }
  }

  private async fromChatItem(item: Backups.IChatItem): Promise<void> {
    strictAssert(this.ourConversation != null, 'AccountData missing');

    strictAssert(item.chatId != null, 'chatItem must have a chatId');
    strictAssert(item.authorId != null, 'chatItem must have a authorId');
    strictAssert(item.dateSent != null, 'chatItem must have a dateSent');

    const chatConvo = this.chatIdToConvo.get(item.chatId.toNumber());
    strictAssert(chatConvo !== undefined, 'chat conversation not found');

    const authorConvo = this.recipientIdToConvo.get(item.authorId.toNumber());
    strictAssert(authorConvo !== undefined, 'author conversation not found');

    const isOutgoing = this.ourConversation.id === authorConvo.id;

    let attributes: MessageAttributesType = {
      id: generateUuid(),
      canReplyToStory: false,
      conversationId: chatConvo.id,
      received_at: incrementMessageCounter(),
      sent_at: item.dateSent.toNumber(),
      source: authorConvo.e164,
      sourceServiceId: authorConvo.serviceId,
      timestamp: item.dateSent.toNumber(),
      type: isOutgoing ? 'outgoing' : 'incoming',
      unidentifiedDeliveryReceived: false,
      expirationStartTimestamp: item.expireStartDate
        ? getTimestampFromLong(item.expireStartDate)
        : undefined,
      expireTimer: item.expiresInMs
        ? DurationInSeconds.fromMillis(item.expiresInMs.toNumber())
        : undefined,
    };

    if (isOutgoing) {
      const { outgoing } = item;
      strictAssert(outgoing, 'outgoing message must have outgoing field');

      const sendStateByConversationId: SendStateByConversationId = {};

      const BackupSendStatus = Backups.SendStatus.Status;

      for (const status of outgoing.sendStatus ?? []) {
        strictAssert(
          status.recipientId,
          'sendStatus recipient must have an id'
        );
        const target = this.recipientIdToConvo.get(
          status.recipientId.toNumber()
        );
        strictAssert(
          target !== undefined,
          'status target conversation not found'
        );

        let sendStatus: SendStatus;
        switch (status.deliveryStatus) {
          case BackupSendStatus.PENDING:
            sendStatus = SendStatus.Pending;
            break;
          case BackupSendStatus.SENT:
            sendStatus = SendStatus.Sent;
            break;
          case BackupSendStatus.DELIVERED:
            sendStatus = SendStatus.Delivered;
            break;
          case BackupSendStatus.READ:
            sendStatus = SendStatus.Read;
            break;
          case BackupSendStatus.VIEWED:
            sendStatus = SendStatus.Viewed;
            break;
          case BackupSendStatus.FAILED:
          default:
            sendStatus = SendStatus.Failed;
            break;
        }

        sendStateByConversationId[target.id] = {
          status: sendStatus,
          updatedAt:
            status.lastStatusUpdateTimestamp != null
              ? getTimestampFromLong(status.lastStatusUpdateTimestamp)
              : undefined,
        };
      }

      attributes.sendStateByConversationId = sendStateByConversationId;
      chatConvo.active_at = attributes.sent_at;
    } else {
      const { incoming } = item;
      strictAssert(incoming, 'incoming message must have incoming field');
      attributes.received_at_ms =
        incoming.dateReceived?.toNumber() ?? Date.now();

      if (incoming.read) {
        attributes.readStatus = ReadStatus.Read;
        attributes.seenStatus = SeenStatus.Seen;
      } else {
        attributes.readStatus = ReadStatus.Unread;
        attributes.seenStatus = SeenStatus.Unseen;
        chatConvo.unreadCount = (chatConvo.unreadCount ?? 0) + 1;
      }

      chatConvo.active_at = attributes.received_at_ms;
    }

    if (item.standardMessage) {
      attributes = {
        ...attributes,
        ...this.fromStandardMessage(item.standardMessage),
      };
    }

    assertDev(
      isAciString(this.ourConversation.serviceId),
      'Our conversation must have ACI'
    );
    this.saveMessage(attributes);

    if (isOutgoing) {
      chatConvo.sentMessageCount = (chatConvo.sentMessageCount ?? 0) + 1;
    } else {
      chatConvo.messageCount = (chatConvo.messageCount ?? 0) + 1;
    }
    this.updateConversation(chatConvo);
  }

  private fromStandardMessage(
    data: Backups.IStandardMessage
  ): Partial<MessageAttributesType> {
    return {
      body: data.text?.body ?? '',
      reactions: data.reactions?.map(
        ({ emoji, authorId, sentTimestamp, receivedTimestamp }) => {
          strictAssert(emoji != null, 'reaction must have an emoji');
          strictAssert(authorId != null, 'reaction must have authorId');
          strictAssert(
            sentTimestamp != null,
            'reaction must have a sentTimestamp'
          );
          strictAssert(
            receivedTimestamp != null,
            'reaction must have a receivedTimestamp'
          );

          const authorConvo = this.recipientIdToConvo.get(authorId.toNumber());
          strictAssert(
            authorConvo !== undefined,
            'author conversation not found'
          );

          return {
            emoji,
            fromId: authorConvo.id,
            targetTimestamp: getTimestampFromLong(sentTimestamp),
            receivedAtDate: getTimestampFromLong(receivedTimestamp),
            timestamp: getTimestampFromLong(sentTimestamp),
          };
        }
      ),
    };
  }
}
