import { from_string } from 'libsodium-wrappers-sumo';
import { isNumber } from 'lodash';
import Long from 'long';
import { v4 } from 'uuid';
import { UserUtils } from '../..';
import { SignalService } from '../../../../protobuf';
import { UserConfigWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';
import { GetNetworkTime } from '../../../apis/snode_api/getNetworkTime';
import { SnodeNamespaces } from '../../../apis/snode_api/namespaces';
import { getConversationController } from '../../../conversations';
import { SharedConfigMessage } from '../../../messages/outgoing/controlMessage/SharedConfigMessage';
import { getMessageQueue } from '../../../sending';
import { PubKey } from '../../../types';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  ConfigurationSyncPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';

const defaultMsBetweenRetries = 3000;
const defaultMaxAttempts = 3;

class ConfigurationSyncJob extends PersistedJob<ConfigurationSyncPersistedData> {
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
      jobType: 'ConfigurationSyncJobType',
      identifier: identifier || v4(),
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
    });
  }

  public async run(): Promise<RunJobResult> {
    window.log.debug(`ConfigurationSyncJob starting ${this.persistedData.identifier}`);

    const us = UserUtils.getOurPubKeyStrFromCache();
    const conversation = getConversationController().get(us);
    if (!us || !conversation) {
      window.log.warn('did not find our own conversation');
      return RunJobResult.PermanentFailure;
    }
    const name = conversation.get('displayNameInProfile');
    const pointer = conversation.get('avatarPointer');
    const profileKey = conversation.get('profileKey');
    await UserConfigWrapperActions.setName(name || '');

    if (profileKey && pointer) {
      await UserConfigWrapperActions.setProfilePicture(pointer, from_string(profileKey));
    } else {
      await UserConfigWrapperActions.setProfilePicture('', new Uint8Array());
    }

    const data = await UserConfigWrapperActions.push();

    const message = new SharedConfigMessage({
      data: data.data,
      kind: SignalService.SharedConfigMessage.Kind.USER_PROFILE,
      seqno: Long.fromNumber(data.seqno),
      timestamp: GetNetworkTime.getNowWithNetworkOffset(),
    });

    const result = await getMessageQueue().sendToPubKeyNonDurably({
      message,
      namespace: SnodeNamespaces.UserProfile,
      pubkey: PubKey.cast(us),
    });
    console.warn(
      `ConfigurationSyncJob sendToPubKeyNonDurably ${this.persistedData.identifier} returned: "${result}"`
    );

    if (isNumber(result)) {
      // try {
      //   markAsPushed
      // }
      debugger;
      return RunJobResult.Success;
    }

    return RunJobResult.RetryJobIfPossible;
  }

  public serializeJob(): ConfigurationSyncPersistedData {
    const fromParent = super.serializeBase();
    return fromParent;
  }

  public addJobCheck(jobs: Array<ConfigurationSyncPersistedData>): AddJobCheckReturn {
    return this.addJobCheckSameTypePresent(jobs);
  }

  /**
   * For the SharedConfig job, we do not care about the jobs already in the list.
   * We never want to add a new sync configuration job if there is already one in the queue.
   * This is done by the `addJobCheck` method above
   */
  public nonRunningJobsToRemove(_jobs: Array<ConfigurationSyncPersistedData>) {
    return [];
  }
}

/**
 * Queue a new Sync Configuration if needed job.
 * A ConfigurationSyncJob can only be added if there is none of the same type queued already.
 */
async function queueNewJobIfNeeded() {
  await runners.configurationSyncRunner.addJob(new ConfigurationSyncJob({}));
}

export const ConfigurationSync = {
  ConfigurationSyncJob,
  queueNewJobIfNeeded,
};
