import { WorkerInterface } from '../../worker_interface';
import { join } from 'path';
import { getAppRootPath } from '../../../node/getRootPath';
import { ConfigWrapperObjectTypes, LibSessionWorkerFunctions } from './libsession_worker_functions';

import {
  BaseWrapperActionsCalls,
  ContactInfo,
  ContactsWrapperActionsCalls,
  UserConfigWrapperActionsCalls,
} from 'session_util_wrapper';

let libsessionWorkerInterface: WorkerInterface | undefined;

const internalCallLibSessionWorker = async ([
  config,
  fnName,
  ...args
]: LibSessionWorkerFunctions): Promise<unknown> => {
  if (!libsessionWorkerInterface) {
    const libsessionWorkerPath = join(
      getAppRootPath(),
      'ts',
      'webworker',
      'workers',
      'node',
      'libsession',
      'libsession.worker.js'
    );

    libsessionWorkerInterface = new WorkerInterface(libsessionWorkerPath, 1 * 60 * 1000);
  }
  return libsessionWorkerInterface?.callWorker(config, fnName, ...args);
};

export const GenericWrapperActions = {
  init: async (
    wrapperId: ConfigWrapperObjectTypes,
    ed25519Key: Uint8Array,
    dump: Uint8Array | null
  ) =>
    /** base wrapper generic actions */
    callLibSessionWorker([wrapperId, 'init', ed25519Key, dump]) as Promise<void>,
  confirmPushed: async (wrapperId: ConfigWrapperObjectTypes, seqno: number) =>
    callLibSessionWorker([wrapperId, 'confirmPushed', seqno]) as ReturnType<
      BaseWrapperActionsCalls['confirmPushed']
    >,
  dump: async (wrapperId: ConfigWrapperObjectTypes) =>
    callLibSessionWorker([wrapperId, 'dump']) as Promise<
      ReturnType<BaseWrapperActionsCalls['dump']>
    >,
  merge: async (wrapperId: ConfigWrapperObjectTypes, toMerge: Array<Uint8Array>) =>
    callLibSessionWorker([wrapperId, 'merge', toMerge]) as Promise<
      ReturnType<BaseWrapperActionsCalls['merge']>
    >,
  needsDump: async (wrapperId: ConfigWrapperObjectTypes) =>
    callLibSessionWorker([wrapperId, 'needsDump']) as Promise<
      ReturnType<BaseWrapperActionsCalls['needsDump']>
    >,
  needsPush: async (wrapperId: ConfigWrapperObjectTypes) =>
    callLibSessionWorker([wrapperId, 'needsPush']) as Promise<
      ReturnType<BaseWrapperActionsCalls['needsPush']>
    >,
  push: async (wrapperId: ConfigWrapperObjectTypes) =>
    callLibSessionWorker([wrapperId, 'push']) as Promise<
      ReturnType<BaseWrapperActionsCalls['push']>
    >,
  storageNamespace: async (wrapperId: ConfigWrapperObjectTypes) =>
    callLibSessionWorker([wrapperId, 'storageNamespace']) as Promise<
      ReturnType<BaseWrapperActionsCalls['storageNamespace']>
    >,
};

export const UserConfigWrapperActions: UserConfigWrapperActionsCalls = {
  /* Reuse the GenericWrapperActions with the UserConfig argument */
  init: async (ed25519Key: Uint8Array, dump: Uint8Array | null) =>
    GenericWrapperActions.init('UserConfig', ed25519Key, dump),
  confirmPushed: async (seqno: number) => GenericWrapperActions.confirmPushed('UserConfig', seqno),
  dump: async () => GenericWrapperActions.dump('UserConfig'),
  merge: async (toMerge: Array<Uint8Array>) => GenericWrapperActions.merge('UserConfig', toMerge),
  needsDump: async () => GenericWrapperActions.needsDump('UserConfig'),
  needsPush: async () => GenericWrapperActions.needsPush('UserConfig'),
  push: async () => GenericWrapperActions.push('UserConfig'),
  storageNamespace: async () => GenericWrapperActions.storageNamespace('UserConfig'),

  /** UserConfig wrapper specific actions */
  getName: async () =>
    callLibSessionWorker(['UserConfig', 'getName']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getName']>
    >,
  getProfilePicture: async () =>
    callLibSessionWorker(['UserConfig', 'getProfilePicture']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProfilePicture']>
    >,
  setName: async (name: string) =>
    callLibSessionWorker(['UserConfig', 'setName', name]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['setName']>
    >,
  setProfilePicture: async (url: string, key: Uint8Array) =>
    callLibSessionWorker(['UserConfig', 'setProfilePicture', url, key]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['setProfilePicture']>
    >,
};

export const ContactsWrapperActions: ContactsWrapperActionsCalls = {
  /* Reuse the GenericWrapperActions with the ContactConfig argument */
  init: async (ed25519Key: Uint8Array, dump: Uint8Array | null) =>
    GenericWrapperActions.init('ContactsConfig', ed25519Key, dump),
  confirmPushed: async (seqno: number) =>
    GenericWrapperActions.confirmPushed('ContactsConfig', seqno),
  dump: async () => GenericWrapperActions.dump('ContactsConfig'),
  merge: async (toMerge: Array<Uint8Array>) =>
    GenericWrapperActions.merge('ContactsConfig', toMerge),
  needsDump: async () => GenericWrapperActions.needsDump('ContactsConfig'),
  needsPush: async () => GenericWrapperActions.needsPush('ContactsConfig'),
  push: async () => GenericWrapperActions.push('ContactsConfig'),
  storageNamespace: async () => GenericWrapperActions.storageNamespace('ContactsConfig'),

  /** ContactsConfig wrapper specific actions */
  get: async (pubkeyHex: string) =>
    callLibSessionWorker(['ContactsConfig', 'get', pubkeyHex]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['get']>
    >,
  getOrCreate: async (pubkeyHex: string) =>
    callLibSessionWorker(['ContactsConfig', 'getOrCreate', pubkeyHex]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['getOrCreate']>
    >,
  getAll: async () =>
    callLibSessionWorker(['ContactsConfig', 'getAll']) as Promise<
      ReturnType<ContactsWrapperActionsCalls['getAll']>
    >,

  erase: async (pubkeyHex: string) =>
    callLibSessionWorker(['ContactsConfig', 'erase', pubkeyHex]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['erase']>
    >,

  set: async (contact: ContactInfo) =>
    callLibSessionWorker(['ContactsConfig', 'set', contact]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['set']>
    >,
  setApproved: async (pubkeyHex: string, approved: boolean) =>
    callLibSessionWorker(['ContactsConfig', 'setApproved', pubkeyHex, approved]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['setApproved']>
    >,
  setApprovedMe: async (pubkeyHex: string, approvedMe: boolean) =>
    callLibSessionWorker(['ContactsConfig', 'setApprovedMe', pubkeyHex, approvedMe]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['setApprovedMe']>
    >,
  setBlocked: async (pubkeyHex: string, blocked: boolean) =>
    callLibSessionWorker(['ContactsConfig', 'setBlocked', pubkeyHex, blocked]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['setBlocked']>
    >,
  setName: async (pubkeyHex: string, name: string) =>
    callLibSessionWorker(['ContactsConfig', 'setName', pubkeyHex, name]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['setName']>
    >,
  setNickname: async (pubkeyHex: string, nickname: string) =>
    callLibSessionWorker(['ContactsConfig', 'setNickname', pubkeyHex, nickname]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['setNickname']>
    >,
  setProfilePicture: async (pubkeyHex: string, url: string, key: Uint8Array) =>
    callLibSessionWorker(['ContactsConfig', 'setProfilePicture', pubkeyHex, url, key]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['setProfilePicture']>
    >,
};

const callLibSessionWorker = async (callToMake: LibSessionWorkerFunctions): Promise<unknown> => {
  return internalCallLibSessionWorker(callToMake);
};
