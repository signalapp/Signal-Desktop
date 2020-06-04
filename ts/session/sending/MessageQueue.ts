import * as Data from '../../../js/modules/data';
import { EventEmitter } from 'events';
import {
  MessageQueueInterface,
  MessageQueueInterfaceEvents,
} from './MessageQueueInterface';
import {
<<<<<<< HEAD
  ContentMessage,
  OpenGroupMessage,
  SessionResetMessage,
=======
  ContentMessage as OutgoingContentMessage,
  OpenGroupMessage,
>>>>>>> 935ac8d8f911616731c20aa5b45b79bea6895731
} from '../messages/outgoing';
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

  public async sendUsingMultiDevice(user: string, message: ContentMessage) {
    // throw new Error('Method not implemented.');

    // Update from TS Globals
    const pairedDevices = await Data.getPairedDevicesFor(user);
    const userDevices = [...pairedDevices, user];

    console.log('[vince] userDevices:', userDevices);
  }

  public send(device: string, message: ContentMessage) {
    // throw new Error('Method not implemented.');

    // Validation; early exists?

    // TESTING
    console.log(`[vince] send: Queueing message`, message);
    this.queue(device, message);
  }

  public sendToGroup(message: ContentMessage | OpenGroupMessage) {
    throw new Error('Method not implemented.');

    // If you see an open group message just call
    // MessageSender.sendToOpenGroup directly.
  }

  public sendSyncMessage(message: ContentMessage) {
    // PSEDUOCODE
    // if message is undefined
    //   returnt
    // for each of our device excluding current device:
    //     queue(device, syncMessage)
    // throw new Error('Method not implemented.');
  }

  public async processPending(device: string) {
    // TODO: implement
    // PSEDUDOCODE
    // messages = PendingMessageCache.getPendingMessages(device)
    // isMediumGroup = device is medium group
    // hasSession = SessionManager.hasSession(device)
    // if !isMediumGroup && !hasSession
    //     SessionManager.sendSessionRequestIfNeeded()
    //     return // Don't process any more messages
    // jobQueue = getJobQueue(device)
    // for each message:
    //     if !jobQueue.has(message.uuid)
    //         promise = jobQueue.queue(message.uuid, MessageSender.send(message))
    //         promise.then().catch() // Add or remove from pending message cache on success and failure
    // Promise shouldn't be returned; we're firing an event when processed.
  }

  private processAllPending() {
    // TODO: Get all devices which are pending here
  }

  private queue(device: string, message: ContentMessage) {
    // This should simply add to the queue. No processing

    // TODO: implement
    // PSEUDOCODE

    // if message is Session Request
    //   SessionManager.sendSessionRequest(device, message)
    // return

    // PendingMessageCache.addPendingMessage(device, message)
    // processPending(device)

    if (message instanceof SessionResetMessage) {
      return;
    }

    console.log(`[vince] queue: Message added to the queue`, message);

    // Add the item to the queue
    const queue = this.getJobQueue(device);
    const job = new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, 3000);
    });

    // tslint:disable-next-line: no-floating-promises
    queue.add(async () => job);

    // Saving offline and stuff

    // Attach to event
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
