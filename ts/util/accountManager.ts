import { getConversationController } from '../session/conversations';
import { getSodiumRenderer } from '../session/crypto';
import { fromArrayBufferToBase64, fromHex, toHex } from '../session/utils/String';
import { getOurPubKeyStrFromCache } from '../session/utils/User';
import { trigger } from '../shims/events';

import { actions as userActions } from '../state/ducks/user';
import { mnDecode, mnEncode } from '../session/crypto/mnemonic';
import { SettingsKey } from '../data/settings-key';
import {
  saveRecoveryPhrase,
  setLastProfileUpdateTimestamp,
  setLocalPubKey,
  setSignInByLinking,
  Storage,
} from './storage';
import { Registration } from './registration';
import { ConversationTypeEnum } from '../models/conversationAttributes';
import { SessionKeyPair } from '../receiver/keypairs';
import { LibSessionUtil } from '../session/utils/libsession/libsession_utils';

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
 * Sign in with a recovery phrase. We won't try to recover an existing profile name
 * @param mnemonic the mnemonic the user duly saved in a safe place. We will restore his sessionID based on this.
 * @param mnemonicLanguage 'english' only is supported
 * @param profileName the displayName to use for this user
 */
export async function signInWithRecovery(
  mnemonic: string,
  mnemonicLanguage: string,
  profileName: string
) {
  return registerSingleDevice(mnemonic, mnemonicLanguage, profileName);
}

/**
 * Sign in with a recovery phrase but trying to recover display name and avatar from the first encountered configuration message.
 * @param mnemonic the mnemonic the user duly saved in a safe place. We will restore his sessionID based on this.
 * @param mnemonicLanguage 'english' only is supported
 */
export async function signInByLinkingDevice(mnemonic: string, mnemonicLanguage: string) {
  if (!mnemonic) {
    throw new Error('Session always needs a mnemonic. Either generated or given by the user');
  }
  if (!mnemonicLanguage) {
    throw new Error('We always needs a mnemonicLanguage');
  }

  const identityKeyPair = await generateKeypair(mnemonic, mnemonicLanguage);
  await setSignInByLinking(true);
  await createAccount(identityKeyPair);
  await saveRecoveryPhrase(mnemonic);
  const pubKeyString = toHex(identityKeyPair.pubKey);

  // await for the first configuration message to come in.
  await registrationDone(pubKeyString, '');
  return pubKeyString;
}
/**
 * This is a signup. User has no recovery and does not try to link a device
 * @param mnemonic The mnemonic generated on first app loading and to use for this brand new user
 * @param mnemonicLanguage only 'english' is supported
 * @param profileName the display name to register toi
 */
export async function registerSingleDevice(
  generatedMnemonic: string,
  mnemonicLanguage: string,
  profileName: string
) {
  if (!generatedMnemonic) {
    throw new Error('Session always needs a mnemonic. Either generated or given by the user');
  }
  if (!profileName) {
    throw new Error('We always needs a profileName');
  }
  if (!mnemonicLanguage) {
    throw new Error('We always needs a mnemonicLanguage');
  }

  const identityKeyPair = await generateKeypair(generatedMnemonic, mnemonicLanguage);

  await createAccount(identityKeyPair);
  await saveRecoveryPhrase(generatedMnemonic);
  await setLastProfileUpdateTimestamp(Date.now());

  const pubKeyString = toHex(identityKeyPair.pubKey);
  await registrationDone(pubKeyString, profileName);
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
    Storage.remove(SettingsKey.settingsReadReceipt),
    Storage.remove(SettingsKey.settingsTypingIndicator),
    Storage.remove('regionCode'),
    Storage.remove('local_attachment_encrypted_key'),
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

  await setLocalPubKey(pubKeyString);
}

/**
 *
 * @param ourPubkey the pubkey recovered from the seed
 * @param displayName the display name entered by the user, if any. This is not a display name found from a config message in the network.
 */
async function registrationDone(ourPubkey: string, displayName: string) {
  window?.log?.info(`registration done with user provided displayName "${displayName}"`);

  // initializeLibSessionUtilWrappers needs our publicKey to be set
  await Storage.put('primaryDevicePubKey', ourPubkey);
  await Registration.markDone();

  try {
    await LibSessionUtil.initializeLibSessionUtilWrappers();
  } catch (e) {
    window.log.warn('LibSessionUtil.initializeLibSessionUtilWrappers failed with', e.message);
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

  window?.log?.info('dispatching registration event');
  // this will make the poller start fetching messages, needed to find a configuration message
  trigger('registration_done');
}
