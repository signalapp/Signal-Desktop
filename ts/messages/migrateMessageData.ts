// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import pMap from 'p-map';
import PQueue from 'p-queue';

import { CURRENT_SCHEMA_VERSION } from '../types/Message2.preload.js';
import { isNotNil } from '../util/isNotNil.std.js';
import { MINUTE } from '../util/durations/index.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { AciString } from '../types/ServiceId.std.js';
import * as Errors from '../types/errors.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { postSaveUpdates } from '../util/cleanup.preload.js';
import { upgradeMessageSchema as doUpgradeMessageSchema } from '../util/migrations.preload.js';
import { createLogger } from '../logging/log.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { isFunction, isNumber } = lodash;

const log = createLogger('migrateMessageData');

const MAX_CONCURRENCY = 5;

// Don't migrate batches concurrently
const migrationQueue = new PQueue({
  concurrency: 1,
  timeout: MINUTE * 30,
});

type BatchResultType = Readonly<{
  done: boolean;
  numProcessed: number;
  numSucceeded?: number;
  numFailedSave?: number;
  numFailedUpgrade?: number;
  fetchDuration?: number;
  upgradeDuration?: number;
  saveDuration?: number;
  totalDuration?: number;
}>;

/**
 * Ensures that messages in database are at the right schema.
 *
 * @internal
 */
export async function _migrateMessageData({
  numMessagesPerBatch,
  upgradeMessageSchema,
  getMessagesNeedingUpgrade,
  saveMessagesIndividually,
  incrementMessagesMigrationAttempts,
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
  saveMessagesIndividually: (
    data: ReadonlyArray<MessageAttributesType>,
    options: { ourAci: AciString; postSaveUpdates: () => Promise<void> }
  ) => Promise<{ failedIndices: Array<number> }>;
  incrementMessagesMigrationAttempts: (
    messageIds: ReadonlyArray<string>
  ) => Promise<void>;
  maxVersion?: number;
}>): Promise<BatchResultType> {
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
    log.error('getMessagesNeedingUpgrade error:', Errors.toLogFormat(error));
    return {
      done: true,
      numProcessed: 0,
    };
  }
  const fetchDuration = Date.now() - fetchStartTime;

  const upgradeStartTime = Date.now();
  const failedToUpgradeMessageIds = new Array<string>();
  const upgradedMessages = (
    await pMap(
      messagesRequiringSchemaUpgrade,
      async message => {
        try {
          return await upgradeMessageSchema(message, { maxVersion });
        } catch (error) {
          log.error('upgradeMessageSchema error:', Errors.toLogFormat(error));
          failedToUpgradeMessageIds.push(message.id);
          return undefined;
        }
      },
      { concurrency: MAX_CONCURRENCY }
    )
  ).filter(isNotNil);
  const upgradeDuration = Date.now() - upgradeStartTime;

  const saveStartTime = Date.now();

  const ourAci = itemStorage.user.getCheckedAci();
  const { failedIndices: failedToSaveIndices } = await saveMessagesIndividually(
    upgradedMessages,
    {
      ourAci,
      postSaveUpdates,
    }
  );

  const failedToSaveMessageIds = failedToSaveIndices.map(
    idx => upgradedMessages[idx].id
  );

  if (failedToUpgradeMessageIds.length || failedToSaveMessageIds.length) {
    await incrementMessagesMigrationAttempts([
      ...failedToUpgradeMessageIds,
      ...failedToSaveMessageIds,
    ]);
  }
  const saveDuration = Date.now() - saveStartTime;

  const totalDuration = Date.now() - startTime;
  const numProcessed = messagesRequiringSchemaUpgrade.length;
  const numFailedUpgrade = failedToUpgradeMessageIds.length;
  const numFailedSave = failedToSaveIndices.length;
  const numSucceeded = numProcessed - numFailedSave - numFailedUpgrade;
  const done = numProcessed < numMessagesPerBatch;
  return {
    done,
    numProcessed,
    numSucceeded,
    numFailedUpgrade,
    numFailedSave,
    fetchDuration,
    upgradeDuration,
    saveDuration,
    totalDuration,
  };
}

export async function migrateBatchOfMessages({
  numMessagesPerBatch,
}: {
  numMessagesPerBatch: number;
}): ReturnType<typeof _migrateMessageData> {
  return migrationQueue.add(() =>
    _migrateMessageData({
      numMessagesPerBatch,
      upgradeMessageSchema: doUpgradeMessageSchema,
      getMessagesNeedingUpgrade: DataReader.getMessagesNeedingUpgrade,
      saveMessagesIndividually: DataWriter.saveMessagesIndividually,
      incrementMessagesMigrationAttempts:
        DataWriter.incrementMessagesMigrationAttempts,
    })
  );
}

export async function migrateAllMessages(): Promise<void> {
  let batch: BatchResultType | undefined;
  let total = 0;
  while (!batch?.done) {
    // eslint-disable-next-line no-await-in-loop
    batch = await migrateBatchOfMessages({
      numMessagesPerBatch: 1000,
    });
    total += batch.numProcessed;
    log.info(`migrateAllMessages: Migrated batch of ${batch.numProcessed}`);
  }
  log.info(
    `migrateAllMessages: message migration complete; ${total} messages migrated`
  );
}
