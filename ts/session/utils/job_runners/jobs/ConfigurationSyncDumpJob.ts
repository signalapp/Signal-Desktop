import { isNumber } from 'lodash';
import { v4 } from 'uuid';
import { UserUtils } from '../..';
import { ConfigDumpData } from '../../../../data/configDump/configDump';
import { ConfigWrapperObjectTypes } from '../../../../webworker/workers/browser/libsession_worker_functions';
import { GenericWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';
import { DURATION } from '../../../constants';
import { getConversationController } from '../../../conversations';
import { LibSessionUtil } from '../../libsession/libsession_utils';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  ConfigurationSyncDumpPersistedData,
  ConfigurationSyncPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';

const defaultMsBetweenRetries = DURATION.SECONDS * 5;
const defaultMaxAttempts = 2;

/**
 * We want to run each of those jobs at least 3seconds apart.
 * So every time one of that job finishes, update this timestamp, so we know when adding a new job, what is the next minimun date to run it.
 */
let lastRunConfigSyncJobDumpTimestamp: number | null = null;

const variantsToSaveRegularly: Array<ConfigWrapperObjectTypes> = ['UserConfig', 'ContactsConfig'];

async function saveDumpsNeededToDB(): Promise<boolean> {
  let savedAtLeastOne = false;
  for (let i = 0; i < variantsToSaveRegularly.length; i++) {
    const variant = variantsToSaveRegularly[i];
    const needsDump = await GenericWrapperActions.needsDump(variant);
    console.info('saveDumpsNeededToDB()', variant, needsDump);

    if (!needsDump) {
      continue;
    }
    const dump = await GenericWrapperActions.dump(variant);
    await ConfigDumpData.saveConfigDumpNoHashes({
      data: dump,
      publicKey: UserUtils.getOurPubKeyStrFromCache(),
      variant,
    });
    savedAtLeastOne = true;
  }
  return savedAtLeastOne;
}

/**
 * We have the `ConfigurationSyncDumpJob` and the `ConfigurationSyncJob`.
 * The `ConfigurationSyncDumpJob` involves network request which is slow and might not be available at all, hence it can run only from time to time.
 * But when we do changes to the wrapper, we need to dump it to the database in the event of an app crash or whatever.
 * To it less likely to loose data, we have a lightweight job which can be run a lot more frequently, the `ConfigurationSyncDumpJob`.
 * It just grabs all the wrappers which needs to be stored in the DB, override the data in the wrapper with what is in the database and save the result (if `needsDump` is true) to the corresponding database wrapper.
 *
 */
class ConfigurationSyncDumpJob extends PersistedJob<ConfigurationSyncDumpPersistedData> {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
  }: Partial<
    Pick<
      ConfigurationSyncPersistedData,
      'identifier' | 'nextAttemptTimestamp' | 'currentRetry' | 'maxAttempts'
    >
  >) {
    super({
      jobType: 'ConfigurationSyncDumpJobType',
      identifier: identifier || v4(),
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now(),
    });
  }

  public async run(): Promise<RunJobResult> {
    const start = Date.now();
    try {
      if (!window.sessionFeatureFlags.useSharedUtilForUserConfig) {
        return RunJobResult.Success;
      }
      window.log.debug(`ConfigurationSyncDumpJob starting ${this.persistedData.identifier}`);

      const us = UserUtils.getOurPubKeyStrFromCache();
      const ed25519Key = await UserUtils.getUserED25519KeyPairBytes();
      const conversation = getConversationController().get(us);
      if (!us || !conversation || !ed25519Key) {
        // we check for ed25519Key because it is needed for authenticated requests
        window.log.warn('did not find our own conversation');
        return RunJobResult.PermanentFailure;
      }
      // refresh all the data stored by the wrappers we need to store.
      // so when we call needsDump(), we know for sure that we are up to date
      console.time('insertAll');
      await LibSessionUtil.insertUserProfileIntoWrapper();
      await LibSessionUtil.insertAllContactsIntoContactsWrapper();
      console.timeEnd('insertAll');
      console.time('saveDumpsNeededToDB');
      await saveDumpsNeededToDB();
      console.timeEnd('saveDumpsNeededToDB');
      return RunJobResult.Success;
    } catch (e) {
      throw e;
    } finally {
      // this is a simple way to make sure whatever happens here, we update the lastest timestamp.
      // (a finally statement is always executed (no matter if exception or returns in other try/catch block)
      this.updateLastTickTimestamp();
      window.log.debug(`ConfigurationSyncDumpJob run() took ${Date.now() - start}ms`);
    }
  }

  public serializeJob(): ConfigurationSyncDumpPersistedData {
    const fromParent = super.serializeBase();
    return fromParent;
  }

  public addJobCheck(jobs: Array<ConfigurationSyncDumpPersistedData>): AddJobCheckReturn {
    return this.addJobCheckSameTypePresent(jobs);
  }

  /**
   * For the SharedConfig job, we do not care about the jobs already in the list.
   * We never want to add a new sync configuration job if there is already one in the queue.
   * This is done by the `addJobCheck` method above
   */
  public nonRunningJobsToRemove(_jobs: Array<ConfigurationSyncDumpPersistedData>) {
    return [];
  }

  public getJobTimeoutMs(): number {
    return DURATION.SECONDS * 2;
  }

  private updateLastTickTimestamp() {
    lastRunConfigSyncJobDumpTimestamp = Date.now();
  }
}

/**
 * Queue a new Sync Configuration if needed job.
 * A ConfigurationSyncJob can only be added if there is none of the same type queued already.
 */
async function queueNewJobIfNeeded() {
  if (
    !lastRunConfigSyncJobDumpTimestamp ||
    lastRunConfigSyncJobDumpTimestamp < Date.now() - defaultMsBetweenRetries
  ) {
    window.log.debug('scheduling conf sync dump job in asap');

    // this call will make sure that there is only one configuration sync job at all times
    await runners.configurationSyncDumpRunner.addJob(
      new ConfigurationSyncDumpJob({ nextAttemptTimestamp: Date.now() })
    );
  } else {
    // if we did run at 100, and it is currently 110, diff is 10
    const diff = Math.max(Date.now() - lastRunConfigSyncJobDumpTimestamp, 0);
    // but we want to run every 30, so what we need is actually `30-10` from now = 20
    const leftBeforeNextTick = Math.max(defaultMsBetweenRetries - diff, 0);
    window.log.debug(`scheduling conf sync dump job in ${leftBeforeNextTick} ms`);

    await runners.configurationSyncDumpRunner.addJob(
      new ConfigurationSyncDumpJob({ nextAttemptTimestamp: Date.now() + leftBeforeNextTick })
    );
  }
}

export const ConfigurationDumpSync = {
  ConfigurationSyncDumpJob,
  queueNewJobIfNeeded,
};
