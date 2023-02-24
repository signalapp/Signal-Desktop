import _, { isEmpty, isNull } from 'lodash';
import {
  BaseConfigWrapper,
  BaseConfigWrapperInsideWorker,
  ContactsConfigWrapperInsideWorker,
  UserConfigWrapperInsideWorker,
  UserGroupsWrapperInsideWorker,
} from 'session_util_wrapper';
import { ConfigWrapperObjectTypes } from '../../browser/libsession_worker_functions';

/* eslint-disable no-console */
/* eslint-disable strict */

// we can only have one of those so don't worry about storing them in a map for now
let userProfileWrapper: UserConfigWrapperInsideWorker | undefined;
let contactsConfigWrapper: ContactsConfigWrapperInsideWorker | undefined;
let userGroupsConfigWrapper: UserGroupsWrapperInsideWorker | undefined;

type UserWrapperType = 'UserConfig' | 'ContactsConfig' | 'UserGroupsConfig';

function getUserWrapper(type: UserWrapperType): BaseConfigWrapperInsideWorker | undefined {
  switch (type) {
    case 'UserConfig':
      return userProfileWrapper;
    case 'ContactsConfig':
      return contactsConfigWrapper;
    case 'UserGroupsConfig':
      return userGroupsConfigWrapper;
  }
}

function getCorrespondingWrapper(
  wrapperType: ConfigWrapperObjectTypes
): BaseConfigWrapperInsideWorker {
  switch (wrapperType) {
    case 'UserConfig':
    case 'ContactsConfig':
    case 'UserGroupsConfig':
      const wrapper = getUserWrapper(wrapperType);
      if (!wrapper) {
        throw new Error(`${wrapperType} is not init yet`);
      }
      return wrapper;
  }
}

function isUInt8Array(value: any) {
  return value.constructor === Uint8Array;
}

function assertUserWrapperType(wrapperType: ConfigWrapperObjectTypes): UserWrapperType {
  if (
    wrapperType !== 'ContactsConfig' &&
    wrapperType !== 'UserConfig' &&
    wrapperType !== 'UserGroupsConfig'
  ) {
    throw new Error(`wrapperType "${wrapperType} is not of type User"`);
  }
  return wrapperType;
}

/**
 * This function can be used to initialize a wrapper which takes the private ed25519 key of the user and a dump as argument.
 */
function initUserWrapper(options: Array<any>, wrapperType: UserWrapperType): BaseConfigWrapper {
  const wrapper = getUserWrapper(wrapperType);
  console.warn('initUserWrapper: ', wrapperType);
  if (wrapper) {
    throw new Error(`${wrapperType} already init`);
  }
  if (options.length !== 2) {
    throw new Error(`${wrapperType} init needs two arguments`);
  }
  const [edSecretKey, dump] = options;

  if (isEmpty(edSecretKey) || !isUInt8Array(edSecretKey)) {
    throw new Error(`${wrapperType} init needs a valid edSecretKey`);
  }

  if (!isNull(dump) && !isUInt8Array(dump)) {
    throw new Error(`${wrapperType} init needs a valid dump`);
  }
  const userType = assertUserWrapperType(wrapperType);
  switch (userType) {
    case 'UserConfig':
      userProfileWrapper = new UserConfigWrapperInsideWorker(edSecretKey, dump);
      return userProfileWrapper;
    case 'ContactsConfig':
      contactsConfigWrapper = new ContactsConfigWrapperInsideWorker(edSecretKey, dump);
      return contactsConfigWrapper;
    case 'UserGroupsConfig':
      userGroupsConfigWrapper = new UserGroupsWrapperInsideWorker(edSecretKey, dump);
      return userGroupsConfigWrapper;
  }
}

// tslint:disable: function-name no-console

onmessage = async (e: { data: [number, ConfigWrapperObjectTypes, string, ...any] }) => {
  const [jobId, config, action, ...args] = e.data;

  try {
    if (action === 'init') {
      initUserWrapper(args, config);
      postMessage([jobId, null, null]);
      return;
    }

    const wrapper = getCorrespondingWrapper(config);
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
