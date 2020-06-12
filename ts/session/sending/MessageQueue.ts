import * as _ from 'lodash';
import { getPairedDevicesFor } from '../../../js/modules/data';
import { ConversationController } from '../../window';

import { EventEmitter } from 'events';
import {
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
} from './MessageQueueInterface';
import {
  ClosedGroupMessage,
  ContentMessage,
  OpenGroupMessage,
  SessionRequestMessage,
} from '../messages/outgoing';
import { PendingMessageCache } from './PendingMessageCache';
import { JobQueue, SyncMessageUtils, TypedEventEmitter } from '../utils';
import { PubKey } from '../types';
import { MessageSender } from '.';
import { SessionProtocol } from '../protocols';
import * as UserUtils from '../../util/user';

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
    const userLinked = await getPairedDevicesFor(user.key);
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

    // Sync to our devices if syncable
    if (SyncMessageUtils.canSync(message)) {
      const currentDevice = await UserUtils.getCurrentDevicePubKey();

      if (currentDevice) {
        const otherDevices = await getPairedDevicesFor(currentDevice);

        const ourDevices = [currentDevice, ...otherDevices].map(
          device => new PubKey(device)
        );
        await this.sendSyncMessage(message, ourDevices);

        // Remove our devices from currentDevices
        const ourDeviceContacts = ourDevices.map(device =>
          ConversationController.get(device.key)
        );
        currentDevices = _.xor(currentDevices, ourDeviceContacts);
      }
    }

    const promises = currentDevices.map(async device => {
      await this.process(device, message);
    });

    return Promise.all(promises);
  }

  public async sendToGroup(
    message: OpenGroupMessage | ContentMessage
  ): Promise<boolean> {
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

      try {
        await MessageSender.sendToOpenGroup(message);
        this.events.emit('success', message);
      } catch (e) {
        this.events.emit('fail', message, e);
      }

      return true;
    }

    return false;
  }

  public async sendSyncMessage(message: ContentMessage, sendTo: Array<PubKey>) {
    // Sync with our devices
    const promises = sendTo.map(async device => {
      const syncMessage = SyncMessageUtils.from(message);

      return this.process(device, syncMessage);
    });

    return Promise.all(promises);
  }

  public async processPending(device: PubKey) {
    const messages = this.pendingMessageCache.getForDevice(device);

    // TODO: Simpify the isMediumGroup check to not rely on ANY window objects
    // const isMediumGroup = messages.some(m => m instanceof MediumGroupMessage);
    const isMediumGroup = false;
    const hasSession = SessionProtocol.hasSession(device);

    if (!isMediumGroup && !hasSession) {
      await SessionProtocol.sendSessionRequestIfNeeded(device);

      return;
    }

    const jobQueue = this.getJobQueue(device);
    messages.forEach(async message => {
      const messageId = String(message.timestamp);

      if (!jobQueue.has(messageId)) {
        try {
          await jobQueue.addWithId(messageId, async () =>
            MessageSender.send(message)
          );
          void this.pendingMessageCache.remove(message);
          this.events.emit('success', message);
        } catch (e) {
          this.events.emit('fail', message, e);
        }
      }
    });
  }

  private async processAllPending() {
    const devices = this.pendingMessageCache.getDevices();
    const promises = devices.map(async device => this.processPending(device));

    return Promise.all(promises);
  }

  private async process(device: PubKey, message?: ContentMessage) {
    if (!message) {
      return;
    }

    if (message instanceof SessionRequestMessage) {
      void SessionProtocol.sendSessionRequest(message, device);

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
