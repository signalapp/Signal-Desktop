const isNumber = require('lodash/isNumber');
const isFunction = require('lodash/isFunction');

const Message = require('./types/message');
const { deferredToPromise } = require('./deferred_to_promise');


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
