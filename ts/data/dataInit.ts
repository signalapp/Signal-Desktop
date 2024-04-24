import { ipcRenderer } from 'electron';
import { channels } from './channels';
import { ConfigDumpData } from './configDump/configDump';

const channelsToMakeForOpengroupV2 = [
  'getAllV2OpenGroupRooms',
  'getV2OpenGroupRoom',
  'saveV2OpenGroupRoom',
  'removeV2OpenGroupRoom',
];

const channelsToMakeForConfigDumps = [...Object.keys(ConfigDumpData)];

const channelsToMake = new Set([
  'shutdown',
  'close',
  'removeDB',
  'getPasswordHash',
  'getGuardNodes',
  'updateGuardNodes',
  'createOrUpdateItem',
  'getItemById',
  'getAllItems',
  'removeItemById',
  'getSwarmNodesForPubkey',
  'updateSwarmNodesForPubkey',
  'clearOutAllSnodesNotInPool',
  'saveConversation',
  'fetchConvoMemoryDetails',
  'getConversationById',
  'removeConversation',
  'getAllConversations',
  'getPubkeysInPublicConversation',
  'searchConversations',
  'searchMessages',
  'searchMessagesInConversation',
  'saveMessage',
  'cleanSeenMessages',
  'cleanLastHashes',
  'updateLastHash',
  'saveSeenMessageHashes',
  'saveMessages',
  'removeMessage',
  'removeMessagesByIds',
  'cleanUpExpirationTimerUpdateHistory',
  'getUnreadByConversation',
  'getUnreadDisappearingByConversation',
  'markAllAsReadByConversationNoExpiration',
  'getUnreadCountByConversation',
  'getMessageCountByType',
  'removeAllMessagesInConversation',
  'getMessageCount',
  'filterAlreadyFetchedOpengroupMessage',
  'getMessagesBySenderAndSentAt',
  'getMessageIdsFromServerIds',
  'getMessageById',
  'getMessagesById',
  'getMessagesBySentAt',
  'getMessageByServerId',
  'getExpiredMessages',
  'getOutgoingWithoutExpiresAt',
  'getNextExpiringMessage',
  'getMessagesByConversation',
  'getLastMessagesByConversation',
  'getOldestMessageInConversation',
  'getFirstUnreadMessageIdInConversation',
  'getFirstUnreadMessageWithMention',
  'hasConversationOutgoingMessage',
  'getSeenMessagesByHashList',
  'getLastHashBySnode',
  'getUnprocessedCount',
  'getAllUnprocessed',
  'getUnprocessedById',
  'saveUnprocessed',
  'updateUnprocessedAttempts',
  'updateUnprocessedWithData',
  'removeUnprocessed',
  'removeAllUnprocessed',
  'getNextAttachmentDownloadJobs',
  'saveAttachmentDownloadJob',
  'resetAttachmentDownloadPending',
  'setAttachmentDownloadJobPending',
  'removeAttachmentDownloadJob',
  'removeAllAttachmentDownloadJobs',
  'removeAll',
  'removeAllConversations',
  'removeOtherData',
  'cleanupOrphanedAttachments',
  'getMessagesWithVisualMediaAttachments',
  'getMessagesWithFileAttachments',
  'getAllEncryptionKeyPairsForGroup',
  'getLatestClosedGroupEncryptionKeyPair',
  'addClosedGroupEncryptionKeyPair',
  'removeAllClosedGroupEncryptionKeyPairs',
  ...channelsToMakeForOpengroupV2,
  ...channelsToMakeForConfigDumps,
]);

const SQL_CHANNEL_KEY = 'sql-channel';
let _shutdownPromise: any = null;
const DATABASE_UPDATE_TIMEOUT = 2 * 60 * 1000; // two minutes

export const jobs = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;
let _shuttingDown = false;
let _shutdownCallback: any = null;

export async function shutdown() {
  if (_shutdownPromise) {
    return _shutdownPromise;
  }

  _shuttingDown = true;

  const jobKeys = Object.keys(jobs);
  window?.log?.info(`data.shutdown: starting process. ${jobKeys.length} jobs outstanding`);

  // No outstanding jobs, return immediately
  if (jobKeys.length === 0) {
    window?.log?.info('data.shutdown: No outstanding jobs');

    return null;
  }

  // Outstanding jobs; we need to wait until the last one is done
  _shutdownPromise = new Promise((resolve, reject) => {
    _shutdownCallback = (error: any) => {
      window?.log?.info('data.shutdown: process complete');
      if (error) {
        return reject(error);
      }

      return resolve(undefined);
    };
  });

  return _shutdownPromise;
}

function getJob(id: number) {
  return jobs[id];
}

function makeChannel(fnName: string) {
  channels[fnName] = async (...args: any) => {
    const jobId = makeJob(fnName);

    return new Promise((resolve, reject) => {
      ipcRenderer.send(SQL_CHANNEL_KEY, jobId, fnName, ...args);

      updateJob(jobId, {
        resolve,
        reject,
        args: _DEBUG ? args : null,
      });

      jobs[jobId].timer = setTimeout(
        () => reject(new Error(`SQL channel job ${jobId} (${fnName}) timed out`)),
        DATABASE_UPDATE_TIMEOUT
      );
    });
  };
}

export async function callChannel(name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ipcRenderer.send(name);
    ipcRenderer.once(`${name}-done`, (_event, error) => {
      if (error) {
        return reject(error);
      }

      return resolve(undefined);
    });

    setTimeout(
      () => reject(new Error(`callChannel call to ${name} timed out`)),
      DATABASE_UPDATE_TIMEOUT
    );
  });
}

export function initData() {
  // We listen to a lot of events on ipcRenderer, often on the same channel. This prevents
  //   any warnings that might be sent to the console in that case.
  ipcRenderer.setMaxListeners(0);

  channelsToMake.forEach(makeChannel);

  ipcRenderer.on(`${SQL_CHANNEL_KEY}-done`, (_event, jobId, errorForDisplay, result) => {
    const job = getJob(jobId);
    if (!job) {
      throw new Error(
        `Received SQL channel reply to job ${jobId}, but did not have it in our registry!`
      );
    }

    const { resolve, reject, fnName } = job;

    if (errorForDisplay) {
      return reject(
        new Error(`Error received from SQL channel job ${jobId} (${fnName}): ${errorForDisplay}`)
      );
    }

    return resolve(result);
  });
}

function updateJob(id: number, data: any) {
  const { resolve, reject } = data;
  const { fnName, start } = jobs[id];

  jobs[id] = {
    ...jobs[id],
    ...data,
    resolve: (value: any) => {
      removeJob(id);
      if (_DEBUG) {
        const end = Date.now();
        const delta = end - start;
        if (delta > 10) {
          window?.log?.debug(`SQL channel job ${id} (${fnName}) succeeded in ${end - start}ms`);
        }
      }
      return resolve(value);
    },
    reject: (error: any) => {
      removeJob(id);
      const end = Date.now();
      window?.log?.warn(`SQL channel job ${id} (${fnName}) failed in ${end - start}ms`);
      return reject(error);
    },
  };
}

function removeJob(id: number) {
  if (_DEBUG) {
    jobs[id].complete = true;
    return;
  }

  if (jobs[id].timer) {
    global.clearTimeout(jobs[id].timer);
    jobs[id].timer = null;
  }

  delete jobs[id];

  if (_shutdownCallback) {
    const keys = Object.keys(jobs);
    window?.log?.info(`removeJob: _shutdownCallback and we still have ${keys.length} jobs to run`);

    if (keys.length === 0) {
      _shutdownCallback();
    }
  }
}

function makeJob(fnName: string) {
  if (_shuttingDown && fnName !== 'close') {
    throw new Error(`Rejecting SQL channel job (${fnName}); application is shutting down`);
  }

  _jobCounter += 1;
  const id = _jobCounter;

  if (_DEBUG) {
    window?.log?.debug(`SQL channel job ${id} (${fnName}) started`);
  }
  jobs[id] = {
    fnName,
    start: Date.now(),
  };

  return id;
}
