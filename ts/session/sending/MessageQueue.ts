import * as _ from 'lodash';
import * as Data from '../../../js/modules/data';
import { textsecure } from '../../window';

import { EventEmitter } from 'events';
import {
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
  GroupMessageType,
} from './MessageQueueInterface';
import { ContentMessage, OpenGroupMessage, SyncMessage, SessionResetMessage, ClosedGroupMessage } from '../messages/outgoing';
import { PendingMessageCache } from './PendingMessageCache';
import { JobQueue, TypedEventEmitter, toRawMessage, toSyncMessage } from '../utils';
import { PubKey } from '../types';
import { ConversationController } from '../../window';
import { MessageSender } from '.';
import { SessionProtocol } from '../protocols';


export class MessageQueue implements MessageQueueInterface {
  public readonly events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  private readonly jobQueues: Map<PubKey, JobQueue> = new Map();
  private readonly cache: PendingMessageCache;

  constructor() {
    this.events = new EventEmitter();
    this.cache = new PendingMessageCache();
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

  public async sendMessageToDevices(devices: Array<PubKey>, message: ContentMessage) {
    let currentDevices = [...devices];

    if (SyncMessage.canSync(message)) {
      // Sync to our devices
      const syncMessage = toSyncMessage.from(message);
      await this.sendSyncMessage(syncMessage);

      // Remove our devices from currentDevices
      const ourDevices = await this.getOurDevices();
      currentDevices = currentDevices.filter(device => !_.includes(ourDevices, device));
    }

    currentDevices.forEach(async device => {
      await this.queue(device, message);
    });
  }

  public async sendToGroup(message: OpenGroupMessage | ContentMessage) {

    if (!(message instanceof OpenGroupMessage) && !(message instanceof ClosedGroupMessage)) {
      return;
    }

    // Closed groups
    if (message instanceof ClosedGroupMessage) {
      // Get devices in closed group
      const conversation = ConversationController.get(message.groupId);

      const recipients = 5;

      await this.sendMessageToDevices(recipients, message);
    }

    // Open groups 
    if (message instanceof OpenGroupMessage) {
      // No queue needed for Open Groups; send directly

    }

  }

  public async sendSyncMessage(message: ContentMessage) {
    // Sync with our devices

    const syncMessage = toSyncMessage();
    if (!syncMessage.canSync()) {
      return;
    }

    const ourDevices = await this.getOurDevices();

    ourDevices.forEach(async device => {
      await this.queue(device, message);
    });
  }

  public async processPending(device: PubKey) {
    const messages = this.cache.getForDevice(device);

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

        promise.then(() => {
          // Message sent; remove from cache
          void this.cache.remove(message);
        }).catch(() => {
          // Message failed to send
        });
      }
    });
  }

  private async processAllPending() {
    const devices = this.cache.getDevices();
    const promises = devices.map(async device => this.processPending(device));

    return Promise.all(promises);
  }

  private async queue(device: PubKey, message: ContentMessage) {
    if (message instanceof SessionResetMessage) {
      return;
    }

    await this.cache.add(device, message);
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

  private async getOurDevices(): Promise<Array<PubKey>> {
    const ourKey = await textsecure.storage.user.getNumber();
    const ourLinked = await Data.getPairedDevicesFor(ourKey);

    return ourLinked.map(d => new PubKey(d));
  }
}
