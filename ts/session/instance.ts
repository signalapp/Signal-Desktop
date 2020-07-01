import { MessageQueue, MessageQueueInterface } from './sending/';

let messageQueue: MessageQueue;

function getMessageQueue(): MessageQueueInterface {
  if (!messageQueue) {
    messageQueue = new MessageQueue();
  }
  return messageQueue;
}

export { getMessageQueue };
