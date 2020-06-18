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
import {
  GroupUtils,
  JobQueue,
  SyncMessageUtils,
  TypedEventEmitter,
} from '../utils';
import { PubKey } from '../types';
import { MessageSender } from '.';
import { MultiDeviceProtocol, SessionProtocol } from '../protocols';
import { UserUtil } from '../../util';

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
    const userDevices = await MultiDeviceProtocol.getAllDevices(user.key);

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
      const currentDevice = await UserUtil.getCurrentDevicePubKey();

      if (currentDevice) {
        const ourDevices = await MultiDeviceProtocol.getAllDevices(
          currentDevice
        );

        await this.sendSyncMessage(message, ourDevices);

        // Remove our devices from currentDevices
        currentDevices = currentDevices.filter(device =>
          ourDevices.some(d => device.isEqual(d))
        );
      }
    }

    const promises = currentDevices.map(async device => {
      await this.process(device, message);
    });

    return Promise.all(promises);
  }

  public async sendToGroup(
    message: OpenGroupMessage | ClosedGroupMessage
  ): Promise<boolean> {
    // Closed groups
    if (message instanceof ClosedGroupMessage) {
      // Get devices in closed group
      const groupPubKey = PubKey.from(message.groupId);
      if (!groupPubKey) {
        return false;
      }

      const recipients = await GroupUtils.getGroupMembers(groupPubKey);

      if (recipients.length) {
        await this.sendMessageToDevices(recipients, message);

        return true;
      }
    }

    // Open groups
    if (message instanceof OpenGroupMessage) {
      // No queue needed for Open Groups; send directly
      try {
        await MessageSender.sendToOpenGroup(message);
        this.events.emit('success', message);

        return true;
      } catch (e) {
        this.events.emit('fail', message, e);

        return false;
      }
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

    const isMediumGroup = GroupUtils.isMediumGroup(device);
    const hasSession = await SessionProtocol.hasSession(device);

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
    // Don't send to ourselves
    const currentDevice = await UserUtil.getCurrentDevicePubKey();
    if (!message || (currentDevice && device.isEqual(currentDevice))) {
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
