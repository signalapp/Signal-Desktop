import _ from 'lodash';
import { UserConfigWrapper } from 'session_util_wrapper';
import { ConfigWrapperObjectTypes } from '../../browser/libsession_worker_functions';
import { default as sodiumWrappers } from 'libsodium-wrappers-sumo';

/* eslint-disable no-console */
/* eslint-disable strict */

let userConfig: UserConfigWrapper;

/* eslint-disable strict */

async function getSodiumWorker() {
  await sodiumWrappers.ready;

  return sodiumWrappers;
}

async function getCorrespondingWrapper(config: ConfigWrapperObjectTypes) {
  if (config !== 'UserConfig') {
    throw new Error(`Invalid config: ${config}`);
  }
  const sodium = await getSodiumWorker();
  if (!userConfig) {
    const edSecretKey = sodium.from_hex(
      '0123456789abcdef0123456789abcdef000000000000000000000000000000004cb76fdc6d32278e3f83dbf608360ecc6b65727934b85d2fb86862ff98c46ab7'
    );

    userConfig = new UserConfigWrapper(edSecretKey, null);
  }
  return userConfig;
}

// tslint:disable: function-name
//tslint-disable no-console
onmessage = async (e: { data: [number, ConfigWrapperObjectTypes, string, ...any] }) => {
  const [jobId, config, action, ...args] = e.data;

  try {
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
