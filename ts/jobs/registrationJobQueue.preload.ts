// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { omit } from 'lodash';
import { v7 as generateUuid } from 'uuid';

import type PQueue from 'p-queue';

import { DAY, MINUTE, SECOND } from '../util/durations/constants.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { areEqual, fromBase64, toBase64 } from '../Bytes.std.ts';
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
  updateAccountAttributes,
} from '../textsecure/WebAPI.preload.ts';
import { normalizePin } from '../util/normalizePin.std.ts';
import { resetWithNewKey as resetStorageServiceWithNewKey } from '../services/storage.preload.ts';
import { getConversation } from '../util/getConversation.preload.ts';
import { writeProfile } from '../services/writeProfile.preload.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { updateProfileKeyForAllGroups } from '../util/updateProfileKeyForAllGroups.preload.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { getRandomBytes } from '../Crypto.node.ts';
import { PROFILE_KEY_LENGTH } from '../textsecure/AccountManager.preload.ts';
import { ourProfileKeyService } from '../services/ourProfileKey.std.ts';
import { assembleAccountAttributes } from '../util/assembleAccountAttributes.preload.ts';
import { getRegistrationLockString } from '../util/getRegistrationLockString.preload.ts';

import type { Job } from './Job.std.ts';
import type { ParsedJob } from './types.std.ts';
import type { JOB_STATUS } from './JobQueue.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';

const MAX_RETRY_TIME = 7 * DAY;
const BACKOFF_OPTIONS = {
  maxBackoffTime: 45 * MINUTE,
  multiplier: 2.5,
  firstBackoffs: [0, SECOND, 5 * SECOND, 20 * SECOND],
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
  'RotateProfileKey',
  'UpdateGroupsWithNewProfileKey',
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
  [registrationQueueJobEnum.enum.RotateProfileKey]?: Record<
    string,
    {
      id: string;
      timestamp: number;
      newProfileKeyBase64: string;
    }
  >;
  [registrationQueueJobEnum.enum.UpdateGroupsWithNewProfileKey]?: Record<
    string,
    {
      id: string;
      timestamp: number;
      completedGroupIds: Array<string>;
    }
  >;
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

const rotateProfileKeyJobDataSchema = z.object({
  type: z.literal(registrationQueueJobEnum.enum.RotateProfileKey),
  id: z.string(),
  oldProfileKeyBase64: z.string(),
});
export type RotateProfileKeyJobData = z.infer<
  typeof rotateProfileKeyJobDataSchema
>;

const updateGroupsWithNewProfileKeyJobDataSchema = z.object({
  type: z.literal(registrationQueueJobEnum.enum.UpdateGroupsWithNewProfileKey),
  id: z.string(),
  newProfileKeyBase64: z.string(),
});
export type UpdateGroupsWithNewProfileKeyJobData = z.infer<
  typeof updateGroupsWithNewProfileKeyJobDataSchema
>;

export const registrationQueueJobDataSchema = z.discriminatedUnion('type', [
  migrateSVRJobDataSchema,
  storeSVRJobDataSchema,
  updateToNewMasterKeyJobDataSchema,
  uploadProfileJobDataSchema,
  rotateProfileKeyJobDataSchema,
  updateGroupsWithNewProfileKeyJobDataSchema,
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
        case go.RotateProfileKey: {
          await rotateProfileKey(data, bundle);
          break;
        }
        case go.UpdateGroupsWithNewProfileKey: {
          await updateGroupsWithNewProfileKey(data, bundle);
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
  const logId = `${type}/${timestamp}/${id}`;

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
    await itemStorage.put('isSvrPinStored', true);
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
  const logId = `${type}/${timestamp}/${id}`;

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
    await itemStorage.put('isSvrPinStored', true);
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
  const { log, timestamp } = bundle;
  const type = registrationQueueJobEnum.enum.UpdateToNewMasterKey;
  const areWePrimary = window.ConversationController.areWePrimaryDevice();
  const logId = `${type}/${timestamp}/${id}`;

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

async function uploadProfile(
  data: UploadProfileJobData,
  bundle: RegistrationQueueJobBundle
): Promise<void> {
  const { id, firstName, familyName, avatarDataBase64 } = data;
  const { log, timestamp } = bundle;
  const type = registrationQueueJobEnum.enum.UploadProfile;
  const logId = `${type}/${timestamp}/${id}`;

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
      reupload: false,
    },
  });

  log.info(`${logId}: Successfully uploaded profile!`);
}

async function rotateProfileKey(
  data: RotateProfileKeyJobData,
  bundle: RegistrationQueueJobBundle
) {
  const { id, oldProfileKeyBase64 } = data;
  const { log, timestamp, isFinalAttempt } = bundle;
  const type = registrationQueueJobEnum.enum.RotateProfileKey;
  const logId = `${type}/${timestamp}/${id}`;

  // A large queue might result in a lot of these jobs; we want to coalesce them if we can
  log.info(`${logId}: Waiting for empty event queue...`);
  try {
    await window.waitForEmptyEventQueue();
  } catch (error) {
    log.error(`${logId}: waitForEmptyEvent threw:`, toLogFormat(error));
  }

  log.info(`${logId}: Starting...`);

  const startingJobState = getJobState(type) || {};
  const startingOurJobState = startingJobState[id];

  let newProfileKey: Uint8Array<ArrayBuffer>;
  let newProfileKeyBase64: string;
  if (startingOurJobState) {
    log.info(`${logId}: Using previously-generated profileKey...`);
    newProfileKeyBase64 = startingOurJobState.newProfileKeyBase64;
    newProfileKey = fromBase64(newProfileKeyBase64);
  } else {
    log.info(`${logId}: Generating new profileKey...`);
    newProfileKey = getRandomBytes(PROFILE_KEY_LENGTH);
    newProfileKeyBase64 = toBase64(newProfileKey);
  }

  const currentProfileKey = itemStorage.get('profileKey');
  const oldProfileKey = fromBase64(oldProfileKeyBase64);

  // If we kick off a bunch of these jobs at once, only the first will succeed
  const alreadyStarted = startingOurJobState != null;
  const matchesOld =
    currentProfileKey && areEqual(currentProfileKey, oldProfileKey);
  const matchesNew =
    currentProfileKey &&
    alreadyStarted &&
    areEqual(currentProfileKey, newProfileKey);

  if (!matchesOld && !matchesNew) {
    log.info(
      `${logId}: Current profileKey does not match profileKey when this job was queued or target profileKey; canceling run`
    );
    await putJobState(type, omit(startingJobState, id));
    return;
  }
  await putJobState(type, {
    ...startingJobState,
    [id]: {
      id,
      timestamp,
      newProfileKeyBase64,
    },
  });

  try {
    const me = window.ConversationController.getOurConversationOrThrow();

    log.info(`${logId}: Saving new profileKey locally...`);
    const didChange = await me.setProfileKey(newProfileKeyBase64, {
      reason: 'rotateProfileKey',
      skipProfileFetch: true,
    });
    if (didChange) {
      window.SignalCI?.handleEvent('setProfileKey', {
        profileKeyBase64: newProfileKeyBase64,
        reason: 'rotateProfileKey',
      });
    }
    await ourProfileKeyService.set(newProfileKey);

    log.info(`${logId}: Updating account attributes...`);
    await updateAccountAttributes(assembleAccountAttributes());

    log.info(`${logId}: Uploading profile...`);
    const meProps = getConversation(me);
    await writeProfile(meProps, { keepAvatar: true, reupload: true });

    log.info(`${logId}: Fetching profile...`);
    await me.getProfiles();

    log.info(`${logId}: Scheduling a task for profile update in groups...`);
    await registrationJobQueue.add({
      type: 'UpdateGroupsWithNewProfileKey',
      id: generateUuid(),
      newProfileKeyBase64,
    });

    await putJobState(type, omit(startingJobState, id));
    log.info(`${logId}: Complete!`);
  } finally {
    if (isFinalAttempt) {
      await putJobState(type, omit(startingJobState, id));
    }
  }
}

async function updateGroupsWithNewProfileKey(
  data: UpdateGroupsWithNewProfileKeyJobData,
  bundle: RegistrationQueueJobBundle
) {
  const { id, newProfileKeyBase64 } = data;
  const { isFinalAttempt, log, timestamp } = bundle;
  const type = registrationQueueJobEnum.enum.UpdateGroupsWithNewProfileKey;
  const logId = `${type}/${timestamp}/${id}`;

  log.info(`${logId}: Starting...`);

  const profileKey = fromBase64(newProfileKeyBase64);

  const startingJobState = getJobState(type) || {};
  const startingOurJobState = startingJobState[id];
  const completedGroupIds = new Set(
    startingOurJobState?.completedGroupIds || []
  );

  const result = await updateProfileKeyForAllGroups(
    profileKey,
    completedGroupIds
  );

  if (result.state === 'success') {
    window.SignalCI?.handleEvent('updateGroupsWithNewProfileKey', {});

    await putJobState(type, omit(startingJobState, id));
    log.info(`${logId}: Complete!`);
    return;
  }

  if (result.state === 'canceled') {
    await putJobState(type, omit(startingJobState, id));
    log.info(`${logId}: Job cancelled. Returning.`);
    return;
  }

  if (isFinalAttempt) {
    await putJobState(type, omit(startingJobState, id));
    throw new Error(
      `${logId}: State was ${result.state}, but this was our final attempt. Cleared state.`
    );
  }

  if (result.state === 'failed') {
    const updatedOurJobState = {
      ...startingOurJobState,
      id,
      timestamp,
      completedGroupIds: Array.from(result.completedGroupIds),
    };
    const updatedJobState = { ...startingJobState, [id]: updatedOurJobState };
    await putJobState(type, updatedJobState);

    throw new Error(`Job failed; we'll try again later`);
  }

  throw missingCaseError(result);
}

export const registrationJobQueue = new RegistrationJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'registration',
  maxAttempts: MAX_ATTEMPTS,
});
