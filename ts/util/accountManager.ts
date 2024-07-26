import { isEmpty } from 'lodash';
import { getConversationController } from '../session/conversations';
import { getSodiumRenderer } from '../session/crypto';
import { ed25519Str, fromArrayBufferToBase64, fromHex, toHex } from '../session/utils/String';
import { configurationMessageReceived, trigger } from '../shims/events';

import { SessionButtonColor } from '../components/basic/SessionButton';
import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { deleteAllLogs } from '../node/logs';
import { SessionKeyPair } from '../receiver/keypairs';
import { clearInbox } from '../session/apis/open_group_api/sogsv3/sogsV3ClearInbox';
import { getAllValidOpenGroupV2ConversationRoomInfos } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { getSwarmPollingInstance } from '../session/apis/snode_api';
import { SnodeAPI } from '../session/apis/snode_api/SNodeAPI';
import { mnDecode, mnEncode } from '../session/crypto/mnemonic';
import { getOurPubKeyStrFromCache } from '../session/utils/User';
import { LibSessionUtil } from '../session/utils/libsession/libsession_utils';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/sync/syncUtils';
import { updateConfirmModal, updateDeleteAccountModal } from '../state/ducks/modalDialog';
import { actions as userActions } from '../state/ducks/user';
import { Registration } from './registration';
import { Storage, saveRecoveryPhrase, setLocalPubKey, setSignInByLinking } from './storage';
import { ConversationTypeEnum } from '../models/types';

/**
 * Might throw
 */
export async function sessionGenerateKeyPair(seed: ArrayBuffer): Promise<SessionKeyPair> {
  const sodium = await getSodiumRenderer();

  const ed25519KeyPair = sodium.crypto_sign_seed_keypair(new Uint8Array(seed));
  const x25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519KeyPair.publicKey);
  // prepend version byte (coming from `processKeys(raw_keys)`)
  const origPub = new Uint8Array(x25519PublicKey);
  const prependedX25519PublicKey = new Uint8Array(33);
  prependedX25519PublicKey.set(origPub, 1);
  prependedX25519PublicKey[0] = 5;
  const x25519SecretKey = sodium.crypto_sign_ed25519_sk_to_curve25519(ed25519KeyPair.privateKey);

  // prepend with 05 the public key
  const x25519KeyPair = {
    pubKey: prependedX25519PublicKey.buffer,
    privKey: x25519SecretKey.buffer,
    ed25519KeyPair,
  };

  return x25519KeyPair;
}

const generateKeypair = async (
  mnemonic: string,
  mnemonicLanguage: string
): Promise<SessionKeyPair> => {
  let seedHex = mnDecode(mnemonic, mnemonicLanguage);
  // handle shorter than 32 bytes seeds
  const privKeyHexLength = 32 * 2;
  if (seedHex.length !== privKeyHexLength) {
    seedHex = seedHex.concat('0'.repeat(32));
    seedHex = seedHex.substring(0, privKeyHexLength);
  }
  const seed = fromHex(seedHex);
  return sessionGenerateKeyPair(seed);
};

/**
 * This registers a user account. It can also be used if an account restore fails and the user instead registers a new display name
 * @param mnemonic The mnemonic generated on first app loading and to use for this brand new user
 * @param mnemonicLanguage only 'english' is supported
 * @param displayName the display name to register
 * @param registerCallback when restoring an account, registration completion is handled elsewhere so we need to pass the pubkey back up to the caller
 */
export async function registerSingleDevice(
  generatedMnemonic: string,
  mnemonicLanguage: string,
  displayName: string,
  registerCallback?: (pubkey: string) => Promise<void>
) {
  if (isEmpty(generatedMnemonic)) {
    throw new Error('Session always needs a mnemonic. Either generated or given by the user');
  }
  if (isEmpty(mnemonicLanguage)) {
    throw new Error('We always need a mnemonicLanguage');
  }
  if (isEmpty(displayName)) {
    throw new Error('We always need a displayName');
  }

  const identityKeyPair = await generateKeypair(generatedMnemonic, mnemonicLanguage);

  await createAccount(identityKeyPair);
  await saveRecoveryPhrase(generatedMnemonic);

  const pubKeyString = toHex(identityKeyPair.pubKey);
  if (isEmpty(pubKeyString)) {
    throw new Error("We don't have a pubkey from the recovery password...");
  }

  if (registerCallback) {
    await registerCallback(pubKeyString);
  } else {
    await registrationDone(pubKeyString, displayName);
  }
}

/**
 * Restores a users account with their recovery password and try to recover display name and avatar from the first encountered configuration message.
 * @param mnemonic the mnemonic the user duly saved in a safe place. We will restore his sessionID based on this.
 * @param mnemonicLanguage 'english' only is supported
 * @param loadingAnimationCallback a callback to trigger a loading animation while fetching
 *
 * @returns the display name of the user if found on the network
 */
export async function signInByLinkingDevice(
  mnemonic: string,
  mnemonicLanguage: string,
  abortSignal?: AbortSignal
) {
  if (isEmpty(mnemonic)) {
    throw new Error('Session always needs a mnemonic. Either generated or given by the user');
  }
  if (isEmpty(mnemonicLanguage)) {
    throw new Error('We always need a mnemonicLanguage');
  }

  const identityKeyPair = await generateKeypair(mnemonic, mnemonicLanguage);

  await setSignInByLinking(true);
  await createAccount(identityKeyPair);
  await saveRecoveryPhrase(mnemonic);

  const pubKeyString = toHex(identityKeyPair.pubKey);

  if (isEmpty(pubKeyString)) {
    throw new Error("We don't have a pubkey from the recovery password...");
  }

  const displayName = await getSwarmPollingInstance().pollOnceForOurDisplayName(abortSignal);

  // NOTE the registration is not yet finished until the configurationMessageReceived event has been processed
  trigger(configurationMessageReceived, pubKeyString, displayName);
  // for testing purposes
  return { displayName, pubKeyString };
}

export async function generateMnemonic() {
  // Note: 4 bytes are converted into 3 seed words, so length 12 seed words
  // (13 - 1 checksum) are generated using 12 * 4 / 3 = 16 bytes.
  const seedSize = 16;
  const seed = (await getSodiumRenderer()).randombytes_buf(seedSize);
  const hex = toHex(seed);
  return mnEncode(hex);
}

async function createAccount(identityKeyPair: SessionKeyPair) {
  const sodium = await getSodiumRenderer();

  let password = fromArrayBufferToBase64(sodium.randombytes_buf(16));
  password = password.substring(0, password.length - 2);

  await Promise.all([
    Storage.remove('identityKey'),
    Storage.remove('signaling_key'),
    Storage.remove('password'),
    Storage.remove('registrationId'),
    Storage.remove('number_id'),
    Storage.remove('device_name'),
    Storage.remove('userAgent'),
    Storage.remove('regionCode'),
    Storage.remove('local_attachment_encrypted_key'),
    Storage.remove(SettingsKey.settingsReadReceipt),
    Storage.remove(SettingsKey.settingsTypingIndicator),
    Storage.remove(SettingsKey.hideRecoveryPassword),
  ]);

  // update our own identity key, which may have changed
  // if we're relinking after a reinstall on the master device
  const pubKeyString = toHex(identityKeyPair.pubKey);

  await Storage.put('identityKey', identityKeyPair);
  await Storage.put('password', password);

  // disable read-receipt by default
  await Storage.put(SettingsKey.settingsReadReceipt, false);

  // Enable typing indicators by default
  await Storage.put(SettingsKey.settingsTypingIndicator, false);

  // opengroups pruning in ON by default on new accounts, but you can change that from the settings
  await Storage.put(SettingsKey.settingsOpengroupPruning, true);
  await window.setOpengroupPruning(true);

  // turn off hide recovery password by default
  await Storage.put(SettingsKey.hideRecoveryPassword, false);

  await setLocalPubKey(pubKeyString);
}

/**
 * When a user sucessfully registers, we need to initialise the libession wrappers and create a conversation for the user
 * @param ourPubkey the pubkey recovered from the seed
 * @param displayName the display name entered by the user. Can be what is fetched from the last config message or what is entered manually by the user
 */
export async function registrationDone(ourPubkey: string, displayName: string) {
  window?.log?.info(
    `[onboarding] registration done with user provided displayName "${displayName}" and pubkey "${ourPubkey}"`
  );

  // initializeLibSessionUtilWrappers needs our publicKey to be set
  await Storage.put('primaryDevicePubKey', ourPubkey);
  await Registration.markDone();

  try {
    await LibSessionUtil.initializeLibSessionUtilWrappers();
  } catch (e) {
    window.log.warn(
      '[onboarding] registration done but LibSessionUtil.initializeLibSessionUtilWrappers failed with',
      e.message || e
    );
    throw e;
  }

  // Ensure that we always have a conversation for ourself
  const conversation = await getConversationController().getOrCreateAndWait(
    ourPubkey,
    ConversationTypeEnum.PRIVATE
  );
  conversation.setSessionDisplayNameNoCommit(displayName);

  await conversation.setIsApproved(true, false);
  await conversation.setDidApproveMe(true, false);
  // when onboarding, hide the note to self by default.
  await conversation.setHidden(true);
  await conversation.commit();

  const user = {
    ourDisplayNameInProfile: displayName,
    ourNumber: getOurPubKeyStrFromCache(),
    ourPrimary: ourPubkey,
  };
  window.inboxStore?.dispatch(userActions.userChanged(user));

  window?.log?.info('[onboarding] dispatching registration event');
  // this will make the poller start fetching messages
  trigger('registration_done');
}

export const deleteDbLocally = async () => {
  window?.log?.info('last message sent successfully. Deleting everything');
  await window.persistStore?.purge();
  window?.log?.info('store purged');

  await deleteAllLogs();
  window?.log?.info('deleteAllLogs: done');

  await Data.removeAll();
  window?.log?.info('Data.removeAll: done');

  await Data.close();
  window?.log?.info('Data.close: done');
  await Data.removeDB();
  window?.log?.info('Data.removeDB: done');

  await Data.removeOtherData();
  window?.log?.info('Data.removeOtherData: done');

  window.localStorage.setItem('restart-reason', 'delete-account');
};

export async function sendConfigMessageAndDeleteEverything() {
  try {
    // DELETE LOCAL DATA ONLY, NOTHING ON NETWORK
    window?.log?.info('DeleteAccount => Sending a last SyncConfiguration');

    // be sure to wait for the message being effectively sent. Otherwise we won't be able to encrypt it for our devices !
    await forceSyncConfigurationNowIfNeeded(true);
    window?.log?.info('Last configuration message sent!');
    await deleteDbLocally();
  } catch (error) {
    // if an error happened, it's not related to the delete everything on network logic as this is handled above.
    // this could be a last sync configuration message not being sent.
    // in all case, we delete everything, and restart
    window?.log?.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
    try {
      await deleteDbLocally();
    } catch (e) {
      window?.log?.error(e);
    }
  } finally {
    window.restart();
  }
}

export async function deleteEverythingAndNetworkData() {
  try {
    // DELETE EVERYTHING ON NETWORK, AND THEN STUFF LOCALLY STORED
    // a bit of duplicate code below, but it's easier to follow every case like that (helped with returns)

    // clear all sogs inboxes (includes message requests)
    const allRoomInfos = await getAllValidOpenGroupV2ConversationRoomInfos();
    const allRoomInfosArray = Array.from(allRoomInfos?.values() || []);

    if (allRoomInfosArray.length) {
      // clear each inbox per sogs

      const clearInboxPromises = allRoomInfosArray.map(async roomInfo => {
        const success = await clearInbox(roomInfo);
        if (!success) {
          throw Error(`Failed to clear inbox for ${roomInfo.conversationId}`);
        }
        return true;
      });

      const results = await Promise.allSettled(clearInboxPromises);
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          window.log.error(result.reason);
        } else {
          window.log.info('Inbox cleared for room', allRoomInfosArray[index]);
        }
      });
    }

    // send deletion message to the network
    const potentiallyMaliciousSnodes = await SnodeAPI.forceNetworkDeletion();
    if (potentiallyMaliciousSnodes === null) {
      window?.log?.warn('DeleteAccount => forceNetworkDeletion failed');

      // close this dialog
      window?.inboxStore?.dispatch(updateDeleteAccountModal(null));
      window?.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedDesc'),
          okTheme: SessionButtonColor.Danger,
          okText: window.i18n('deviceOnly'),
          onClickOk: async () => {
            await deleteDbLocally();
            window.restart();
          },
          onClickClose: () => {
            window.inboxStore?.dispatch(updateConfirmModal(null));
          },
        })
      );
      return;
    }

    if (potentiallyMaliciousSnodes.length > 0) {
      const snodeStr = potentiallyMaliciousSnodes.map(ed25519Str);
      window?.log?.warn(
        'DeleteAccount => forceNetworkDeletion Got some potentially malicious snodes',
        snodeStr
      );
      // close this dialog
      window?.inboxStore?.dispatch(updateDeleteAccountModal(null));
      // open a new confirm dialog to ask user what to do
      window?.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('dialogClearAllDataDeletionFailedTitle'),
          message: window.i18n('dialogClearAllDataDeletionFailedMultiple', [
            potentiallyMaliciousSnodes.join(', '),
          ]),
          messageSub: window.i18n('dialogClearAllDataDeletionFailedTitleQuestion'),
          okTheme: SessionButtonColor.Danger,
          okText: window.i18n('deviceOnly'),
          onClickOk: async () => {
            await deleteDbLocally();
            window.restart();
          },
          onClickClose: () => {
            window.inboxStore?.dispatch(updateConfirmModal(null));
          },
        })
      );
      return;
    }

    // We removed everything on the network successfully (no malicious node!). Now delete the stuff we got locally
    // without sending a last configuration message (otherwise this one will still be on the network)
    await deleteDbLocally();
    window.restart();
  } catch (error) {
    // if an error happened, it's not related to the delete everything on network logic as this is handled above.
    // this could be a last sync configuration message not being sent.
    // in all case, we delete everything, and restart
    window?.log?.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
    try {
      await deleteDbLocally();
    } catch (e) {
      window?.log?.error(e);
    }
    window.restart();
  }
}
