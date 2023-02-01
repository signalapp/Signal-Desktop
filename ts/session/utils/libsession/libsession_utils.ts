import { difference, isEqual } from 'lodash';
import { UserUtils } from '..';
import { ConfigDumpData } from '../../../data/configDump/configDump';
import { ConfigWrapperObjectTypes } from '../../../webworker/workers/browser/libsession_worker_functions';
import {
  GenericWrapperActions,
  UserConfigWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { getConversationController } from '../../conversations';
import { ConfigurationSync } from '../job_runners/jobs/ConfigurationSyncJob';

// TODO complete this list
const requiredVariants: Array<ConfigWrapperObjectTypes> = ['UserConfig', 'ContactsConfig']; // 'conversations'

async function insertUserProfileIntoWrapper() {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = getConversationController().get(us);

  if (!ourConvo) {
    throw new Error('insertUserProfileIntoWrapper needs a ourConvo to exist');
  }
  const currentWrapperName = await UserConfigWrapperActions.getName();
  const currentWrapperProfileUrl = await UserConfigWrapperActions.getProfilePicture();

  const currentDbName = ourConvo.get('displayNameInProfile') || '';
  if (!isEqual(currentDbName, currentWrapperName)) {
    await UserConfigWrapperActions.setName(currentDbName);
  }
}

/**
 * Right after we migrated, we won't have any dumps in DB. We must create them from our database state,
 */
async function createConfigDumpsFromDbFirstStart(privateKeyEd25519: Uint8Array) {
  let countCreated = 0;
  try {
    // build the userconfig
    await UserConfigWrapperActions.init(privateKeyEd25519, null);

    countCreated++;
  } catch (e) {
    window.log.warn('Failed to init the UserConfig with createConfigDumpsFromDbFirstStart');
  }

  if (countCreated > 0) {
    await ConfigurationSync.queueNewJobIfNeeded();
  }
}

async function initializeLibSessionUtilWrappers() {
  const keypair = await UserUtils.getUserED25519KeyPairBytes();
  if (!keypair || !keypair.privKeyBytes) {
    throw new Error('edkeypair not found for current user');
  }
  const privateKeyEd25519 = keypair.privKeyBytes;
  let dumps = await ConfigDumpData.getAllDumpsWithData();

  if (!dumps?.length) {
    await createConfigDumpsFromDbFirstStart(privateKeyEd25519);
  }

  // refetch them as the createConfigDumpsFromDb might have created them
  dumps = await ConfigDumpData.getAllDumpsWithData();

  const userVariantsBuildWithoutErrors = new Set<ConfigWrapperObjectTypes>();

  for (let index = 0; index < dumps.length; index++) {
    const dump = dumps[index];
    try {
      await GenericWrapperActions.init(
        dump.variant,
        privateKeyEd25519,
        dump.data.length ? dump.data : null
      );

      userVariantsBuildWithoutErrors.add(dump.variant);
    } catch (e) {
      window.log.warn(`init of UserConfig failed with ${e.message} `);
      throw new Error(`initializeLibSessionUtilWrappers failed with ${e.message}`);
    }
  }

  console.warn('requiredVariants: FIXME add conversation volatile wrapper as required ');

  const missingRequiredVariants: Array<ConfigWrapperObjectTypes> = difference(requiredVariants, [
    ...userVariantsBuildWithoutErrors.values(),
  ]);

  for (let index = 0; index < missingRequiredVariants.length; index++) {
    const missingVariant = missingRequiredVariants[index];
    await GenericWrapperActions.init(missingVariant, privateKeyEd25519, null);
  }
}

export const LibSessionUtil = { initializeLibSessionUtilWrappers };
