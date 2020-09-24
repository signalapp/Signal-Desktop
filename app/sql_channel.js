const electron = require('electron');
const Queue = require('p-queue').default;
const sql = require('../ts/sql/Server').default;
const { remove: removeUserConfig } = require('./user_config');
const { remove: removeEphemeralConfig } = require('./ephemeral_config');

const { ipcMain } = electron;

module.exports = {
  initialize,
};

let initialized = false;

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';

let singleQueue = null;
let multipleQueue = null;

function makeNewSingleQueue() {
  singleQueue = new Queue({ concurrency: 1, timeout: 1000 * 60 * 2 });
  return singleQueue;
}
function makeNewMultipleQueue() {
  multipleQueue = new Queue({ concurrency: 10, timeout: 1000 * 60 * 2 });
  return multipleQueue;
}

function makeSQLJob(fn, callName, jobId, args) {
  // console.log(`Job ${jobId} (${callName}) queued`);
  return async () => {
    // const start = Date.now();
    // console.log(`Job ${jobId} (${callName}) started`);
    const result = await fn(...args);
    // const end = Date.now();
    // console.log(`Job ${jobId} (${callName}) succeeded in ${end - start}ms`);
    return result;
  };
}

async function handleCall(callName, jobId, args) {
  const fn = sql[callName];
  if (!fn) {
    throw new Error(`sql channel: ${callName} is not an available function`);
  }

  let result;

  // We queue here to keep multi-query operations atomic. Without it, any multistage
  //   data operation (even within a BEGIN/COMMIT) can become interleaved, since all
  //   requests share one database connection.

  // A needsSerial method must be run in our single concurrency queue.
  if (fn.needsSerial) {
    if (singleQueue) {
      result = await singleQueue.add(makeSQLJob(fn, callName, jobId, args));
    } else if (multipleQueue) {
      makeNewSingleQueue();

      singleQueue.add(() => multipleQueue.onIdle());
      multipleQueue = null;

      result = await singleQueue.add(makeSQLJob(fn, callName, jobId, args));
    } else {
      makeNewSingleQueue();
      result = await singleQueue.add(makeSQLJob(fn, callName, jobId, args));
    }
  } else {
    // The request can be parallelized. To keep the same structure as the above block
    //   we force this section into the 'lonely if' pattern.
    // eslint-disable-next-line no-lonely-if
    if (multipleQueue) {
      result = await multipleQueue.add(makeSQLJob(fn, callName, jobId, args));
    } else if (singleQueue) {
      makeNewMultipleQueue();
      multipleQueue.pause();

      const multipleQueueRef = multipleQueue;
      const singleQueueRef = singleQueue;

      singleQueue = null;
      const promise = multipleQueueRef.add(
        makeSQLJob(fn, callName, jobId, args)
      );
      await singleQueueRef.onIdle();

      multipleQueueRef.start();
      result = await promise;
    } else {
      makeNewMultipleQueue();
      result = await multipleQueue.add(makeSQLJob(fn, callName, jobId, args));
    }
  }

  return result;
}

function initialize() {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }
  initialized = true;

  ipcMain.on(SQL_CHANNEL_KEY, async (event, jobId, callName, ...args) => {
    try {
      const result = await handleCall(callName, jobId, args);
      event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, null, result);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(
        `sql channel error with call ${callName}: ${errorForDisplay}`
      );
      if (!event.sender.isDestroyed()) {
        event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, errorForDisplay);
      }
    }
  });

  ipcMain.on(ERASE_SQL_KEY, async event => {
    try {
      removeUserConfig();
      removeEphemeralConfig();
      event.sender.send(`${ERASE_SQL_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql-erase error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_SQL_KEY}-done`, error);
    }
  });
}
