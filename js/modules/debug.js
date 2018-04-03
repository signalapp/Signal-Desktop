/* eslint-env node */

const fs = require('fs-extra');
const path = require('path');

const {
  isFunction,
  isNumber,
  isObject,
  isString,
  random,
  range,
  sample,
} = require('lodash');

const Attachments = require('../../app/attachments');
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
    const messageAttributes = await createRandomMessage({ conversationId });
    const message = new WhisperMessage(messageAttributes);
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
const createRandomMessage = async ({ conversationId } = {}) => {
  if (!isString(conversationId)) {
    throw new TypeError('"conversationId" must be a string');
  }

  const sentAt = Date.now() - random(100 * 24 * 60 * 60 * 1000);
  const receivedAt = sentAt + random(30 * 1000);

  const hasAttachment = Math.random() <= ATTACHMENT_SAMPLE_RATE;
  const attachments = hasAttachment
    ? [await createRandomInMemoryAttachment()] : [];
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

const FIXTURES_PATH = path.join(__dirname, '..', '..', 'fixtures');
const readData = Attachments.createReader(FIXTURES_PATH);
const createRandomInMemoryAttachment = async () => {
  const files = (await fs.readdir(FIXTURES_PATH)).map(createFileEntry);
  const { contentType, fileName } = sample(files);
  const data = await readData(fileName);

  return {
    contentType,
    data,
    fileName,
    size: data.byteLength,
  };
};

const createFileEntry = fileName => ({
  fileName,
  contentType: fileNameToContentType(fileName),
});
const fileNameToContentType = (fileName) => {
  const fileExtension = path.extname(fileName).toLowerCase();
  switch (fileExtension) {
    case '.gif':
      return 'image/gif';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.mp4':
      return 'video/mp4';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
};
