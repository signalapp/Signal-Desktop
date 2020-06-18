import { MessageQueue } from './sending/';

let messageQueue: MessageQueue;

function getMessageQueue() {
  if (!messageQueue) {
    messageQueue = new MessageQueue();
  }
  return messageQueue;
}

export { getMessageQueue };
