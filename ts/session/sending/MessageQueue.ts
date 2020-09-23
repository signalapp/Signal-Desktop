import { EventEmitter } from 'events';
import {
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
} from './MessageQueueInterface';
import {
  ClosedGroupMessage,
  ContentMessage,
  ExpirationTimerUpdateMessage,
  OpenGroupMessage,
  SessionRequestMessage,
  SyncMessage,
  TypingMessage,
} from '../messages/outgoing';
import { PendingMessageCache } from './PendingMessageCache';
import { GroupUtils, JobQueue, TypedEventEmitter } from '../utils';
import { PubKey } from '../types';
import { MessageSender } from '.';
import { MultiDeviceProtocol, SessionProtocol } from '../protocols';
import { UserUtil } from '../../util';

export class MessageQueue implements MessageQueueInterface {
  public readonly events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  private readonly jobQueues: Map<string, JobQueue> = new Map();
  private readonly pendingMessageCache: PendingMessageCache;

  constructor(cache?: PendingMessageCache) {
    this.events = new EventEmitter();
    this.pendingMessageCache = cache ?? new PendingMessageCache();
    void this.processAllPending();
  }

  public async sendUsingMultiDevice(
    user: PubKey,
    message: ContentMessage
  ): Promise<void> {
    if (message instanceof SyncMessage) {
      return this.sendSyncMessage(message);
    }

    const userDevices = await MultiDeviceProtocol.getAllDevices(user.key);
    await this.sendMessageToDevices(userDevices, message);
  }

  public async send(device: PubKey, message: ContentMessage): Promise<void> {
    if (message instanceof SyncMessage) {
      return this.sendSyncMessage(message);
    }

    await this.sendMessageToDevices([device], message);
  }

  public async sendToGroup(
    message: OpenGroupMessage | ContentMessage
  ): Promise<void> {
    // Open groups
    if (message instanceof OpenGroupMessage) {
      // No queue needed for Open Groups; send directly
      const error = new Error('Failed to send message to open group.');

      // This is absolutely yucky ... we need to make it not use Promise<boolean>
      try {
        const result = await MessageSender.sendToOpenGroup(message);
        // sendToOpenGroup returns -1 if failed or an id if succeeded
        if (result.serverId < 0) {
          this.events.emit('fail', message, error);
        } else {
          const messageEventData = {
            pubKey: message.group.groupId,
            timestamp: message.timestamp,
            serverId: result.serverId,
            serverTimestamp: result.serverTimestamp,
          };
          this.events.emit('success', message);

          window.Whisper.events.trigger('publicMessageSent', messageEventData);
        }
      } catch (e) {
        console.warn(
          `Failed to send message to open group: ${message.group.server}`,
          e
        );
        this.events.emit('fail', message, error);
      }

      return;
    }

    let groupId: PubKey | undefined;
    if (message instanceof ClosedGroupMessage) {
      groupId = message.groupId;
    } else if (message instanceof TypingMessage) {
      groupId = message.groupId;
    } else if (message instanceof ExpirationTimerUpdateMessage) {
      groupId = message.groupId;
    }

    if (!groupId) {
      throw new Error('Invalid group message passed in sendToGroup.');
    }

    // Get devices in group
    let recipients = await GroupUtils.getGroupMembers(groupId);

    // Don't send to our own device as they'll likely be synced across.
    const ourKey = await UserUtil.getCurrentDevicePubKey();
    if (!ourKey) {
      throw new Error('Cannot get current user public key');
    }
    const ourPrimary = await MultiDeviceProtocol.getPrimaryDevice(ourKey);
    recipients = recipients.filter(member => !ourPrimary.isEqual(member));

    if (recipients.length === 0) {
      return;
    }

    // Send to all devices of members
    await Promise.all(
      recipients.map(async recipient =>
        this.sendUsingMultiDevice(recipient, message)
      )
    );
  }

  public async sendSyncMessage(
    message: SyncMessage | undefined
  ): Promise<void> {
    if (!message) {
      return;
    }

    const ourDevices = await MultiDeviceProtocol.getOurDevices();
    await this.sendMessageToDevices(ourDevices, message);
  }

  public async processPending(device: PubKey) {
    const messages = await this.pendingMessageCache.getForDevice(device);

    const isMediumGroup = GroupUtils.isMediumGroup(device);
    const hasSession = await SessionProtocol.hasSession(device);

    // If we don't have a session then try and establish one and then continue sending messages
    if (!isMediumGroup && !hasSession) {
      await SessionProtocol.sendSessionRequestIfNeeded(device);
    }

    const jobQueue = this.getJobQueue(device);
    messages.forEach(async message => {
      const messageId = String(message.timestamp);

      if (!jobQueue.has(messageId)) {
        // We put the event handling inside this job to avoid sending duplicate events
        const job = async () => {
          try {
            const wrappedEnvelope = await MessageSender.send(message);
            this.events.emit('success', message, wrappedEnvelope);
          } catch (e) {
            this.events.emit('fail', message, e);
          } finally {
            // Remove from the cache because retrying is done in the sender
            void this.pendingMessageCache.remove(message);
          }
        };
        await jobQueue.addWithId(messageId, job);
      }
    });
  }

  public async sendMessageToDevices(
    devices: Array<PubKey>,
    message: ContentMessage
  ) {
    const promises = devices.map(async device => {
      await this.process(device, message);
    });

    return Promise.all(promises);
  }

  private async processAllPending() {
    const devices = await this.pendingMessageCache.getDevices();
    const promises = devices.map(async device => this.processPending(device));

    return Promise.all(promises);
  }

  private async process(
    device: PubKey,
    message: ContentMessage
  ): Promise<void> {
    // Don't send to ourselves
    const currentDevice = await UserUtil.getCurrentDevicePubKey();
    if (currentDevice && device.isEqual(currentDevice)) {
      return;
    }

    if (message instanceof SessionRequestMessage) {
      return SessionProtocol.sendSessionRequest(message, device);
    }

    await this.pendingMessageCache.add(device, message);
    void this.processPending(device);
  }

  private getJobQueue(device: PubKey): JobQueue {
    let queue = this.jobQueues.get(device.key);
    if (!queue) {
      queue = new JobQueue();
      this.jobQueues.set(device.key, queue);
    }

    return queue;
  }
}
