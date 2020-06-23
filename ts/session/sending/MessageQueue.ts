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
  SyncMessage,
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

  constructor(cache?: PendingMessageCache) {
    this.events = new EventEmitter();
    this.pendingMessageCache = cache ?? new PendingMessageCache();
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
      const syncMessage = SyncMessageUtils.from(message);
      if (!syncMessage) {
        throw new Error(
          'MessageQueue internal error occured: failed to make sync message'
        );
      }

      await this.sendSyncMessage(syncMessage);

      const ourDevices = await MultiDeviceProtocol.getOurDevices();
      // Remove our devices from currentDevices
      currentDevices = currentDevices.filter(
        device => !ourDevices.some(d => device.isEqual(d))
      );
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
      const recipients = await GroupUtils.getGroupMembers(message.groupId);
      if (recipients.length === 0) {
        return false;
      }

      // Send to all devices of members
      await Promise.all(
        recipients.map(async recipient =>
          this.sendUsingMultiDevice(recipient, message)
        )
      );

      return true;
    }

    // Open groups
    if (message instanceof OpenGroupMessage) {
      // No queue needed for Open Groups; send directly
      const error = new Error('Failed to send message to open group.');

      // This is absolutely yucky ... we need to make it not use Promise<boolean>
      try {
        const result = await MessageSender.sendToOpenGroup(message);
        if (result) {
          this.events.emit('success', message);
        } else {
          this.events.emit('fail', message, error);
        }

        return result;
      } catch (e) {
        console.warn(
          `Failed to send message to open group: ${message.group.server}`,
          e
        );
        this.events.emit('fail', message, error);

        return false;
      }
    }

    return false;
  }

  public async sendSyncMessage(message: SyncMessage | undefined): Promise<any> {
    if (!message) {
      return;
    }

    const ourDevices = await MultiDeviceProtocol.getOurDevices();
    const promises = ourDevices.map(async device =>
      this.process(device, message)
    );
    return Promise.all(promises);
  }

  public async processPending(device: PubKey) {
    const messages = await this.pendingMessageCache.getForDevice(device);

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
          this.events.emit('success', message);
        } catch (e) {
          this.events.emit('fail', message, e);
        } finally {
          // Remove from the cache because retrying is done in the sender
          void this.pendingMessageCache.remove(message);
        }
      }
    });
  }

  private async processAllPending() {
    const devices = await this.pendingMessageCache.getDevices();
    const promises = devices.map(async device => this.processPending(device));

    return Promise.all(promises);
  }

  private async process(
    device: PubKey,
    message?: ContentMessage
  ): Promise<void> {
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
    void this.processPending(device);
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
