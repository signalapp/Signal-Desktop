import * as _ from 'lodash';
import * as Data from '../../../js/modules/data';
import { textsecure } from '../../window';

import { EventEmitter } from 'events';
import {
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
  GroupMessageType,
} from './MessageQueueInterface';
import {
  ClosedGroupMessage,
  ContentMessage,
  OpenGroupMessage,
  SessionResetMessage,
  SyncMessage,
} from '../messages/outgoing';
import { PendingMessageCache } from './PendingMessageCache';
import {
  JobQueue,
  TypedEventEmitter,
  MessageUtils,
  SyncMessageUtils,
} from '../utils';
import { PubKey } from '../types';
import { ConversationController } from '../../window';
import { MessageSender } from '.';
import { SessionProtocol } from '../protocols';
import { generateFakePubkey } from '../../test/test-utils/testUtils';

export class MessageQueue implements MessageQueueInterface {
  public readonly events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  private readonly jobQueues: Map<PubKey, JobQueue> = new Map();
  private readonly pendingMessageCache: PendingMessageCache;

  constructor() {
    this.events = new EventEmitter();
    this.pendingMessageCache = new PendingMessageCache();
    void this.processAllPending();
  }

  public async sendUsingMultiDevice(user: PubKey, message: ContentMessage) {
    const userLinked = await Data.getPairedDevicesFor(user.key);
    const userDevices = userLinked.map(d => new PubKey(d));

    await this.sendMessageToDevices(userDevices, message);
  }

  public async send(device: PubKey, message: ContentMessage) {
    await this.sendMessageToDevices([device], message);
  }

  public async sendMessageToDevices(
    devices: Array<PubKey>,
    message: ContentMessage
  ) {
    let currentDevices = [...devices];

    if (SyncMessageUtils.canSync(message)) {
      // Sync to our devices
      const syncMessage = SyncMessageUtils.from(message);
      const ourDevices = await this.sendSyncMessage(syncMessage);

      // Remove our devices from currentDevices
      currentDevices = _.xor(currentDevices, ourDevices);
    }

    currentDevices.forEach(async device => {
      await this.queue(device, message);
    });
  }

  public async sendToGroup(message: OpenGroupMessage | ContentMessage): Promise<boolean> {
    if (
      !(message instanceof OpenGroupMessage) &&
      !(message instanceof ClosedGroupMessage)
    ) {
      return false;
    }

    // Closed groups
    if (message instanceof ClosedGroupMessage) {
      // Get devices in closed group
      const conversation = ConversationController.get(message.groupId);
      const recipientsModels = conversation.contactCollection.models;
      const recipients: Array<PubKey> = recipientsModels.map(
        (recipient: any) => new PubKey(recipient.id)
      );

      await this.sendMessageToDevices(recipients, message);

      return true;
    }

    // Open groups
    if (message instanceof OpenGroupMessage) {
      // No queue needed for Open Groups; send directly
      const rawMessage = MessageUtils.toRawMessage(message.group, message);
      await MessageSender.send(message);

      return true;
    }

    return false;
  }

  public async sendSyncMessage(
    message: ContentMessage
  ): Promise<void> {
    // Sync with our devices
    
    

    const ourDevices = await SyncMessageUtils.getSyncContacts();
    ourDevices.forEach(async device => {
      const syncMessage = await SyncMessageUtils.from(message, device);

      if (syncMessage) {
        await this.queue(device, syncMessage);
      }
    });
  }

  public async processPending(device: PubKey) {
    const messages = this.pendingMessageCache.getForDevice(device);

    const hasSession = SessionProtocol.hasSession(device);
    const conversation = ConversationController.get(device.key);
    const isMediumGroup = conversation.isMediumGroup();

    if (!isMediumGroup && !hasSession) {
      await SessionProtocol.sendSessionRequestIfNeeded(device);

      return;
    }

    const jobQueue = this.getJobQueue(device);
    messages.forEach(message => {
      if (!jobQueue.has(message.identifier)) {
        const promise = jobQueue.add(async () => MessageSender.send(message));

        promise
          .then(() => {
            // Message sent; remove from cache
            void this.pendingMessageCache.remove(message);
          })
          .catch(() => {
            // Message failed to send
          });
      }
    });
  }

  private async processAllPending() {
    const devices = this.pendingMessageCache.getDevices();
    const promises = devices.map(async device => this.processPending(device));

    return Promise.all(promises);
  }

  private async queue(device: PubKey, message: ContentMessage) {
    if (message instanceof SessionResetMessage) {
      return;
    }

    await this.pendingMessageCache.add(device, message);
    await this.processPending(device);
  }

  private getJobQueue(device: PubKey): JobQueue {
    let queue = this.jobQueues.get(device);
    if (!queue) {
      queue = new JobQueue();
      this.jobQueues.set(device, queue);
    }

    return queue;
  }

}
