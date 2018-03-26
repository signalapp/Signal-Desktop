const isFunction = require('lodash/isFunction');
const isNumber = require('lodash/isNumber');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');

const Message = require('./types/message');
const { deferredToPromise } = require('./deferred_to_promise');
const Migrations0DatabaseWithAttachmentData =
  require('./migrations/migrations_0_database_with_attachment_data');

exports.processNext = async ({
  BackboneMessage,
  BackboneMessageCollection,
  count,
  upgradeMessageSchema,
} = {}) => {
  if (!isFunction(BackboneMessage)) {
    throw new TypeError('"BackboneMessage" (Whisper.Message) constructor is required');
  }

  if (!isFunction(BackboneMessageCollection)) {
    throw new TypeError('"BackboneMessageCollection" (Whisper.MessageCollection)' +
      ' constructor is required');
  }

  if (!isNumber(count)) {
    throw new TypeError('"count" is required');
  }

  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError('"upgradeMessageSchema" is required');
  }

  const startTime = Date.now();

  const startFetchTime = Date.now();
  const messagesRequiringSchemaUpgrade =
    await _fetchMessagesRequiringSchemaUpgrade({ BackboneMessageCollection, count });
  const fetchDuration = Date.now() - startFetchTime;

  const startUpgradeTime = Date.now();
  const upgradedMessages =
    await Promise.all(messagesRequiringSchemaUpgrade.map(upgradeMessageSchema));
  const upgradeDuration = Date.now() - startUpgradeTime;

  const startSaveTime = Date.now();
  const saveMessage = _saveMessage({ BackboneMessage });
  await Promise.all(upgradedMessages.map(saveMessage));
  const saveDuration = Date.now() - startSaveTime;

  const totalDuration = Date.now() - startTime;
  const numProcessed = messagesRequiringSchemaUpgrade.length;
  const hasMore = numProcessed > 0;
  return {
    hasMore,
    numProcessed,
    fetchDuration,
    upgradeDuration,
    saveDuration,
    totalDuration,
  };
};

exports.processAll = async ({
  Backbone,
  storage,
  upgradeMessageSchema,
} = {}) => {
  if (!isObject(Backbone)) {
    throw new TypeError('"Backbone" is required');
  }

  if (!isObject(storage)) {
    throw new TypeError('"storage" is required');
  }

  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError('"upgradeMessageSchema" is required');
  }

  const lastIndex = null;
  const unprocessedMessages =
    await _dangerouslyFetchMessagesRequiringSchemaUpgradeWithoutIndex({
      Backbone,
      count: 10,
      lastIndex,
    });
};

const _saveMessage = ({ BackboneMessage } = {}) => (message) => {
  const backboneMessage = new BackboneMessage(message);
  return deferredToPromise(backboneMessage.save());
};

const _fetchMessagesRequiringSchemaUpgrade =
  async ({ BackboneMessageCollection, count } = {}) => {
    if (!isFunction(BackboneMessageCollection)) {
      throw new TypeError('"BackboneMessageCollection" (Whisper.MessageCollection)' +
        ' constructor is required');
    }

    if (!isNumber(count)) {
      throw new TypeError('"count" is required');
    }

    const collection = new BackboneMessageCollection();
    return new Promise(resolve => collection.fetch({
      limit: count,
      index: {
        name: 'schemaVersion',
        upper: Message.CURRENT_SCHEMA_VERSION,
        excludeUpper: true,
        order: 'desc',
      },
    }).always(() => {
      const models = collection.models || [];
      const messages = models.map(model => model.toJSON());
      resolve(messages);
    }));
  };

const MAX_MESSAGE_KEY = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const _dangerouslyFetchMessagesRequiringSchemaUpgradeWithoutIndex =
  async ({ Backbone, count, lastIndex } = {}) => {
    if (!isObject(Backbone)) {
      throw new TypeError('"Backbone" is required');
    }

    if (!isNumber(count)) {
      throw new TypeError('"count" is required');
    }

    if (lastIndex && !isString(lastIndex)) {
      throw new TypeError('"lastIndex" must be a string');
    }

    const storeName = 'messages';
    const collection =
      Migrations0DatabaseWithAttachmentData.createCollection({ Backbone, storeName });

    const range = lastIndex ? [lastIndex, MAX_MESSAGE_KEY] : null;
    await deferredToPromise(collection.fetch({
      limit: count,
      range,
    }));

    const models = collection.models || [];
    const messages = models.map(model => model.toJSON());
    return messages;
  };
