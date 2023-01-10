import _, { isEmpty, isNull } from 'lodash';
import { UserConfigWrapper } from 'session_util_wrapper';
import { ConfigWrapperObjectTypes } from '../../browser/libsession_worker_functions';
// import { default as sodiumWrappers } from 'libsodium-wrappers-sumo';

/* eslint-disable no-console */
/* eslint-disable strict */

let userConfig: UserConfigWrapper;

/* eslint-disable strict */

// async function getSodiumWorker() {
//   await sodiumWrappers.ready;

//   return sodiumWrappers;
// }

async function getCorrespondingWrapper(config: ConfigWrapperObjectTypes) {
  if (config !== 'UserConfig') {
    throw new Error(`Invalid config: ${config}`);
  }
  if (!userConfig) {
    throw new Error('UserConfig is not init yet');
  }
  return userConfig;
}

function isUInt8Array(value: any) {
  return value.constructor === Uint8Array;
}

function initUserConfigWrapper(options: Array<any>) {
  if (userConfig) {
    throw new Error('UserConfig already init');
  }
  if (options.length !== 2) {
    throw new Error('UserConfig init needs two arguments');
  }
  const [edSecretKey, dump] = options;

  if (isEmpty(edSecretKey) || !isUInt8Array(edSecretKey)) {
    throw new Error('UserConfig init needs a valid edSecretKey');
  }

  if (!isNull(dump) && !isUInt8Array(dump)) {
    throw new Error('UserConfig init needs a valid dump');
  }
  console.warn('UserConfigWrapper', UserConfigWrapper);
  userConfig = new UserConfigWrapper(edSecretKey, dump);
}

// tslint:disable: function-name
//tslint-disable no-console
onmessage = async (e: { data: [number, ConfigWrapperObjectTypes, string, ...any] }) => {
  const [jobId, config, action, ...args] = e.data;

  try {
    if (action === 'init') {
      initUserConfigWrapper(args);
      postMessage([jobId, null, null]);
      return;
    }

    const wrapper = await getCorrespondingWrapper(config);

    const fn = (wrapper as any)[action];
    if (!fn) {
      throw new Error(
        `Worker: job "${jobId}" did not find function "${action}" on config "${config}"`
      );
    }
    const result = await (wrapper as any)[action](...args);
    postMessage([jobId, null, result]);
  } catch (error) {
    const errorForDisplay = prepareErrorForPostMessage(error);
    postMessage([jobId, errorForDisplay]);
  }
};

function prepareErrorForPostMessage(error: any) {
  if (!error) {
    return null;
  }

  if (error.stack) {
    return error.stack;
  }

  return error.message;
}
