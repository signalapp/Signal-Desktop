// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { omit } from 'lodash';
import { v7 as generateUuid } from 'uuid';

import type PQueue from 'p-queue';

import { DAY, MINUTE, SECOND } from '../util/durations/constants.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { fromBase64, toBase64, toHex } from '../Bytes.std.ts';
import { parseUnknown } from '../util/schemas.std.ts';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff.std.ts';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue.preload.ts';
import { InMemoryQueues } from './helpers/InMemoryQueues.std.ts';
import { JobQueue } from './JobQueue.std.ts';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import {
  migrateSVR2,
  setupRegistrationLock,
  storeWithSVR2,
} from '../textsecure/WebAPI.preload.ts';
import { normalizePin } from '../util/normalizePin.std.ts';

import type { Job } from './Job.std.ts';
import type { ParsedJob } from './types.std.ts';
import type { JOB_STATUS } from './JobQueue.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import { resetWithNewKey as resetStorageServiceWithNewKey } from '../services/storage.preload.ts';
import { getConversation } from '../util/getConversation.preload.ts';
import { writeProfile } from '../services/writeProfile.preload.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import {
  AccountEntropyPool,
  SvrKey,
} from '@signalapp/libsignal-client/dist/AccountKeys';

const MAX_RETRY_TIME = 7 * DAY;
const BACKOFF_OPTIONS = {
  maxBackoffTime: 45 * MINUTE,
  multiplier: 2.5,
  firstBackoffs: [0, 20 * SECOND],
};
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(
  MAX_RETRY_TIME,
  BACKOFF_OPTIONS
);

// Note: generally, we only want to add to this list. If you do need to change one of
//   these values, you'll likely need to write a database migration.
const registrationQueueJobEnum = z.enum([
  'MigrateSVR',
  'StoreSVR',
  'UpdateToNewMasterKey',
  'UploadProfile',
]);
type RegistrationQueueJobEnum = z.infer<typeof registrationQueueJobEnum>;

export type RegistrationQueueJobState = {
  [registrationQueueJobEnum.enum.MigrateSVR]?: Record<
    string,
    {
      id: string;
      timestamp: number;
      sessionData: string;
    }
  >;
  [registrationQueueJobEnum.enum.StoreSVR]?: Record<
    string,
    {
      id: string;
      timestamp: number;
      sessionData: string;
    }
  >;
  [registrationQueueJobEnum.enum.UpdateToNewMasterKey]?: undefined;
  [registrationQueueJobEnum.enum.UploadProfile]?: undefined;
};

const migrateSVRJobDataSchema = z.object({
  type: z.literal(registrationQueueJobEnum.enum.MigrateSVR),
  id: z.string(),
  reason: z.string(),
});
export type MigrateSVRJobData = z.infer<typeof migrateSVRJobDataSchema>;

const storeSVRJobDataSchema = z.object({
  type: z.literal(registrationQueueJobEnum.enum.StoreSVR),
  id: z.string(),
  reason: z.string(),
});
export type StoreSVRJobData = z.infer<typeof storeSVRJobDataSchema>;

const updateToNewMasterKeyJobDataSchema = z.object({
  type: z.literal(registrationQueueJobEnum.enum.UpdateToNewMasterKey),
  id: z.string(),
  reason: z.string(),
  reglock: z.boolean(),
});
export type UpdateToNewMasterKeyJobData = z.infer<
  typeof updateToNewMasterKeyJobDataSchema
>;

const uploadProfileJobDataSchema = z.object({
  type: z.literal(registrationQueueJobEnum.enum.UploadProfile),
  id: z.string(),
  reason: z.string(),
  firstName: z.string(),
  familyName: z.string().optional(),
  avatarDataBase64: z.string().optional(),
});
export type UploadProfileJobData = z.infer<typeof uploadProfileJobDataSchema>;

export const registrationQueueJobDataSchema = z.discriminatedUnion('type', [
  migrateSVRJobDataSchema,
  storeSVRJobDataSchema,
  updateToNewMasterKeyJobDataSchema,
  uploadProfileJobDataSchema,
]);
export type RegistrationQueueJobData = z.infer<
  typeof registrationQueueJobDataSchema
>;

export type RegistrationQueueJobBundle = {
  isFinalAttempt: boolean;
  log: LoggerType;
  timeRemaining: number;
  timestamp: number;
};

function getJobState<T extends RegistrationQueueJobEnum>(
  type: T
): RegistrationQueueJobState[T] | undefined {
  const overallState = itemStorage.get('registrationJobQueueState');
  return overallState?.[type];
}
async function putJobState<T extends RegistrationQueueJobEnum>(
  type: T,
  state: RegistrationQueueJobState[T]
): Promise<void> {
  const overallState = itemStorage.get('registrationJobQueueState');
  const newState = { ...overallState, [type]: state };
  await itemStorage.put('registrationJobQueueState', newState);
}

class RegistrationJobQueue extends JobQueue<RegistrationQueueJobData> {
  readonly #inMemoryQueues = new InMemoryQueues();

  public override async add(
    data: Readonly<RegistrationQueueJobData>,
    insert?: (job: ParsedJob<RegistrationQueueJobData>) => Promise<void>
  ): Promise<Job<RegistrationQueueJobData>> {
    return super.add(data, insert);
  }

  protected override parseData(data: unknown): RegistrationQueueJobData {
    return parseUnknown(registrationQueueJobDataSchema, data);
  }

  protected override getQueues(): ReadonlySet<PQueue> {
    return this.#inMemoryQueues.allQueues;
  }
  protected override getInMemoryQueue(
    parsedJob: ParsedJob<RegistrationQueueJobData>
  ): PQueue {
    return this.#inMemoryQueues.get(parsedJob.data.type);
  }

  protected override async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: RegistrationQueueJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const { type } = data;
    const isFinalAttempt = attempt >= MAX_ATTEMPTS;

    await window.ConversationController.load();

    log.info('Calculating timeRemaining and shouldContinue...');
    const timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();
    const shouldContinue = await commonShouldJobContinue({
      attempt,
      backoffOptions: BACKOFF_OPTIONS,
      log,
      skipWait: false,
      timeRemaining,
    });
    if (!shouldContinue) {
      log.info(`shouldContinue=false, cancelling job type ${type}...`);
      return undefined;
    }

    const bundle: RegistrationQueueJobBundle = {
      isFinalAttempt,
      log,
      timeRemaining,
      timestamp,
    };
    // Note: A two-letter variable makes below code autoformatting easier to read.
    const go = registrationQueueJobEnum.enum;

    log.info(`Starting job type ${type}...`);
    try {
      switch (type) {
        case go.MigrateSVR: {
          await migrateSVR(data, bundle);
          break;
        }
        case go.StoreSVR: {
          await storeSVR(data, bundle);
          break;
        }
        case go.UpdateToNewMasterKey: {
          await updateToNewMasterKey(data, bundle);
          break;
        }
        case go.UploadProfile: {
          await uploadProfile(data, bundle);
          break;
        }
        default: {
          // Note: This should never happen, because the zod call in parseData wouldn't
          //   accept data that doesn't look like our type specification.
          const problem: never = type;
          log.error(`Cannot run unknown type ${problem}; Canceling job.`);
        }
      }

      return undefined;
    } catch (error: unknown) {
      log.error(`Failed running job type ${type}:`, toLogFormat(error));
      throw error;
    }
  }
}

async function migrateSVR(
  data: MigrateSVRJobData,
  bundle: RegistrationQueueJobBundle
): Promise<void> {
  const { id, reason } = data;
  const { log, timestamp, isFinalAttempt } = bundle;
  const type = registrationQueueJobEnum.enum.MigrateSVR;
  const logId = `${type}/${id}`;

  const svrPin = itemStorage.get('svrPin');
  const masterKey = itemStorage.get('masterKey');
  const areWePrimary = window.ConversationController.areWePrimaryDevice();

  if (!areWePrimary) {
    log.info(`${logId}: We are not primary device; returning early`);
    return;
  }

  if (!svrPin || !masterKey) {
    log.info(`${logId}: Missing data to do migration!`);
    return;
  }

  const startingJobState = getJobState(type) || {};
  const startingOurJobState = startingJobState[id];
  const sessionData = startingOurJobState?.sessionData
    ? fromBase64(startingOurJobState.sessionData)
    : undefined;

  log.info(
    `${logId}: Starting migration. reason='${reason}', previousSession=${Boolean(sessionData)}`
  );
  const result = await migrateSVR2({
    pin: normalizePin(svrPin),
    data: fromBase64(masterKey),
    sessionData,
  });

  if (result.success) {
    await putJobState(type, omit(startingJobState, id));
    log.info(`${logId}: Migration succeeded!`);
    return;
  }

  if (isFinalAttempt) {
    await putJobState(type, omit(startingJobState, id));
    throw new Error(
      `${logId}: Failed to migrate, and this was our final attempt. Cleared state.`
    );
  }

  const updatedSession = result.sessionData;
  if (!updatedSession) {
    throw new Error(`${logId}: Failed to migrate, and no session returned!`);
  }

  const freshJobState = getJobState(type) || {};
  const newJobState = {
    ...freshJobState,
    [id]: {
      id,
      timestamp,
      sessionData: toBase64(updatedSession),
    },
  };
  await putJobState(type, newJobState);
  throw new Error(`${logId}: Failed to migrate, saved session for next try`);
}

async function storeSVR(
  data: StoreSVRJobData,
  bundle: RegistrationQueueJobBundle
): Promise<void> {
  const { id, reason } = data;
  const { log, timestamp, isFinalAttempt } = bundle;
  const type = registrationQueueJobEnum.enum.StoreSVR;
  const logId = `${type}/${id}`;

  const svrPin = itemStorage.get('svrPin');
  const masterKey = itemStorage.get('masterKey');
  const areWePrimary = window.ConversationController.areWePrimaryDevice();

  if (!areWePrimary) {
    log.info(`${logId}: We are not primary device; returning early`);
    return;
  }

  if (!svrPin || !masterKey) {
    log.info(`${logId}: Missing data to do store!`);
    return;
  }

  const startingJobState = getJobState(type) || {};
  const startingOurJobState = startingJobState[id];
  const sessionData = startingOurJobState?.sessionData
    ? fromBase64(startingOurJobState.sessionData)
    : undefined;

  log.info(
    `${logId}: Starting store. reason='${reason}', previousSession=${Boolean(sessionData)}`
  );
  const result = await storeWithSVR2({
    pin: normalizePin(svrPin),
    data: fromBase64(masterKey),
    sessionData,
  });

  if (result.success) {
    await putJobState(type, omit(startingJobState, id));
    log.info(`${logId}: Store succeeded!`);
    return;
  }

  if (isFinalAttempt) {
    await putJobState(type, omit(startingJobState, id));
    throw new Error(
      `${logId}: Failed to store, and this was our final attempt. Cleared state.`
    );
  }

  const updatedSession = result.sessionData;
  if (!updatedSession) {
    throw new Error(`${logId}: Failed to store, and no session returned!`);
  }

  const freshJobState = getJobState(type) || {};
  const newJobState = {
    ...freshJobState,
    [id]: {
      id,
      timestamp,
      sessionData: toBase64(updatedSession),
    },
  };
  await putJobState(type, newJobState);
  throw new Error(`${logId}: Failed to store, saved session for next try`);
}

async function updateToNewMasterKey(
  data: UpdateToNewMasterKeyJobData,
  bundle: RegistrationQueueJobBundle
): Promise<void> {
  const { id, reglock } = data;
  const { log } = bundle;
  const type = registrationQueueJobEnum.enum.UpdateToNewMasterKey;
  const areWePrimary = window.ConversationController.areWePrimaryDevice();
  const logId = `${type}/${id}`;

  if (!areWePrimary) {
    log.info(`${logId}: We are not primary device; returning early`);
    return;
  }

  log.info(`${logId}: Starting!`);

  await resetStorageServiceWithNewKey();

  if (reglock) {
    log.info(`${logId}: Updating registration lock string...`);
    await setupRegistrationLock(getRegistrationLockString());
  }

  await registrationJobQueue.add({
    type: 'StoreSVR',
    id: generateUuid(),
    reason: logId,
  });

  log.info(`${logId}: Complete! Scheduled a job to store masterKey in SVR.`);
}

export function getRegistrationLockString(): string {
  const aep = itemStorage.get('accountEntropyPool');
  if (!aep) {
    throw new Error('missing aep!');
  }

  const svrKeyData = AccountEntropyPool.deriveSvrKey(aep);
  const svrKey = new SvrKey(svrKeyData);

  const registrationLock = svrKey.deriveRegistrationLock();
  return toHex(registrationLock);
}

async function uploadProfile(
  data: UploadProfileJobData,
  bundle: RegistrationQueueJobBundle
): Promise<void> {
  const { id, firstName, familyName, avatarDataBase64 } = data;
  const { log } = bundle;
  const type = registrationQueueJobEnum.enum.UploadProfile;
  const logId = `${type}/${id}`;

  log.info(`${logId}: Starting...`);

  const me = window.ConversationController.getOurConversationOrThrow();
  const { profileName, profileFamilyName } = me.attributes;

  if (
    (profileName && profileName !== firstName) ||
    (profileFamilyName && profileFamilyName !== familyName)
  ) {
    log.info(
      `${logId}: User has updated their profile since this job was created, cancelling.`
    );
    return;
  }

  me.set({ profileName: firstName, profileFamilyName: familyName });
  await DataWriter.updateConversation(me.attributes);

  me.captureChange('registrationJobQueue/uploadProfile');

  await writeProfile(getConversation(me), {
    keepAvatar: false,
    avatarUpdate: {
      oldAvatar: undefined,
      newAvatar: avatarDataBase64 ? fromBase64(avatarDataBase64) : undefined,
    },
  });

  log.info(`${logId}: Successfully uploaded profile!`);
}

export const registrationJobQueue = new RegistrationJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'registration',
  maxAttempts: MAX_ATTEMPTS,
});
