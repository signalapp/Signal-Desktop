import { difference, omit } from 'lodash';
import Long from 'long';
import { UserUtils } from '..';
import { ConfigDumpData } from '../../../data/configDump/configDump';
import { SignalService } from '../../../protobuf';
import { ConfigWrapperObjectTypes } from '../../../webworker/workers/browser/libsession_worker_functions';
import {
  GenericWrapperActions,
  UserConfigWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { GetNetworkTime } from '../../apis/snode_api/getNetworkTime';
import { SnodeNamespaces } from '../../apis/snode_api/namespaces';
import { SharedConfigMessage } from '../../messages/outgoing/controlMessage/SharedConfigMessage';
import { ConfigurationSync } from '../job_runners/jobs/ConfigurationSyncJob';
import { SessionUtilContact } from './libsession_utils_contacts';
import { SessionUtilUserProfile } from './libsession_utils_user_profile';

// TODO complete this list
const requiredUserDumpVariants: Array<ConfigWrapperObjectTypes> = ['UserConfig', 'ContactsConfig']; // 'conversations'

export type IncomingConfResult = {
  needsPush: boolean;
  needsDump: boolean;
  messageHashes: Array<string>;
  latestSentTimestamp: number;
};

export type OutgoingConfResult = {
  message: SharedConfigMessage;
  namespace: SnodeNamespaces;
  destination: string;
  oldMessageHashes: Array<string>;
};

/**
 * Right after we migrated, we won't have any dumps in DB. We must create them from our database state,
 */
async function createConfigDumpsFromDbFirstStart(
  privateKeyEd25519: Uint8Array
): Promise<Array<ConfigWrapperObjectTypes>> {
  const justCreated: Array<ConfigWrapperObjectTypes> = [];
  try {
    console.error(
      'createConfigDumpsFromDbFirstStart should be removed as this would done in a migration'
    );

    // build the userconfig
    await UserConfigWrapperActions.init(privateKeyEd25519, null);
    await SessionUtilUserProfile.insertUserProfileIntoWrapper();
    const data = await UserConfigWrapperActions.dump();
    // save it to the DB
    await ConfigDumpData.saveConfigDump({
      combinedMessageHashes: [],
      data,
      publicKey: UserUtils.getOurPubKeyStrFromCache(),
      variant: 'UserConfig',
    });
    justCreated.push('UserConfig');
  } catch (e) {
    window.log.warn('Failed to init the UserConfig with createConfigDumpsFromDbFirstStart');
  }

  if (justCreated.length > 0) {
    setTimeout(() => ConfigurationSync.queueNewJobIfNeeded, 3000);
  }
  return justCreated;
}

async function initializeLibSessionUtilWrappers() {
  const keypair = await UserUtils.getUserED25519KeyPairBytes();
  if (!keypair || !keypair.privKeyBytes) {
    throw new Error('edkeypair not found for current user');
  }
  const privateKeyEd25519 = keypair.privKeyBytes;
  let dumps = await ConfigDumpData.getAllDumpsWithData();

  let createdDuringFirstStart: Array<ConfigWrapperObjectTypes> = [];
  if (!dumps?.length) {
    createdDuringFirstStart = await createConfigDumpsFromDbFirstStart(privateKeyEd25519);
  }

  // refetch them as the createConfigDumpsFromDb might have created them
  dumps = await ConfigDumpData.getAllDumpsWithData();
  console.warn(
    'dumps',
    dumps.map(m => omit(m, 'data'))
  );

  const userVariantsBuildWithoutErrors = new Set<ConfigWrapperObjectTypes>();

  for (let index = 0; index < dumps.length; index++) {
    const dump = dumps[index];
    console.warn('for loop init', dump.variant);
    try {
      if (!createdDuringFirstStart.includes(dump.variant)) {
        await GenericWrapperActions.init(
          dump.variant,
          privateKeyEd25519,
          dump.data.length ? dump.data : null
        );
      }
      userVariantsBuildWithoutErrors.add(dump.variant);
    } catch (e) {
      window.log.warn(`init of UserConfig failed with ${e.message} `);
      throw new Error(`initializeLibSessionUtilWrappers failed with ${e.message}`);
    }
  }

  console.warn('requiredVariants: FIXME add conversation volatile wrapper as required ');

  const missingRequiredVariants: Array<ConfigWrapperObjectTypes> = difference(
    requiredUserDumpVariants,
    [...userVariantsBuildWithoutErrors.values()]
  );

  if (missingRequiredVariants.length) {
    throw new Error(`missingRequiredVariants: ${JSON.stringify(missingRequiredVariants)}`);
  }

  for (let index = 0; index < missingRequiredVariants.length; index++) {
    const missingVariant = missingRequiredVariants[index];
    await GenericWrapperActions.init(missingVariant, privateKeyEd25519, null);
  }
}

async function pendingChangesForPubkey(pubkey: string): Promise<Array<OutgoingConfResult>> {
  const dumps = await ConfigDumpData.getAllDumpsWithoutData();
  const us = UserUtils.getOurPubKeyStrFromCache();

  // Ensure we always check the required user config types for changes even if there is no dump
  // data yet (to deal with first launch cases)
  if (pubkey === us) {
    LibSessionUtil.requiredUserDumpVariants.forEach(requiredVariant => {
      if (!dumps.find(m => m.publicKey === us && m.variant === requiredVariant)) {
        dumps.push({
          publicKey: us,
          variant: requiredVariant,
          combinedMessageHashes: [],
        });
      }
    });
  }

  const results: Array<OutgoingConfResult> = [];

  for (let index = 0; index < dumps.length; index++) {
    const dump = dumps[index];
    const variant = dump.variant;
    const needsPush = await GenericWrapperActions.needsPush(variant);
    if (!needsPush) {
      continue;
    }

    const { data, seqno } = await GenericWrapperActions.push(variant);
    const kind = variantToKind(variant);
    const namespace = await GenericWrapperActions.storageNamespace(variant);
    results.push({
      destination: pubkey,
      message: new SharedConfigMessage({
        data,
        kind,
        seqno: Long.fromNumber(seqno),
        timestamp: GetNetworkTime.getNowWithNetworkOffset(),
      }),
      oldMessageHashes: dump.combinedMessageHashes,
      namespace,
    });
  }

  return results;
}

function kindToVariant(kind: SignalService.SharedConfigMessage.Kind): ConfigWrapperObjectTypes {
  switch (kind) {
    case SignalService.SharedConfigMessage.Kind.USER_PROFILE:
      return 'UserConfig';
    case SignalService.SharedConfigMessage.Kind.CONTACTS:
      return 'ContactsConfig';
    default:
      throw new Error(`kindToVariant: Unsupported variant: "${kind}"`);
  }
}

function variantToKind(variant: ConfigWrapperObjectTypes): SignalService.SharedConfigMessage.Kind {
  switch (variant) {
    case 'UserConfig':
      return SignalService.SharedConfigMessage.Kind.USER_PROFILE;
    case 'ContactsConfig':
      return SignalService.SharedConfigMessage.Kind.CONTACTS;
    default:
      throw new Error(`variantToKind: Unsupported variant: "${variant}"`);
  }
}

/**
 * Returns true if the config needs to be dumped afterwards
 */
async function markAsPushed(variant: ConfigWrapperObjectTypes, pubkey: string, seqno: number) {
  if (pubkey !== UserUtils.getOurPubKeyStrFromCache()) {
    throw new Error('FIXME, generic case is to be done');
  }
  await GenericWrapperActions.confirmPushed(variant, seqno);
  return GenericWrapperActions.needsDump(variant);
}

export const LibSessionUtil = {
  initializeLibSessionUtilWrappers,
  requiredUserDumpVariants,
  pendingChangesForPubkey,
  insertUserProfileIntoWrapper: SessionUtilUserProfile.insertUserProfileIntoWrapper,
  insertAllContactsIntoContactsWrapper: SessionUtilContact.insertAllContactsIntoContactsWrapper,
  kindToVariant,
  markAsPushed,
};
