// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Queue from 'p-queue';
import { ServerInterface } from './Interface';

let allQueriesDone: () => void | undefined;
let sqlQueries = 0;
let singleQueue: Queue | null = null;
let multipleQueue: Queue | null = null;

// Note: we don't want queue timeouts, because delays here are due to in-progress sql
//   operations. For example we might try to start a transaction when the previous isn't
//   done, causing that database operation to fail.
function makeNewSingleQueue(): Queue {
  singleQueue = new Queue({ concurrency: 1 });
  return singleQueue;
}
function makeNewMultipleQueue(): Queue {
  multipleQueue = new Queue({ concurrency: 10 });
  return multipleQueue;
}

const DEBUG = false;

function makeSQLJob(
  fn: ServerInterface[keyof ServerInterface],
  args: Array<unknown>,
  callName: keyof ServerInterface
) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`SQL(${callName}) queued`);
  }
  return async () => {
    sqlQueries += 1;
    const start = Date.now();
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`SQL(${callName}) started`);
    }
    let result;
    try {
      // Ignoring this error TS2556: Expected 3 arguments, but got 0 or more.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      result = await fn(...args);
    } finally {
      sqlQueries -= 1;
      if (allQueriesDone && sqlQueries <= 0) {
        allQueriesDone();
      }
    }
    const end = Date.now();
    const delta = end - start;
    if (DEBUG || delta > 10) {
      // eslint-disable-next-line no-console
      console.log(`SQL(${callName}) succeeded in ${end - start}ms`);
    }
    return result;
  };
}

async function handleCall(
  fn: ServerInterface[keyof ServerInterface],
  args: Array<unknown>,
  callName: keyof ServerInterface
) {
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
      result = await singleQueue.add(makeSQLJob(fn, args, callName));
    } else if (multipleQueue) {
      const queue = makeNewSingleQueue();

      const multipleQueueLocal = multipleQueue;
      queue.add(() => multipleQueueLocal.onIdle());
      multipleQueue = null;

      result = await queue.add(makeSQLJob(fn, args, callName));
    } else {
      const queue = makeNewSingleQueue();
      result = await queue.add(makeSQLJob(fn, args, callName));
    }
  } else {
    // The request can be parallelized. To keep the same structure as the above block
    //   we force this section into the 'lonely if' pattern.
    // eslint-disable-next-line no-lonely-if
    if (multipleQueue) {
      result = await multipleQueue.add(makeSQLJob(fn, args, callName));
    } else if (singleQueue) {
      const queue = makeNewMultipleQueue();
      queue.pause();

      const singleQueueRef = singleQueue;

      singleQueue = null;
      const promise = queue.add(makeSQLJob(fn, args, callName));
      if (singleQueueRef) {
        await singleQueueRef.onIdle();
      }

      queue.start();
      result = await promise;
    } else {
      const queue = makeNewMultipleQueue();
      result = await queue.add(makeSQLJob(fn, args, callName));
    }
  }

  return result;
}

export async function waitForPendingQueries(): Promise<void> {
  return new Promise<void>(resolve => {
    if (sqlQueries === 0) {
      resolve();
    } else {
      allQueriesDone = () => resolve();
    }
  });
}

export function applyQueueing(dataInterface: ServerInterface): ServerInterface {
  return Object.keys(dataInterface).reduce((acc, callName) => {
    const serverInterfaceKey = callName as keyof ServerInterface;
    acc[serverInterfaceKey] = async (...args: Array<unknown>) =>
      handleCall(dataInterface[serverInterfaceKey], args, serverInterfaceKey);
    return acc;
  }, {} as ServerInterface);
}
