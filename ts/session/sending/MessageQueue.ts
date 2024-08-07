import { AbortController } from 'abort-controller';

import { MessageSender } from '.';
import { ConfigurationMessage } from '../messages/outgoing/controlMessage/ConfigurationMessage';
import { ClosedGroupMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMessage';
import { ClosedGroupNameChangeMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage';
import { PubKey, RawMessage } from '../types';
import { JobQueue, MessageUtils, UserUtils } from '../utils';
import { PendingMessageCache } from './PendingMessageCache';

import { ContentMessage } from '../messages/outgoing';
import { ExpirationTimerUpdateMessage } from '../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { ClosedGroupAddedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage';
import { ClosedGroupEncryptionPairMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage';
import { ClosedGroupMemberLeftMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMemberLeftMessage';
import { ClosedGroupNewMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNewMessage';
import { ClosedGroupRemovedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage';
import { ClosedGroupVisibleMessage } from '../messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { SyncMessageType } from '../utils/sync/syncUtils';
import { MessageSentHandler } from './MessageSentHandler';

import { OpenGroupMessageV2 } from '../apis/open_group_api/opengroupV2/OpenGroupMessageV2';
import { sendSogsReactionOnionV4 } from '../apis/open_group_api/sogsv3/sogsV3SendReaction';
import {
  SnodeNamespaces,
  SnodeNamespacesGroup,
  SnodeNamespacesUser,
} from '../apis/snode_api/namespaces';
import { CallMessage } from '../messages/outgoing/controlMessage/CallMessage';
import { SharedConfigMessage } from '../messages/outgoing/controlMessage/SharedConfigMessage';
import { UnsendMessage } from '../messages/outgoing/controlMessage/UnsendMessage';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { OpenGroupRequestCommonType } from '../../data/types';

type ClosedGroupMessageType =
  | ClosedGroupVisibleMessage
  | ClosedGroupAddedMembersMessage
  | ClosedGroupRemovedMembersMessage
  | ClosedGroupNameChangeMessage
  | ClosedGroupMemberLeftMessage
  | ExpirationTimerUpdateMessage
  | ClosedGroupEncryptionPairMessage
  | UnsendMessage;

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
    namespace: SnodeNamespaces,
    sentCb?: (message: RawMessage) => Promise<void>,
    isGroup = false
  ): Promise<void> {
    if (message instanceof ConfigurationMessage || !!(message as any).syncTarget) {
      throw new Error('SyncMessage needs to be sent with sendSyncMessage');
    }
    await this.process(destinationPubKey, message, namespace, sentCb, isGroup);
  }

  /**
   * This function is synced. It will wait for the message to be delivered to the open
   * group to return.
   * So there is no need for a sendCb callback
   *
   *
   * fileIds is the array of ids this message is linked to. If we upload files as part of a message but do not link them with this, the files will be deleted much sooner
   */
  public async sendToOpenGroupV2({
    blinded,
    filesToLink,
    message,
    roomInfos,
  }: {
    message: OpenGroupVisibleMessage;
    roomInfos: OpenGroupRequestCommonType;
    blinded: boolean;
    filesToLink: Array<number>;
  }) {
    // Skipping the queue for Open Groups v2; the message is sent directly

    try {
      // NOTE Reactions are handled separately
      if (message.reaction) {
        await sendSogsReactionOnionV4(
          roomInfos.serverUrl,
          roomInfos.roomId,
          new AbortController().signal,
          message.reaction,
          blinded
        );
        return;
      }

      const result = await MessageSender.sendToOpenGroupV2(
        message,
        roomInfos,
        blinded,
        filesToLink
      );

      const { sentTimestamp, serverId } = result as OpenGroupMessageV2;
      if (!serverId || serverId === -1) {
        throw new Error(`Invalid serverId returned by server: ${serverId}`);
      }

      await MessageSentHandler.handlePublicMessageSentSuccess(message.identifier, {
        serverId,
        serverTimestamp: sentTimestamp,
      });
    } catch (e) {
      window?.log?.warn(
        `Failed to send message to open group: ${roomInfos.serverUrl}:${roomInfos.roomId}:`,
        e
      );
      await MessageSentHandler.handleMessageSentFailure(
        message,
        e || new Error('Failed to send message to open group.')
      );
    }
  }

  public async sendToOpenGroupV2BlindedRequest({
    encryptedContent,
    message,
    recipientBlindedId,
    roomInfos,
  }: {
    encryptedContent: Uint8Array;
    roomInfos: OpenGroupRequestCommonType;
    message: OpenGroupVisibleMessage;
    recipientBlindedId: string;
  }) {
    try {
      // TODO we will need to add the support for blinded25 messages requests
      if (!PubKey.isBlinded(recipientBlindedId)) {
        throw new Error('sendToOpenGroupV2BlindedRequest needs a blindedId');
      }
      const { serverTimestamp, serverId } = await MessageSender.sendToOpenGroupV2BlindedRequest(
        encryptedContent,
        roomInfos,
        recipientBlindedId
      );
      if (!serverId || serverId === -1) {
        throw new Error(`Invalid serverId returned by server: ${serverId}`);
      }
      await MessageSentHandler.handlePublicMessageSentSuccess(message.identifier, {
        serverId,
        serverTimestamp,
      });
    } catch (e) {
      window?.log?.warn(
        `Failed to send message to open group: ${roomInfos.serverUrl}:${roomInfos.roomId}:`,
        e.message
      );
      await MessageSentHandler.handleMessageSentFailure(
        message,
        e || new Error('Failed to send message to open group.')
      );
    }
  }

  /**
   *
   * @param sentCb currently only called for medium groups sent message
   */
  public async sendToGroup({
    message,
    namespace,
    groupPubKey,
    sentCb,
  }: {
    message: ClosedGroupMessageType;
    namespace: SnodeNamespacesGroup;
    sentCb?: (message: RawMessage) => Promise<void>;
    groupPubKey?: PubKey;
  }): Promise<void> {
    let destinationPubKey: PubKey | undefined = groupPubKey;
    if (message instanceof ExpirationTimerUpdateMessage || message instanceof ClosedGroupMessage) {
      destinationPubKey = groupPubKey || message.groupId;
    }

    if (!destinationPubKey) {
      throw new Error('Invalid group message passed in sendToGroup.');
    }

    // if groupId is set here, it means it's for a medium group. So send it as it
    return this.sendToPubKey(PubKey.cast(destinationPubKey), message, namespace, sentCb, true);
  }

  public async sendSyncMessage({
    namespace,
    message,
    sentCb,
  }: {
    namespace: SnodeNamespacesUser;
    message?: SyncMessageType;
    sentCb?: (message: RawMessage) => Promise<void>;
  }): Promise<void> {
    if (!message) {
      return;
    }
    if (
      !(message instanceof ConfigurationMessage) &&
      !(message instanceof UnsendMessage) &&
      !(message instanceof SharedConfigMessage) &&
      !(message as any)?.syncTarget
    ) {
      throw new Error('Invalid message given to sendSyncMessage');
    }

    const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
    await this.process(PubKey.cast(ourPubKey), message, namespace, sentCb);
  }

  /**
   * Sends a message that awaits until the message is completed sending
   * @param user user pub key to send to
   * @param message Message to be sent
   */
  public async sendToPubKeyNonDurably({
    namespace,
    message,
    pubkey,
  }: {
    pubkey: PubKey;
    message:
      | ClosedGroupNewMessage
      | CallMessage
      | SharedConfigMessage
      | ClosedGroupMemberLeftMessage;
    namespace: SnodeNamespaces;
  }): Promise<boolean | number> {
    let rawMessage;
    try {
      rawMessage = await MessageUtils.toRawMessage(pubkey, message, namespace);
      const { wrappedEnvelope, effectiveTimestamp } = await MessageSender.send({
        message: rawMessage,
        isSyncMessage: false,
      });
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
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    messages.forEach(async message => {
      const messageId = message.identifier;

      if (!jobQueue.has(messageId)) {
        // We put the event handling inside this job to avoid sending duplicate events
        const job = async () => {
          try {
            const { wrappedEnvelope, effectiveTimestamp } = await MessageSender.send({
              message,
              isSyncMessage,
            });

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
    namespace: SnodeNamespaces,
    sentCb?: (message: RawMessage) => Promise<void>,
    isGroup = false
  ): Promise<void> {
    // Don't send to ourselves
    const us = UserUtils.getOurPubKeyFromCache();
    let isSyncMessage = false;
    if (us && destinationPk.isEqual(us)) {
      // We allow a message for ourselves only if it's a ConfigurationMessage, a ClosedGroupNewMessage,
      // or a message with a syncTarget set.

      if (MessageSender.isContentSyncMessage(message)) {
        window?.log?.info('OutgoingMessageQueue: Processing sync message');
        isSyncMessage = true;
      } else {
        window?.log?.warn('Dropping message in process() to be sent to ourself');
        return;
      }
    }

    await this.pendingMessageCache.add(destinationPk, message, namespace, sentCb, isGroup);
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
