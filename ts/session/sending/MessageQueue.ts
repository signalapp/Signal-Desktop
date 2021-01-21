import { EventEmitter } from 'events';
import {
  GroupMessageType,
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
} from './MessageQueueInterface';
import {
  ContentMessage,
  ExpirationTimerUpdateMessage,
  OpenGroupMessage,
} from '../messages/outgoing';
import { PendingMessageCache } from './PendingMessageCache';
import { JobQueue, TypedEventEmitter, UserUtils } from '../utils';
import { PubKey, RawMessage } from '../types';
import { MessageSender } from '.';
import { ClosedGroupV2Message } from '../messages/outgoing/content/data/groupv2/ClosedGroupV2Message';

export class MessageQueue implements MessageQueueInterface {
  public readonly events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  private readonly jobQueues: Map<string, JobQueue> = new Map();
  private readonly pendingMessageCache: PendingMessageCache;

  constructor(cache?: PendingMessageCache) {
    this.events = new EventEmitter();
    this.pendingMessageCache = cache ?? new PendingMessageCache();
    void this.processAllPending();
  }

  public async sendToPubKey(
    user: PubKey,
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    // if (message instanceof SyncMessage) {
    //   return this.sendSyncMessage(message);
    // }

    await this.sendMessageToDevices([user], message);
  }

  public async send(
    device: PubKey,
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    // if (message instanceof SyncMessage) {
    //   return this.sendSyncMessage(message);
    // }
    await this.sendMessageToDevices([device], message, sentCb);
  }

  /**
   *
   * @param sentCb currently only called for medium groups sent message
   */
  public async sendToGroup(
    message: GroupMessageType,
    sentCb?: (message: RawMessage) => Promise<void>
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
          this.events.emit('sendFail', message, error);
        } else {
          const messageEventData = {
            identifier: message.identifier,
            pubKey: message.group.groupId,
            timestamp: message.timestamp,
            serverId: result.serverId,
            serverTimestamp: result.serverTimestamp,
          };
          this.events.emit('sendSuccess', message);

          window.Whisper.events.trigger('publicMessageSent', messageEventData);
        }
      } catch (e) {
        window?.log?.warn(
          `Failed to send message to open group: ${message.group.server}`,
          e
        );
        this.events.emit('sendFail', message, error);
      }

      return;
    }

    let groupId: PubKey | undefined;
    if (
      message instanceof ExpirationTimerUpdateMessage ||
      message instanceof ClosedGroupV2Message
    ) {
      groupId = message.groupId;
    }

    if (!groupId) {
      throw new Error('Invalid group message passed in sendToGroup.');
    }
    // if groupId is set here, it means it's for a medium group. So send it as it
    return this.send(PubKey.cast(groupId), message, sentCb);
  }

  public async sendSyncMessage(
    message: any | undefined,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    if (!message) {
      return;
    }

    const ourPubKey = await UserUtils.getCurrentDevicePubKey();

    if (!ourPubKey) {
      throw new Error('ourNumber is not set');
    }

    window.log.warn('sendSyncMessage TODO with syncTarget');
    await this.sendMessageToDevices([PubKey.cast(ourPubKey)], message, sentCb);
  }

  public async processPending(device: PubKey) {
    const messages = await this.pendingMessageCache.getForDevice(device);

    const jobQueue = this.getJobQueue(device);
    messages.forEach(async message => {
      const messageId = String(message.timestamp);

      if (!jobQueue.has(messageId)) {
        // We put the event handling inside this job to avoid sending duplicate events
        const job = async () => {
          try {
            const wrappedEnvelope = await MessageSender.send(message);
            this.events.emit('sendSuccess', message, wrappedEnvelope);
            const cb = this.pendingMessageCache.callbacks.get(
              message.identifier
            );

            if (cb) {
              await cb(message);
            }
            this.pendingMessageCache.callbacks.delete(message.identifier);
          } catch (e) {
            this.events.emit('sendFail', message, e);
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
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>
  ) {
    const promises = devices.map(async device => {
      await this.process(device, message, sentCb);
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
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    // Don't send to ourselves
    const currentDevice = await UserUtils.getCurrentDevicePubKey();
    if (currentDevice && device.isEqual(currentDevice)) {
      return;
    }

    await this.pendingMessageCache.add(device, message, sentCb);
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
