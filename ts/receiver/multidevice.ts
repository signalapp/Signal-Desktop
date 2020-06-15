import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';

async function unpairingRequestIsLegit(source: string, ourPubKey: string) {
  const { textsecure, storage, lokiFileServerAPI } = window;

  const isSecondary = textsecure.storage.get('isSecondaryDevice');
  if (!isSecondary) {
    return false;
  }
  const primaryPubKey = storage.get('primaryDevicePubKey');
  // TODO: allow unpairing from any paired device?
  if (source !== primaryPubKey) {
    return false;
  }

  const primaryMapping = await lokiFileServerAPI.getUserDeviceMapping(
    primaryPubKey
  );

  // If we don't have a mapping on the primary then we have been unlinked
  if (!primaryMapping) {
    return true;
  }

  // We expect the primary device to have updated its mapping
  // before sending the unpairing request
  const found = primaryMapping.authorisations.find(
    (authorisation: any) => authorisation.secondaryDevicePubKey === ourPubKey
  );

  // our pubkey should NOT be in the primary device mapping
  return !found;
}

async function clearAppAndRestart() {
  // remove our device mapping annotations from file server
  await window.lokiFileServerAPI.clearOurDeviceMappingAnnotations();
  // Delete the account and restart
  try {
    await window.Signal.Logs.deleteAll();
    await window.Signal.Data.removeAll();
    await window.Signal.Data.close();
    await window.Signal.Data.removeDB();
    await window.Signal.Data.removeOtherData();
    // TODO generate an empty db with a flag
    // to display a message about the unpairing
    // after the app restarts
  } catch (error) {
    window.log.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
  }
  window.restart();
}

export async function handleUnpairRequest(
  envelope: EnvelopePlus,
  ourPubKey: string
) {
  // TODO: move high-level pairing logic to libloki.multidevice.xx

  const legit = await unpairingRequestIsLegit(envelope.source, ourPubKey);

  removeFromCache(envelope);
  if (legit) {
    await clearAppAndRestart();
  }
}
