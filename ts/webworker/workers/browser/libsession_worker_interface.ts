import { join } from 'path';
import { getAppRootPath } from '../../../node/getRootPath';
import { WorkerInterface } from '../../worker_interface';
import { ConfigWrapperObjectTypes, LibSessionWorkerFunctions } from './libsession_worker_functions';

import {
  BaseWrapperActionsCalls,
  ContactInfo,
  ContactsWrapperActionsCalls,
  ConvoInfoVolatileWrapperActionsCalls,
  LegacyGroupInfo,
  UserConfigWrapperActionsCalls,
  UserGroupsWrapperActionsCalls,
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
  confirmPushed: async (wrapperId: ConfigWrapperObjectTypes, seqno: number, hash: string) =>
    callLibSessionWorker([wrapperId, 'confirmPushed', seqno, hash]) as ReturnType<
      BaseWrapperActionsCalls['confirmPushed']
    >,
  dump: async (wrapperId: ConfigWrapperObjectTypes) =>
    callLibSessionWorker([wrapperId, 'dump']) as Promise<
      ReturnType<BaseWrapperActionsCalls['dump']>
    >,
  merge: async (
    wrapperId: ConfigWrapperObjectTypes,
    toMerge: Array<{ hash: string; data: Uint8Array }>
  ) =>
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
  confirmPushed: async (seqno: number, hash: string) =>
    GenericWrapperActions.confirmPushed('UserConfig', seqno, hash),
  dump: async () => GenericWrapperActions.dump('UserConfig'),
  merge: async (toMerge: Array<{ hash: string; data: Uint8Array }>) =>
    GenericWrapperActions.merge('UserConfig', toMerge),
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
  confirmPushed: async (seqno: number, hash: string) =>
    GenericWrapperActions.confirmPushed('ContactsConfig', seqno, hash),
  dump: async () => GenericWrapperActions.dump('ContactsConfig'),
  merge: async (toMerge: Array<{ hash: string; data: Uint8Array }>) =>
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
  getOrConstruct: async (pubkeyHex: string) =>
    callLibSessionWorker(['ContactsConfig', 'getOrConstruct', pubkeyHex]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['getOrConstruct']>
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

export const UserGroupsWrapperActions: UserGroupsWrapperActionsCalls = {
  /* Reuse the GenericWrapperActions with the ContactConfig argument */
  init: async (ed25519Key: Uint8Array, dump: Uint8Array | null) =>
    GenericWrapperActions.init('UserGroupsConfig', ed25519Key, dump),
  confirmPushed: async (seqno: number, hash: string) =>
    GenericWrapperActions.confirmPushed('UserGroupsConfig', seqno, hash),
  dump: async () => GenericWrapperActions.dump('UserGroupsConfig'),
  merge: async (toMerge: Array<{ hash: string; data: Uint8Array }>) =>
    GenericWrapperActions.merge('UserGroupsConfig', toMerge),
  needsDump: async () => GenericWrapperActions.needsDump('UserGroupsConfig'),
  needsPush: async () => GenericWrapperActions.needsPush('UserGroupsConfig'),
  push: async () => GenericWrapperActions.push('UserGroupsConfig'),
  storageNamespace: async () => GenericWrapperActions.storageNamespace('UserGroupsConfig'),

  /** UserGroups wrapper specific actions */

  getCommunityByFullUrl: async (fullUrlWithOrWithoutPubkey: string) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'getCommunityByFullUrl',
      fullUrlWithOrWithoutPubkey,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['getCommunityByFullUrl']>>,

  setCommunityByFullUrl: async (fullUrl: string, priority: number) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'setCommunityByFullUrl',
      fullUrl,
      priority,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['setCommunityByFullUrl']>>,

  getAllCommunities: async () =>
    callLibSessionWorker(['UserGroupsConfig', 'getAllCommunities']) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['getAllCommunities']>
    >,

  eraseCommunityByFullUrl: async (fullUrlWithoutPubkey: string) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'eraseCommunityByFullUrl',
      fullUrlWithoutPubkey,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['eraseCommunityByFullUrl']>>,

  buildFullUrlFromDetails: async (baseUrl: string, roomId: string, pubkeyHex: string) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'buildFullUrlFromDetails',
      baseUrl,
      roomId,
      pubkeyHex,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['buildFullUrlFromDetails']>>,

  getLegacyGroup: async (pubkeyHex: string) =>
    callLibSessionWorker(['UserGroupsConfig', 'getLegacyGroup', pubkeyHex]) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['getLegacyGroup']>
    >,
  getAllLegacyGroups: async () =>
    callLibSessionWorker(['UserGroupsConfig', 'getAllLegacyGroups']) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['getAllLegacyGroups']>
    >,

  setLegacyGroup: async (info: LegacyGroupInfo) =>
    callLibSessionWorker(['UserGroupsConfig', 'setLegacyGroup', info]) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['setLegacyGroup']>
    >,

  eraseLegacyGroup: async (pubkeyHex: string) =>
    callLibSessionWorker(['UserGroupsConfig', 'eraseLegacyGroup', pubkeyHex]) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['eraseLegacyGroup']>
    >,
};

export const ConvoInfoVolatileWrapperActions: ConvoInfoVolatileWrapperActionsCalls = {
  /* Reuse the GenericWrapperActions with the ContactConfig argument */
  init: async (ed25519Key: Uint8Array, dump: Uint8Array | null) =>
    GenericWrapperActions.init('ConvoInfoVolatileConfig', ed25519Key, dump),
  confirmPushed: async (seqno: number, hash: string) =>
    GenericWrapperActions.confirmPushed('ConvoInfoVolatileConfig', seqno, hash),
  dump: async () => GenericWrapperActions.dump('ConvoInfoVolatileConfig'),
  merge: async (toMerge: Array<{ hash: string; data: Uint8Array }>) =>
    GenericWrapperActions.merge('ConvoInfoVolatileConfig', toMerge),
  needsDump: async () => GenericWrapperActions.needsDump('ConvoInfoVolatileConfig'),
  needsPush: async () => GenericWrapperActions.needsPush('ConvoInfoVolatileConfig'),
  push: async () => GenericWrapperActions.push('ConvoInfoVolatileConfig'),
  storageNamespace: async () => GenericWrapperActions.storageNamespace('ConvoInfoVolatileConfig'),

  /** ConvoInfoVolatile wrapper specific actions */
  // 1o1
  get1o1: async (pubkeyHex: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'get1o1', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['get1o1']>
    >,

  getAll1o1: async () =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getAll1o1']) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getAll1o1']>
    >,

  set1o1: async (pubkeyHex: string, lastRead: number, unread: boolean) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'set1o1',
      pubkeyHex,
      lastRead,
      unread,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['set1o1']>>,

  // legacy groups
  getLegacyGroup: async (pubkeyHex: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getLegacyGroup', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getLegacyGroup']>
    >,

  getAllLegacyGroups: async () =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getAllLegacyGroups']) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getAllLegacyGroups']>
    >,

  setLegacyGroup: async (pubkeyHex: string, lastRead: number, unread: boolean) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'setLegacyGroup',
      pubkeyHex,
      lastRead,
      unread,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['setLegacyGroup']>>,

  // communities
  getCommunity: async (communityFullUrl: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getCommunity', communityFullUrl]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getCommunity']>
    >,

  getAllCommunities: async () =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getAllCommunities']) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getAllCommunities']>
    >,

  setCommunityByFullUrl: async (fullUrlWithPubkey: string, lastRead: number, unread: boolean) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'setCommunityByFullUrl',
      fullUrlWithPubkey,
      lastRead,
      unread,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['setCommunityByFullUrl']>>,
};

const callLibSessionWorker = async (callToMake: LibSessionWorkerFunctions): Promise<unknown> => {
  return internalCallLibSessionWorker(callToMake);
};
