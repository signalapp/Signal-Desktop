/* eslint-disable no-await-in-loop */
import { isEmpty, isNumber, uniq } from 'lodash';
import { v4 } from 'uuid';
import { Data } from '../../../../data/data';
import { isSignInByLinking } from '../../../../util/storage';
import { DisappearingMessages } from '../../../disappearing_messages';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  PersistedJob,
  RunJobResult,
  UpdateMsgExpirySwarmPersistedData,
} from '../PersistedJob';

class UpdateMsgExpirySwarmJob extends PersistedJob<UpdateMsgExpirySwarmPersistedData> {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    msgIds,
  }: Partial<
    Pick<
      UpdateMsgExpirySwarmPersistedData,
      'identifier' | 'nextAttemptTimestamp' | 'currentRetry' | 'maxAttempts'
    >
  > &
    Pick<UpdateMsgExpirySwarmPersistedData, 'msgIds'>) {
    super({
      jobType: 'UpdateMsgExpirySwarmJobType',
      identifier: identifier || v4(),
      delayBetweenRetries: 2000,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : 2,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now(),
      msgIds: uniq(msgIds),
    });
  }

  public async run(): Promise<RunJobResult> {
    const start = Date.now();

    try {
      if (!this.persistedData.msgIds || isEmpty(this.persistedData.msgIds)) {
        return RunJobResult.Success;
      }
      const msgModels = await Data.getMessagesById(this.persistedData.msgIds);
      if (isEmpty(msgModels)) {
        return RunJobResult.Success;
      }
      await DisappearingMessages.updateMessageExpiriesOnSwarm(msgModels);
      await DisappearingMessages.destroyExpiredMessages();

      return RunJobResult.Success;
    } finally {
      window.log.debug(`UpdateMsgExpirySwarmJob run() took ${Date.now() - start}ms`);
    }
  }

  public serializeJob(): UpdateMsgExpirySwarmPersistedData {
    const fromParent = super.serializeBase();
    return fromParent;
  }

  public addJobCheck(jobs: Array<UpdateMsgExpirySwarmPersistedData>): AddJobCheckReturn {
    // if all ids we are trying to add are already tracked as other jobs in the job runner,
    // there is no need to add this job at all.
    return this.addJobCheckEveryMsgIdsAlreadyPresent(jobs);
  }

  public nonRunningJobsToRemove(_jobs: Array<UpdateMsgExpirySwarmPersistedData>) {
    return [];
  }

  public getJobTimeoutMs(): number {
    return 20000;
  }
}

async function queueNewJobIfNeeded(msgIds: Array<string>) {
  if (isSignInByLinking()) {
    window.log.info('NOT Scheduling UpdateMsgExpirySwarmJob: as we are linking a device');

    return;
  }
  if (isEmpty(msgIds)) {
    return;
  }

  await runners.updateMsgExpiryRunner.addJob(
    new UpdateMsgExpirySwarmJob({ nextAttemptTimestamp: Date.now() + 1000, msgIds })
  );
}

export const UpdateMsgExpirySwarm = {
  UpdateMsgExpirySwarmJob,
  queueNewJobIfNeeded,
};
