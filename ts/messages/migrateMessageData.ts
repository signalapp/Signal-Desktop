// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFunction, isNumber } from 'lodash';
import { CURRENT_SCHEMA_VERSION } from '../types/Message2';
import type { MessageAttributesType } from '../model-types.d';
import type { UUIDStringType } from '../types/UUID';

/**
 * Ensures that messages in database are at the right schema.
 */
export async function migrateMessageData({
  numMessagesPerBatch,
  upgradeMessageSchema,
  getMessagesNeedingUpgrade,
  saveMessage,
  maxVersion = CURRENT_SCHEMA_VERSION,
}: Readonly<{
  numMessagesPerBatch: number;
  upgradeMessageSchema: (
    message: MessageAttributesType,
    options: { maxVersion: number }
  ) => Promise<MessageAttributesType>;
  getMessagesNeedingUpgrade: (
    limit: number,
    options: { maxVersion: number }
  ) => Promise<Array<MessageAttributesType>>;
  saveMessage: (
    data: MessageAttributesType,
    options: { ourUuid: UUIDStringType }
  ) => Promise<string>;
  maxVersion?: number;
}>): Promise<
  | {
      done: true;
      numProcessed: 0;
    }
  | {
      done: boolean;
      numProcessed: number;
      fetchDuration: number;
      upgradeDuration: number;
      saveDuration: number;
      totalDuration: number;
    }
> {
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
      { maxVersion }
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
}
