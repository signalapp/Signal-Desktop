import { EventEmitter } from 'events';
import {
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
} from './MessageQueueInterface';
import { ContentMessage, OpenGroupMessage } from '../messages/outgoing';
import { PendingMessageCache } from './PendingMessageCache';
import { JobQueue, TypedEventEmitter } from '../utils';

export class MessageQueue implements MessageQueueInterface {
  public readonly events: TypedEventEmitter<MessageQueueInterfaceEvents>;
  private readonly jobQueues: Map<string, JobQueue> = new Map();
  private readonly cache: PendingMessageCache;

  constructor() {
    this.events = new EventEmitter();
    this.cache = new PendingMessageCache();
    this.processAllPending();
  }

  public sendUsingMultiDevice(user: string, message: ContentMessage) {
    throw new Error('Method not implemented.');
  }
  public send(device: string, message: ContentMessage) {
    throw new Error('Method not implemented.');
  }
  public sendToGroup(message: ContentMessage | OpenGroupMessage) {
    throw new Error('Method not implemented.');
  }
  public sendSyncMessage(message: ContentMessage) {
    throw new Error('Method not implemented.');
  }

  public processPending(device: string) {
    // TODO: implement
  }

  private processAllPending() {
    // TODO: Get all devices which are pending here
  }

  private queue(device: string, message: ContentMessage) {
    // TODO: implement
  }

  private queueOpenGroupMessage(message: OpenGroupMessage) {
    // TODO: Do we need to queue open group messages?
    // If so we can get open group job queue and add the send job here
  }

  private getJobQueue(device: string): JobQueue {
    let queue = this.jobQueues.get(device);
    if (!queue) {
      queue = new JobQueue();
      this.jobQueues.set(device, queue);
    }

    return queue;
  }
}
