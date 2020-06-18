import { MessageQueue } from './MessageQueue';

let messageQueue: MessageQueue;

function getMessageQueue() {
  if (!messageQueue) {
    messageQueue = new MessageQueue();
  }
  return messageQueue;
}

export { getMessageQueue };
