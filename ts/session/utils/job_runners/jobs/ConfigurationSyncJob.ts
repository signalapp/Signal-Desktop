import { compact, groupBy, isArray, isEmpty, isNumber, isString, uniq } from 'lodash';
import { v4 } from 'uuid';
import { UserUtils } from '../..';
import { ConfigDumpData } from '../../../../data/configDump/configDump';
import {
  GenericWrapperActions,
  UserConfigWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { NotEmptyArrayOfBatchResults } from '../../../apis/snode_api/SnodeRequestTypes';
import { getConversationController } from '../../../conversations';
import { SharedConfigMessage } from '../../../messages/outgoing/controlMessage/SharedConfigMessage';
import { MessageSender } from '../../../sending/MessageSender';
import { LibSessionUtil, OutgoingConfResult } from '../../libsession/libsession_utils';
import { fromHexToArray } from '../../String';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  ConfigurationSyncPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';

const defaultMsBetweenRetries = 3000;
const defaultMaxAttempts = 3;

export type SingleDestinationChanges = {
  destination: string;
  messages: Array<OutgoingConfResult>;
  allOldHashes: Array<string>;
};

type SuccessfulChange = {
  message: SharedConfigMessage;
  publicKey: string;
  updatedHash: Array<string>;
};

/**
 * Later in the syncing logic, we want to batch-send all the updates for a pubkey in a single batch call.
 * To make this easier, this function prebuilds and merges together all the changes for each pubkey.
 */
async function retrieveSingleDestinationChanges(): Promise<Array<SingleDestinationChanges>> {
  const outgoingConfResults = await LibSessionUtil.pendingChangesForPubkey(
    UserUtils.getOurPubKeyStrFromCache()
  );

  const groupedByDestination = groupBy(outgoingConfResults, m => m.destination);

  const singleDestChanges: Array<SingleDestinationChanges> = Object.keys(groupedByDestination).map(
    destination => {
      const messages = groupedByDestination[destination];
      // the delete hashes sub request can be done accross namespaces, so we can do a single one of it with all the hashes to remove (per pubkey)
      const hashes = compact(messages.map(m => m.oldMessageHashes)).flat();

      return { allOldHashes: hashes, destination, messages };
    }
  );

  return singleDestChanges;
}

/**
 * This function is run once we get the results from the multiple batch-send.
 * For each results, it checks wha
 */
function resultsToSuccessfulChange(
  allResults: Array<PromiseSettledResult<NotEmptyArrayOfBatchResults | null>>,
  requests: Array<SingleDestinationChanges>
): Array<SuccessfulChange> {
  const successfulChanges: Array<SuccessfulChange> = [];

  /**
   * For each batch request, we get as result
   * - status code + hash of the new config message
   * - status code of the delete of all messages as given by the request hashes.
   *
   * As it is a sequence, the delete might have failed but the new config message might still be posted.
   * So we need to check which request failed, and if it is the delete by hashes, we need to add the hash of the posted message to the list of hashes
   */

  try {
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i];

      // the batch send was rejected. Let's skip handling those results altogether. Another job will handle the retry logic.
      if (result.status !== 'fulfilled') {
        continue;
      }

      const resultValue = result.value;
      if (!resultValue) {
        continue;
      }

      const request = requests?.[i];
      if (!result) {
        continue;
      }

      const didDeleteOldConfigMessages = Boolean(
        !isEmpty(request.allOldHashes) &&
          resultValue &&
          resultValue?.length &&
          request &&
          resultValue[resultValue.length - 1].code === 200
      );

      for (let j = 0; j < resultValue.length; j++) {
        const batchResult = resultValue[j];
        const messagePostedHashes = batchResult?.body?.hash;

        if (
          batchResult.code === 200 &&
          isString(messagePostedHashes) &&
          request.messages?.[j].message &&
          request.destination
        ) {
          // a message was posted. We need to add it to the tracked list of hashes
          const updatedHashes: Array<string> = didDeleteOldConfigMessages
            ? [messagePostedHashes]
            : uniq(compact([...request.allOldHashes, messagePostedHashes]));
          successfulChanges.push({
            publicKey: request.destination,
            updatedHash: updatedHashes,
            message: request.messages?.[j].message,
          });
        }
      }
    }
  } catch (e) {
    throw e;
  }

  return successfulChanges;
}

async function buildAndSaveDumpsToDB(changes: Array<SuccessfulChange>): Promise<void> {
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const variant = LibSessionUtil.kindToVariant(change.message.kind);
    const needsDump = await LibSessionUtil.markAsPushed(
      variant,
      change.publicKey,
      change.message.seqno.toNumber()
    );

    if (!needsDump) {
      continue;
    }
    const dump = await GenericWrapperActions.dump(variant);
    await ConfigDumpData.saveConfigDump({
      data: dump,
      publicKey: change.publicKey,
      variant,
      combinedMessageHashes: change.updatedHash,
    });
  }
}

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
    if (!window.sessionFeatureFlags.useSharedUtilForUserConfig) {
      return RunJobResult.Success;
    }
    window.log.debug(`ConfigurationSyncJob starting ${this.persistedData.identifier}`);

    const us = UserUtils.getOurPubKeyStrFromCache();
    const ed25519Key = await UserUtils.getUserED25519KeyPairBytes();
    const conversation = getConversationController().get(us);
    if (!us || !conversation || !ed25519Key) {
      // we check for ed25519Key because it is needed for authenticated requests
      window.log.warn('did not find our own conversation');
      return RunJobResult.PermanentFailure;
    }
    const name = conversation.get('displayNameInProfile');
    const pointer = conversation.get('avatarPointer');
    const profileKey = conversation.get('profileKey');
    await UserConfigWrapperActions.setName(name || '');

    if (profileKey && pointer) {
      const profileKeyArray = fromHexToArray(profileKey);
      await UserConfigWrapperActions.setProfilePicture(pointer, profileKeyArray);
    } else {
      await UserConfigWrapperActions.setProfilePicture('', new Uint8Array());
    }

    const singleDestChanges = await retrieveSingleDestinationChanges();

    // If there are no pending changes then the job can just complete (next time something
    // is updated we want to try and run immediately so don't scuedule another run in this case)

    if (isEmpty(singleDestChanges)) {
      return RunJobResult.Success;
    }

    const allResults = await Promise.allSettled(
      singleDestChanges.map(async dest => {
        const msgs = dest.messages.map(item => {
          return {
            namespace: item.namespace,
            pubkey: item.destination,
            timestamp: item.message.timestamp,
            ttl: item.message.ttl(),
            message: item.message,
          };
        });
        const asSet = new Set(dest.allOldHashes);
        return MessageSender.sendMessagesToSnode(msgs, dest.destination, asSet);
      })
    );

    // we do a sequence call here. If we do not have the right expected number of results, consider it

    if (!isArray(allResults) || allResults.length !== singleDestChanges.length) {
      return RunJobResult.RetryJobIfPossible;
    }

    const changes = resultsToSuccessfulChange(allResults, singleDestChanges);
    if (isEmpty(changes)) {
      return RunJobResult.RetryJobIfPossible;
    }
    // Now that we have the successful changes, we need to mark them as pushed and
    // generate any config dumps which need to be stored

    await buildAndSaveDumpsToDB(changes);
    return RunJobResult.Success;
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

  public getJobTimeoutMs(): number {
    return 20000;
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
