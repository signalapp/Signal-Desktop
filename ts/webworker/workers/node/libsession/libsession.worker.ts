/* eslint-disable consistent-return */
/* eslint-disable no-case-declarations */
import { isEmpty, isNull } from 'lodash';
import {
  BaseConfigWrapperNode,
  ContactsConfigWrapperNode,
  ConvoInfoVolatileWrapperNode,
  UserConfigWrapperNode,
  UserGroupsWrapperNode,
} from 'libsession_util_nodejs';
// eslint-disable-next-line import/no-unresolved, import/extensions
import { ConfigWrapperObjectTypes } from '../../browser/libsession_worker_functions';

/* eslint-disable no-console */
/* eslint-disable strict */

/**
 *
 * @param _x Looks like we need to duplicate this function here as we cannot import the existing one from a webworker context
 */
function assertUnreachable(_x: never, message: string): never {
  console.info(`assertUnreachable: Didn't expect to get here with "${message}"`);
  throw new Error("Didn't expect to get here");
}

// we can only have one of those so don't worry about storing them in a map for now
let userProfileWrapper: UserConfigWrapperNode | undefined;
let contactsConfigWrapper: ContactsConfigWrapperNode | undefined;
let userGroupsConfigWrapper: UserGroupsWrapperNode | undefined;
let convoInfoVolatileConfigWrapper: ConvoInfoVolatileWrapperNode | undefined;

function getUserWrapper(type: ConfigWrapperObjectTypes): BaseConfigWrapperNode | undefined {
  switch (type) {
    case 'UserConfig':
      return userProfileWrapper;
    case 'ContactsConfig':
      return contactsConfigWrapper;
    case 'UserGroupsConfig':
      return userGroupsConfigWrapper;
    case 'ConvoInfoVolatileConfig':
      return convoInfoVolatileConfigWrapper;
    default:
      assertUnreachable(type, `getUserWrapper: Missing case error "${type}"`);
  }
}

function getCorrespondingWrapper(wrapperType: ConfigWrapperObjectTypes): BaseConfigWrapperNode {
  switch (wrapperType) {
    case 'UserConfig':
    case 'ContactsConfig':
    case 'UserGroupsConfig':
    case 'ConvoInfoVolatileConfig':
      const wrapper = getUserWrapper(wrapperType);
      if (!wrapper) {
        throw new Error(`${wrapperType} is not init yet`);
      }
      return wrapper;
    default:
      assertUnreachable(
        wrapperType,
        `getCorrespondingWrapper: Missing case error "${wrapperType}"`
      );
  }
}

function isUInt8Array(value: any) {
  return value.constructor === Uint8Array;
}

function assertUserWrapperType(wrapperType: ConfigWrapperObjectTypes): ConfigWrapperObjectTypes {
  if (
    wrapperType !== 'ContactsConfig' &&
    wrapperType !== 'UserConfig' &&
    wrapperType !== 'UserGroupsConfig' &&
    wrapperType !== 'ConvoInfoVolatileConfig'
  ) {
    throw new Error(`wrapperType "${wrapperType} is not of type User"`);
  }
  return wrapperType;
}

/**
 * This function can be used to initialize a wrapper which takes the private ed25519 key of the user and a dump as argument.
 */
function initUserWrapper(options: Array<any>, wrapperType: ConfigWrapperObjectTypes) {
  const userType = assertUserWrapperType(wrapperType);

  const wrapper = getUserWrapper(wrapperType);
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
  switch (userType) {
    case 'UserConfig':
      userProfileWrapper = new UserConfigWrapperNode(edSecretKey, dump);
      break;
    case 'ContactsConfig':
      contactsConfigWrapper = new ContactsConfigWrapperNode(edSecretKey, dump);
      break;
    case 'UserGroupsConfig':
      userGroupsConfigWrapper = new UserGroupsWrapperNode(edSecretKey, dump);
      break;
    case 'ConvoInfoVolatileConfig':
      convoInfoVolatileConfigWrapper = new ConvoInfoVolatileWrapperNode(edSecretKey, dump);
      break;
    default:
      assertUnreachable(userType, `initUserWrapper: Missing case error "${userType}"`);
  }
}

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

  // if (error.stack) {
  //   return error.stack;
  // }

  return error.message;
}
