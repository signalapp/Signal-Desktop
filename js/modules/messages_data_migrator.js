// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Ensures that messages in database are at the right schema.

/* global window */

const { isFunction, isNumber } = require('lodash');

const Message = require('./types/message');

exports.processNext = async ({
  BackboneMessageCollection,
  numMessagesPerBatch,
  upgradeMessageSchema,
  getMessagesNeedingUpgrade,
  saveMessage,
  maxVersion = Message.CURRENT_SCHEMA_VERSION,
} = {}) => {
  if (!isFunction(BackboneMessageCollection)) {
    throw new TypeError(
      "'BackboneMessageCollection' (Whisper.MessageCollection)" +
        ' constructor is required'
    );
  }

  if (!isNumber(numMessagesPerBatch)) {
    throw new TypeError("'numMessagesPerBatch' is required");
  }

  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError("'upgradeMessageSchema' is required");
  }

  const startTime = Date.now();

  const fetchStartTime = Date.now();
  let messagesRequiringSchemaUpgrade;
  try {
    messagesRequiringSchemaUpgrade = await getMessagesNeedingUpgrade(
      numMessagesPerBatch,
      {
        maxVersion,
        MessageCollection: BackboneMessageCollection,
      }
    );
  } catch (error) {
    window.SignalContext.log.error(
      'processNext error:',
      error && error.stack ? error.stack : error
    );
    return {
      done: true,
      numProcessed: 0,
    };
  }
  const fetchDuration = Date.now() - fetchStartTime;

  const upgradeStartTime = Date.now();
  const upgradedMessages = await Promise.all(
    messagesRequiringSchemaUpgrade.map(message =>
      upgradeMessageSchema(message, { maxVersion })
    )
  );
  const upgradeDuration = Date.now() - upgradeStartTime;

  const saveStartTime = Date.now();
  await Promise.all(
    upgradedMessages.map(message =>
      saveMessage(message, {
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      })
    )
  );
  const saveDuration = Date.now() - saveStartTime;

  const totalDuration = Date.now() - startTime;
  const numProcessed = messagesRequiringSchemaUpgrade.length;
  const done = numProcessed < numMessagesPerBatch;
  return {
    done,
    numProcessed,
    fetchDuration,
    upgradeDuration,
    saveDuration,
    totalDuration,
  };
};
