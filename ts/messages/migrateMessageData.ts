// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isFunction, isNumber } from 'lodash';
import pMap from 'p-map';

import { CURRENT_SCHEMA_VERSION } from '../types/Message2';
import { isNotNil } from '../util/isNotNil';
import type { MessageAttributesType } from '../model-types.d';
import type { AciString } from '../types/ServiceId';
import * as Errors from '../types/errors';

const MAX_CONCURRENCY = 5;

/**
 * Ensures that messages in database are at the right schema.
 */
export async function migrateMessageData({
  numMessagesPerBatch,
  upgradeMessageSchema,
  getMessagesNeedingUpgrade,
  saveMessages,
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
  saveMessages: (
    data: ReadonlyArray<MessageAttributesType>,
    options: { ourAci: AciString }
  ) => Promise<unknown>;
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
      'migrateMessageData.getMessagesNeedingUpgrade error:',
      Errors.toLogFormat(error)
    );
    return {
      done: true,
      numProcessed: 0,
    };
  }
  const fetchDuration = Date.now() - fetchStartTime;

  const upgradeStartTime = Date.now();
  const failedMessages = new Array<MessageAttributesType>();
  const upgradedMessages = (
    await pMap(
      messagesRequiringSchemaUpgrade,
      async message => {
        try {
          return await upgradeMessageSchema(message, { maxVersion });
        } catch (error) {
          window.SignalContext.log.error(
            'migrateMessageData.upgradeMessageSchema error:',
            Errors.toLogFormat(error)
          );
          failedMessages.push(message);
          return undefined;
        }
      },
      { concurrency: MAX_CONCURRENCY }
    )
  ).filter(isNotNil);
  const upgradeDuration = Date.now() - upgradeStartTime;

  const saveStartTime = Date.now();

  const ourAci = window.textsecure.storage.user.getCheckedAci();
  await saveMessages(
    [
      ...upgradedMessages,

      // Increment migration attempts
      ...failedMessages.map(message => ({
        ...message,
        schemaMigrationAttempts: (message.schemaMigrationAttempts ?? 0) + 1,
      })),
    ],
    { ourAci }
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
