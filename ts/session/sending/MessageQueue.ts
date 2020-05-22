import { MessageQueueInterface } from './MessageQueueInterface';
import { OutgoingContentMessage, OpenGroupMessage } from '../messages/outgoing';
import { JobQueue } from '../utils/JobQueue';
import { PendingMessageCache } from './PendingMessageCache';

export class MessageQueue implements MessageQueueInterface {
  private readonly jobQueues: Map<string, JobQueue> = new Map();
  private readonly cache: PendingMessageCache;

  constructor() {
    this.cache = new PendingMessageCache();
    this.processAllPending();
  }

  public sendUsingMultiDevice(user: string, message: OutgoingContentMessage) {
    throw new Error('Method not implemented.');
  }
  public send(device: string, message: OutgoingContentMessage) {
    throw new Error('Method not implemented.');
  }
  public sendToGroup(message: OutgoingContentMessage | OpenGroupMessage) {
    throw new Error('Method not implemented.');
  }
  public sendSyncMessage(message: OutgoingContentMessage) {
    throw new Error('Method not implemented.');
  }

  public processPending(device: string) {
    // TODO: implement
  }

  private processAllPending() {
    // TODO: Get all devices which are pending here
  }

  private queue(device: string, message: OutgoingContentMessage) {
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
