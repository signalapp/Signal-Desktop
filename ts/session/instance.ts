import { MessageQueue } from './sending/';

let messageQueue: MessageQueue;

function getMessageQueue(): MessageQueue {
  if (!messageQueue) {
    messageQueue = new MessageQueue();
  }
  return messageQueue;
}

export { getMessageQueue };
