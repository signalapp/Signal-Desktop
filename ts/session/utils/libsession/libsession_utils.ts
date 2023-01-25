import { difference } from 'lodash';
import { UserUtils } from '..';
import { ConfigDumpData } from '../../../data/configDump/configDump';
import { ConfigWrapperObjectTypes } from '../../../webworker/workers/browser/libsession_worker_functions';
import { callLibSessionWorker } from '../../../webworker/workers/browser/libsession_worker_interface';

export async function initializeLibSessionUtilWrappers() {
  const keypair = await UserUtils.getUserED25519KeyPairBytes();
  if (!keypair) {
    throw new Error('edkeypair not found for current user');
  }
  const privateKeyEd25519 = keypair.privKeyBytes;
  const dumps = await ConfigDumpData.getAllDumpsWithData();

  const userVariantsBuildWithoutErrors = new Set<ConfigWrapperObjectTypes>();

  for (let index = 0; index < dumps.length; index++) {
    const dump = dumps[index];
    try {
      await callLibSessionWorker([
        dump.variant,
        'init',
        privateKeyEd25519,
        dump.data.length ? dump.data : null,
      ]);

      userVariantsBuildWithoutErrors.add(dump.variant);
    } catch (e) {
      window.log.warn(`init of UserConfig failed with ${e.message} `);
      throw new Error(`initializeLibSessionUtilWrappers failed with ${e.message}`);
    }
  }

  // TODO complete this list
  const requiredVariants: Array<ConfigWrapperObjectTypes> = ['UserConfig', 'ContactsConfig']; // 'conversations'
  const missingRequiredVariants: Array<ConfigWrapperObjectTypes> = difference(requiredVariants, [
    ...userVariantsBuildWithoutErrors.values(),
  ]);

  for (let index = 0; index < missingRequiredVariants.length; index++) {
    const missingVariant = missingRequiredVariants[index];
    await callLibSessionWorker([missingVariant, 'init', privateKeyEd25519, null]);
  }
}
