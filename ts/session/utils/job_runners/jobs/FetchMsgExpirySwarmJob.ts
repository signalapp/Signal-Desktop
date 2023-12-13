/* eslint-disable no-await-in-loop */
import { compact, isEmpty, isNumber, uniq } from 'lodash';
import { v4 } from 'uuid';
import { Data } from '../../../../data/data';
import { READ_MESSAGE_STATE } from '../../../../models/conversationAttributes';
import { MessageModel } from '../../../../models/message';
import { isSignInByLinking } from '../../../../util/storage';
import { getExpiriesFromSnode } from '../../../apis/snode_api/getExpiriesRequest';
import { DisappearingMessages } from '../../../disappearing_messages';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  FetchMsgExpirySwarmPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';

class FetchMsgExpirySwarmJob extends PersistedJob<FetchMsgExpirySwarmPersistedData> {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    msgIds,
  }: Partial<
    Pick<
      FetchMsgExpirySwarmPersistedData,
      'identifier' | 'nextAttemptTimestamp' | 'currentRetry' | 'maxAttempts'
    >
  > &
    Pick<FetchMsgExpirySwarmPersistedData, 'msgIds'>) {
    super({
      jobType: 'FetchMsgExpirySwarmJobType',
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
      let msgModels = await Data.getMessagesById(this.persistedData.msgIds);
      const messageHashes = compact(msgModels.map(m => m.getMessageHash()));

      if (isEmpty(msgModels) || isEmpty(messageHashes)) {
        return RunJobResult.Success;
      }

      const fetchedExpiries = await getExpiriesFromSnode({
        messageHashes,
      });
      const updatedMsgModels: Array<MessageModel> = [];

      if (fetchedExpiries.length) {
        // get a fresh list of attributes for those message models
        msgModels = await Data.getMessagesById(this.persistedData.msgIds);
        for (let index = 0; index < fetchedExpiries.length; index++) {
          const expiry = fetchedExpiries[index];
          if (expiry.fetchedExpiry <= 0) {
            continue;
          }
          const message = msgModels.find(m => m.getMessageHash() === expiry.messageHash);
          if (!message) {
            continue;
          }
          const realReadAt = expiry.fetchedExpiry - message.getExpireTimerSeconds() * 1000;

          if (
            (message.get('expirationStartTimestamp') !== realReadAt ||
              message.get('expires_at') !== expiry.fetchedExpiry) &&
            message.getExpireTimerSeconds()
          ) {
            window.log.debug(
              `FetchMsgExpirySwarmJob: setting for msg hash ${message.getMessageHash()}:`,
              {
                expires_at: expiry.fetchedExpiry,
                unread: READ_MESSAGE_STATE.read,
                expirationStartTimestamp: realReadAt,
              }
            );
            message.set({
              expires_at: expiry.fetchedExpiry,
              unread: READ_MESSAGE_STATE.read,
              expirationStartTimestamp: realReadAt,
            });
            updatedMsgModels.push(message);
          }
        }
      }
      await Promise.all(updatedMsgModels.map(m => m.commit()));
      await DisappearingMessages.destroyExpiredMessages();

      return RunJobResult.Success;
    } finally {
      window.log.debug(`FetchMsgExpirySwarmJob run() took ${Date.now() - start}ms`);
    }
  }

  public serializeJob(): FetchMsgExpirySwarmPersistedData {
    const fromParent = super.serializeBase();
    return fromParent;
  }

  public addJobCheck(jobs: Array<FetchMsgExpirySwarmPersistedData>): AddJobCheckReturn {
    return this.addJobCheckEveryMsgIdsAlreadyPresent(jobs);
  }

  public nonRunningJobsToRemove(_jobs: Array<FetchMsgExpirySwarmPersistedData>) {
    return [];
  }

  public getJobTimeoutMs(): number {
    return 20000;
  }
}

async function queueNewJobIfNeeded(msgIds: Array<string>) {
  if (isSignInByLinking()) {
    window.log.info('NOT Scheduling FetchMsgExpirySwarmJob: as we are linking a device');

    return;
  }
  if (isEmpty(msgIds)) {
    return;
  }

  await runners.fetchSwarmMsgExpiryRunner.addJob(
    new FetchMsgExpirySwarmJob({ nextAttemptTimestamp: Date.now() + 1000, msgIds })
  );
}

export const FetchMsgExpirySwarm = {
  FetchMsgExpirySwarmJob,
  queueNewJobIfNeeded,
};
