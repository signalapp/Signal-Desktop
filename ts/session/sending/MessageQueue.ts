import { PendingMessageCache } from './PendingMessageCache';
import { JobQueue, UserUtils } from '../utils';
import { PubKey, RawMessage } from '../types';
import { MessageSender } from '.';
import { ClosedGroupMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMessage';
import { ConfigurationMessage } from '../messages/outgoing/controlMessage/ConfigurationMessage';
import { ClosedGroupNameChangeMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage';

import { ClosedGroupMemberLeftMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMemberLeftMessage';
import { MessageSentHandler } from './MessageSentHandler';
import { ContentMessage, OpenGroupMessage } from '../messages/outgoing';
import { ExpirationTimerUpdateMessage } from '../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { ClosedGroupAddedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage';
import { ClosedGroupEncryptionPairMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage';
import { ClosedGroupEncryptionPairRequestMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairRequestMessage';
import { ClosedGroupNewMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNewMessage';
import { ClosedGroupRemovedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage';
import { ClosedGroupVisibleMessage } from '../messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { SyncMessageType } from '../utils/syncUtils';

import { OpenGroupRequestCommonType } from '../../opengroup/opengroupV2/ApiUtil';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';

type ClosedGroupMessageType =
  | ClosedGroupVisibleMessage
  | ClosedGroupAddedMembersMessage
  | ClosedGroupRemovedMembersMessage
  | ClosedGroupNameChangeMessage
  | ClosedGroupMemberLeftMessage
  | ExpirationTimerUpdateMessage
  | ClosedGroupEncryptionPairMessage
  | ClosedGroupEncryptionPairRequestMessage;

// ClosedGroupEncryptionPairReplyMessage must be sent to a user pubkey. Not a group.

export class MessageQueue {
  private readonly jobQueues: Map<string, JobQueue> = new Map();
  private readonly pendingMessageCache: PendingMessageCache;

  constructor(cache?: PendingMessageCache) {
    this.pendingMessageCache = cache ?? new PendingMessageCache();
    void this.processAllPending();
  }

  public async sendToPubKey(
    user: PubKey,
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    if (message instanceof ConfigurationMessage || !!(message as any).syncTarget) {
      throw new Error('SyncMessage needs to be sent with sendSyncMessage');
    }
    await this.process(user, message, sentCb);
  }

  /**
   * DEPRECATED This function is synced. It will wait for the message to be delivered to the open
   * group to return.
   * So there is no need for a sendCb callback
   *
   */
  public async sendToOpenGroup(message: OpenGroupMessage) {
    // Open groups
    if (!(message instanceof OpenGroupMessage)) {
      throw new Error('sendToOpenGroup can only be used with OpenGroupMessage');
    }
    // No queue needed for Open Groups; send directly
    const error = new Error('Failed to send message to open group.');

    // This is absolutely yucky ... we need to make it not use Promise<boolean>
    try {
      const result = await MessageSender.sendToOpenGroup(message);
      // sendToOpenGroup returns -1 if failed or an id if succeeded
      if (result.serverId < 0) {
        void MessageSentHandler.handleMessageSentFailure(message, error);
      } else {
        void MessageSentHandler.handlePublicMessageSentSuccess(message, result);
      }
    } catch (e) {
      window?.log?.warn(`Failed to send message to open group: ${message.group.server}`, e);
      void MessageSentHandler.handleMessageSentFailure(message, error);
    }
  }

  /**
   * This function is synced. It will wait for the message to be delivered to the open
   * group to return.
   * So there is no need for a sendCb callback
   *
   */
  public async sendToOpenGroupV2(
    message: OpenGroupVisibleMessage,
    roomInfos: OpenGroupRequestCommonType
  ) {
    // No queue needed for Open Groups v2; send directly
    const error = new Error('Failed to send message to open group.');

    try {
      const { sentTimestamp, serverId } = await MessageSender.sendToOpenGroupV2(message, roomInfos);
      if (!serverId) {
        throw new Error(`Invalid serverId returned by server: ${serverId}`);
      }
      void MessageSentHandler.handlePublicMessageSentSuccess(message, {
        serverId: serverId,
        serverTimestamp: sentTimestamp,
      });
    } catch (e) {
      window?.log?.warn(`Failed to send message to open group: ${roomInfos}`, e);
      void MessageSentHandler.handleMessageSentFailure(message, error);
    }
  }

  /**
   *
   * @param sentCb currently only called for medium groups sent message
   */
  public async sendToGroup(
    message: ClosedGroupMessageType,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    let groupId: PubKey | undefined;
    if (message instanceof ExpirationTimerUpdateMessage || message instanceof ClosedGroupMessage) {
      groupId = message.groupId;
    }

    if (!groupId) {
      throw new Error('Invalid group message passed in sendToGroup.');
    }
    // if groupId is set here, it means it's for a medium group. So send it as it
    return this.sendToPubKey(PubKey.cast(groupId), message, sentCb);
  }

  public async sendSyncMessage(
    message?: SyncMessageType,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    if (!message) {
      return;
    }
    if (!(message instanceof ConfigurationMessage) && !(message as any)?.syncTarget) {
      throw new Error('Invalid message given to sendSyncMessage');
    }

    const ourPubKey = UserUtils.getOurPubKeyStrFromCache();

    await this.process(PubKey.cast(ourPubKey), message, sentCb);
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
            await MessageSentHandler.handleMessageSentSuccess(message, wrappedEnvelope);

            const cb = this.pendingMessageCache.callbacks.get(message.identifier);

            if (cb) {
              await cb(message);
            }
            this.pendingMessageCache.callbacks.delete(message.identifier);
          } catch (error) {
            void MessageSentHandler.handleMessageSentFailure(message, error);
          } finally {
            // Remove from the cache because retrying is done in the sender
            void this.pendingMessageCache.remove(message);
          }
        };
        await jobQueue.addWithId(messageId, job);
      }
    });
  }

  /**
   * This method should be called when the app is started and the user loggedin to fetch
   * existing message waiting to be sent in the cache of message
   */
  public async processAllPending() {
    const devices = await this.pendingMessageCache.getDevices();
    const promises = devices.map(async device => this.processPending(device));

    return Promise.all(promises);
  }

  /**
   * This method should not be called directly. Only through sendToPubKey.
   */
  private async process(
    device: PubKey,
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    // Don't send to ourselves
    const currentDevice = UserUtils.getOurPubKeyFromCache();
    if (currentDevice && device.isEqual(currentDevice)) {
      // We allow a message for ourselve only if it's a ConfigurationMessage, a ClosedGroupNewMessage,
      // or a message with a syncTarget set.
      if (
        message instanceof ConfigurationMessage ||
        message instanceof ClosedGroupNewMessage ||
        (message as any).syncTarget?.length > 0
      ) {
        window.log.warn('Processing sync message');
      } else {
        window.log.warn('Dropping message in process() to be sent to ourself');
        return;
      }
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

let messageQueue: MessageQueue;

export function getMessageQueue(): MessageQueue {
  if (!messageQueue) {
    messageQueue = new MessageQueue();
  }
  return messageQueue;
}
