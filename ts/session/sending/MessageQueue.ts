import { PendingMessageCache } from './PendingMessageCache';
import { JobQueue, MessageUtils, UserUtils } from '../utils';
import { PubKey, RawMessage } from '../types';
import { MessageSender } from '.';
import { ClosedGroupMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMessage';
import { ConfigurationMessage } from '../messages/outgoing/controlMessage/ConfigurationMessage';
import { ClosedGroupNameChangeMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage';

import { ClosedGroupMemberLeftMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMemberLeftMessage';
import { MessageSentHandler } from './MessageSentHandler';
import { ContentMessage } from '../messages/outgoing';
import { ExpirationTimerUpdateMessage } from '../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { ClosedGroupAddedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage';
import { ClosedGroupEncryptionPairMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage';
import { ClosedGroupEncryptionPairRequestMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairRequestMessage';
import { ClosedGroupNewMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNewMessage';
import { ClosedGroupRemovedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage';
import { ClosedGroupVisibleMessage } from '../messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { SyncMessageType } from '../utils/syncUtils';

import { OpenGroupRequestCommonType } from '../apis/open_group_api/opengroupV2/ApiUtil';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { UnsendMessage } from '../messages/outgoing/controlMessage/UnsendMessage';
import { CallMessage } from '../messages/outgoing/controlMessage/CallMessage';

type ClosedGroupMessageType =
  | ClosedGroupVisibleMessage
  | ClosedGroupAddedMembersMessage
  | ClosedGroupRemovedMembersMessage
  | ClosedGroupNameChangeMessage
  | ClosedGroupMemberLeftMessage
  | ExpirationTimerUpdateMessage
  | ClosedGroupEncryptionPairMessage
  | UnsendMessage
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
    destinationPubKey: PubKey,
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>,
    isGroup = false
  ): Promise<void> {
    if (message instanceof ConfigurationMessage || !!(message as any).syncTarget) {
      throw new Error('SyncMessage needs to be sent with sendSyncMessage');
    }
    await this.process(destinationPubKey, message, sentCb, isGroup);
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
      if (!serverId || serverId === -1) {
        throw new Error(`Invalid serverId returned by server: ${serverId}`);
      }
      void MessageSentHandler.handlePublicMessageSentSuccess(message, {
        serverId: serverId,
        serverTimestamp: sentTimestamp,
      });
    } catch (e) {
      window?.log?.warn(`Failed to send message to open group: ${roomInfos}`, e);
      void MessageSentHandler.handleMessageSentFailure(message, e || error);
    }
  }

  /**
   *
   * @param sentCb currently only called for medium groups sent message
   */
  public async sendToGroup(
    message: ClosedGroupMessageType,
    sentCb?: (message: RawMessage) => Promise<void>,
    groupPubKey?: PubKey
  ): Promise<void> {
    let destinationPubKey: PubKey | undefined = groupPubKey;
    if (message instanceof ExpirationTimerUpdateMessage || message instanceof ClosedGroupMessage) {
      destinationPubKey = groupPubKey ? groupPubKey : message.groupId;
    }

    if (!destinationPubKey) {
      throw new Error('Invalid group message passed in sendToGroup.');
    }

    // if groupId is set here, it means it's for a medium group. So send it as it
    return this.sendToPubKey(PubKey.cast(destinationPubKey), message, sentCb, true);
  }

  public async sendSyncMessage(
    message?: SyncMessageType,
    sentCb?: (message: RawMessage) => Promise<void>
  ): Promise<void> {
    if (!message) {
      return;
    }
    if (
      !(message instanceof ConfigurationMessage) &&
      !(message instanceof UnsendMessage) &&
      !(message as any)?.syncTarget
    ) {
      throw new Error('Invalid message given to sendSyncMessage');
    }

    const ourPubKey = UserUtils.getOurPubKeyStrFromCache();

    await this.process(PubKey.cast(ourPubKey), message, sentCb);
  }

  /**
   * Sends a message that awaits until the message is completed sending
   * @param user user pub key to send to
   * @param message Message to be sent
   */
  public async sendToPubKeyNonDurably(
    user: PubKey,
    message: ClosedGroupNewMessage | CallMessage
  ): Promise<boolean | number> {
    let rawMessage;
    try {
      rawMessage = await MessageUtils.toRawMessage(user, message);
      const { wrappedEnvelope, effectiveTimestamp } = await MessageSender.send(rawMessage);
      await MessageSentHandler.handleMessageSentSuccess(
        rawMessage,
        effectiveTimestamp,
        wrappedEnvelope
      );
      return effectiveTimestamp;
    } catch (error) {
      if (rawMessage) {
        await MessageSentHandler.handleMessageSentFailure(rawMessage, error);
      }
      return false;
    }
  }

  /**
   * processes pending jobs in the message sending queue.
   * @param device - target device to send to
   */
  public async processPending(device: PubKey, isSyncMessage: boolean = false) {
    const messages = await this.pendingMessageCache.getForDevice(device);

    const jobQueue = this.getJobQueue(device);
    messages.forEach(async message => {
      const messageId = message.identifier;

      if (!jobQueue.has(messageId)) {
        // We put the event handling inside this job to avoid sending duplicate events
        const job = async () => {
          try {
            const { wrappedEnvelope, effectiveTimestamp } = await MessageSender.send(
              message,
              undefined,
              undefined,
              isSyncMessage
            );

            await MessageSentHandler.handleMessageSentSuccess(
              message,
              effectiveTimestamp,
              wrappedEnvelope
            );

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
    destinationPk: PubKey,
    message: ContentMessage,
    sentCb?: (message: RawMessage) => Promise<void>,
    isGroup = false
  ): Promise<void> {
    // Don't send to ourselves
    const currentDevice = UserUtils.getOurPubKeyFromCache();
    let isSyncMessage = false;
    if (currentDevice && destinationPk.isEqual(currentDevice)) {
      // We allow a message for ourselve only if it's a ConfigurationMessage, a ClosedGroupNewMessage,
      // or a message with a syncTarget set.

      if (
        message instanceof ConfigurationMessage ||
        message instanceof ClosedGroupNewMessage ||
        message instanceof UnsendMessage ||
        (message as any).syncTarget?.length > 0
      ) {
        window?.log?.warn('Processing sync message');
        isSyncMessage = true;
      } else {
        window?.log?.warn('Dropping message in process() to be sent to ourself');
        return;
      }
    }

    await this.pendingMessageCache.add(destinationPk, message, sentCb, isGroup);
    void this.processPending(destinationPk, isSyncMessage);
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
