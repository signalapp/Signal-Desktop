import { EventEmitter } from 'events';
import {
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
} from './MessageQueueInterface';
import { ContentMessage, OpenGroupMessage, SyncMessage, SessionResetMessage } from '../messages/outgoing';
import { PendingMessageCache } from './PendingMessageCache';
import { JobQueue, TypedEventEmitter } from '../utils';
import { PubKey } from '../types';
import { ConversationController } from '../../window';
import { MessageSender } from '.';

export class MessageQueue implements MessageQueueInterface {
  public readonly events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  private readonly jobQueues: Map<PubKey, JobQueue> = new Map();
  private readonly cache: PendingMessageCache;

  constructor() {
    this.events = new EventEmitter();
    this.cache = new PendingMessageCache();
    this.processAllPending();
  }

  public sendUsingMultiDevice(user: string, message: ContentMessage) {
    // this.cache
    
    // throw new Error('Method not implemented.');
  }
  public send(device: PubKey, message: ContentMessage) {
    throw new Error('Method not implemented.');
  }
  public sendToGroup(message: ContentMessage | OpenGroupMessage) {
    throw new Error('Method not implemented.');
  }
  public sendSyncMessage(message: ContentMessage) {
    throw new Error('Method not implemented.');
  }

  public processPending(device: PubKey) {
    // TODO: implement
    const SessionManager: any = {}; // TEMP FIX

    const messages = this.cache.getForDevice(device);

    const conversation = ConversationController.get(device.key);
    const isMediumGroup = conversation.isMediumGroup();

    const hasSession = false; // TODO ; = SessionManager.hasSession(device);

    if (!isMediumGroup && !hasSession) {
      SessionManager.sendSessionRequestIfNeeded();

      return;
    }

    const jobQueue = this.getJobQueue(device);
    messages.forEach(message => {
      if (!jobQueue.has(message.identifier)) {
        const promise = jobQueue.add(message.identifier, MessageSender.send(message));

        promise.then(() => {
          // Message sent; remove from cache
          void this.cache.remove(message);
        }).catch(() => {
          // Message failed to send
        });
      }
    });
    


  }

  private processAllPending() {
    // TODO: Get all devices which are pending here
    
  }

  private queue(device: PubKey, message: ContentMessage) {
    // TODO: implement
    if (message instanceof SessionResetMessage) {
      return;
    }

    const added = this.cache.add(device, message);
    
    // if not added?

    this.processPending(device);
  }

  private queueOpenGroupMessage(message: OpenGroupMessage) {
    // TODO: Do we need to queue open group messages?
    // If so we can get open group job queue and add the send job here
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
