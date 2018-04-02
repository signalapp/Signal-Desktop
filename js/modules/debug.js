const {
  isFunction,
  isNumber,
  isObject,
  isString,
  random,
  range,
  sample,
} = require('lodash');

const Message = require('./types/message');
const { deferredToPromise } = require('./deferred_to_promise');
const { sleep } = require('./sleep');


// See: https://en.wikipedia.org/wiki/Fictitious_telephone_number#North_American_Numbering_Plan
const SENDER_ID = '+12126647665';

exports.createConversation = async ({
  ConversationController,
  numMessages,
  WhisperMessage,
} = {}) => {
  if (!isObject(ConversationController) ||
      !isFunction(ConversationController.getOrCreateAndWait)) {
    throw new TypeError('"ConversationController" is required');
  }

  if (!isNumber(numMessages) || numMessages <= 0) {
    throw new TypeError('"numMessages" must be a positive number');
  }

  if (!isFunction(WhisperMessage)) {
    throw new TypeError('"WhisperMessage" is required');
  }

  const conversation =
    await ConversationController.getOrCreateAndWait(SENDER_ID, 'private');
  conversation.set({
    active_at: Date.now(),
    unread: numMessages,
  });
  await deferredToPromise(conversation.save());

  const conversationId = conversation.get('id');

  await Promise.all(range(0, numMessages).map(async (index) => {
    await sleep(index * 100);
    console.log(`Create message ${index + 1}`);
    const message = new WhisperMessage(createRandomMessage({ conversationId }));
    return deferredToPromise(message.save());
  }));
};

const SAMPLE_MESSAGES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Integer et rutrum leo, eu ultrices ligula.',
  'Nam vel aliquam quam.',
  'Suspendisse posuere nunc vitae pulvinar lobortis.',
  'Nunc et sapien ex.',
  'Duis nec neque eu arcu ultrices ullamcorper in et mauris.',
  'Praesent mi felis, hendrerit a nulla id, mattis consectetur est.',
  'Duis venenatis posuere est sit amet congue.',
  'Vestibulum vitae sapien ultricies, auctor purus vitae, laoreet lacus.',
  'Fusce laoreet nisi dui, a bibendum metus consequat in.',
  'Nulla sed iaculis odio, sed lobortis lacus.',
  'Etiam massa felis, gravida at nibh viverra, tincidunt convallis justo.',
  'Maecenas ut egestas urna.',
  'Pellentesque consectetur mattis imperdiet.',
  'Maecenas pulvinar efficitur justo a cursus.',
];

const ATTACHMENT_SAMPLE_RATE = 0.33;
const createRandomMessage = ({ conversationId } = {}) => {
  if (!isString(conversationId)) {
    throw new TypeError('"conversationId" must be a string');
  }

  const sentAt = Date.now() - random(100 * 24 * 60 * 60 * 1000);
  const receivedAt = sentAt + random(30 * 1000);

  const hasAttachment = Math.random() <= ATTACHMENT_SAMPLE_RATE;
  const attachments = hasAttachment
    ? [createRandomInMemoryAttachment()] : [];
  const type = sample(['incoming', 'outgoing']);
  const commonProperties = {
    attachments,
    body: sample(SAMPLE_MESSAGES),
    conversationId,
    received_at: receivedAt,
    sent_at: sentAt,
    timestamp: receivedAt,
    type,
  };

  const message = _createMessage({ commonProperties, conversationId, type });
  return Message.initializeSchemaVersion(message);
};

const _createMessage = ({ commonProperties, conversationId, type } = {}) => {
  switch (type) {
    case 'incoming':
      return Object.assign({}, commonProperties, {
        flags: 0,
        source: conversationId,
        sourceDevice: 1,
      });
    case 'outgoing':
      return Object.assign({}, commonProperties, {
        delivered: 1,
        delivered_to: [conversationId],
        expireTimer: 0,
        recipients: [conversationId],
        sent_to: [conversationId],
        synced: true,
      });
    default:
      throw new TypeError(`Unknown message type: '${type}'`);
  }
};

const MEGA_BYTE = 1e6;
const createRandomInMemoryAttachment = () => {
  const numBytes = (1 + Math.ceil((Math.random() * 50))) * MEGA_BYTE;
  const array = new Uint32Array(numBytes).fill(1);
  const data = array.buffer;
  const fileName = Math.random().toString().slice(2);

  return {
    contentType: 'application/octet-stream',
    data,
    fileName,
    size: numBytes,
  };
};
