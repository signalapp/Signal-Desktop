import { ConversationController } from '../session/conversations';
import { getSodium } from '../session/crypto';
import { UserUtils } from '../session/utils';
import {
  fromArrayBufferToBase64,
  fromHex,
  toHex,
} from '../session/utils/String';
import { getOurPubKeyStrFromCache } from '../session/utils/User';
import { trigger } from '../shims/events';
import {
  removeAllContactPreKeys,
  removeAllContactSignedPreKeys,
  removeAllPreKeys,
  removeAllSessions,
  removeAllSignedPreKeys,
} from '../data/data';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/syncUtils';
import { actions as userActions } from '../state/ducks/user';
import { mn_decode, mn_encode } from '../session/crypto/mnemonic';
import { ConversationType } from '../models/conversation';

/**
 * Might throw
 */
export async function sessionGenerateKeyPair(
  seed: ArrayBuffer
): Promise<{ pubKey: ArrayBufferLike; privKey: ArrayBufferLike }> {
  const sodium = await getSodium();
  const ed25519KeyPair = sodium.crypto_sign_seed_keypair(new Uint8Array(seed));
  const x25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(
    ed25519KeyPair.publicKey
  );
  // prepend version byte (coming from `processKeys(raw_keys)`)
  const origPub = new Uint8Array(x25519PublicKey);
  const prependedX25519PublicKey = new Uint8Array(33);
  prependedX25519PublicKey.set(origPub, 1);
  prependedX25519PublicKey[0] = 5;
  const x25519SecretKey = sodium.crypto_sign_ed25519_sk_to_curve25519(
    ed25519KeyPair.privateKey
  );

  // prepend with 05 the public key
  const x25519KeyPair = {
    pubKey: prependedX25519PublicKey.buffer,
    privKey: x25519SecretKey.buffer,
    ed25519KeyPair,
  };

  return x25519KeyPair;
}

const generateKeypair = async (mnemonic: string, mnemonicLanguage: string) => {
  let seedHex = mn_decode(mnemonic, mnemonicLanguage);
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
export async function signInByLinkingDevice(
  mnemonic: string,
  mnemonicLanguage: string
) {
  if (!mnemonic) {
    throw new Error(
      'Session always needs a mnemonic. Either generated or given by the user'
    );
  }
  if (!mnemonicLanguage) {
    throw new Error('We always needs a mnemonicLanguage');
  }

  const identityKeyPair = await generateKeypair(mnemonic, mnemonicLanguage);
  UserUtils.setSignInByLinking(true);
  await createAccount(identityKeyPair);
  UserUtils.saveRecoveryPhrase(mnemonic);
  await clearSessionsAndPreKeys();
  const pubKeyString = toHex(identityKeyPair.pubKey);

  // await for the first configuration message to come in.
  await registrationDone(pubKeyString, '');
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
    throw new Error(
      'Session always needs a mnemonic. Either generated or given by the user'
    );
  }
  if (!profileName) {
    throw new Error('We always needs a profileName');
  }
  if (!mnemonicLanguage) {
    throw new Error('We always needs a mnemonicLanguage');
  }

  const identityKeyPair = await generateKeypair(
    generatedMnemonic,
    mnemonicLanguage
  );

  await createAccount(identityKeyPair);
  UserUtils.saveRecoveryPhrase(generatedMnemonic);
  await clearSessionsAndPreKeys();
  await UserUtils.setLastProfileUpdateTimestamp(Date.now());

  const pubKeyString = toHex(identityKeyPair.pubKey);
  await registrationDone(pubKeyString, profileName);
}

export async function generateMnemonic() {
  // Note: 4 bytes are converted into 3 seed words, so length 12 seed words
  // (13 - 1 checksum) are generated using 12 * 4 / 3 = 16 bytes.
  const seedSize = 16;
  const seed = (await getSodium()).randombytes_buf(seedSize);
  const hex = toHex(seed);
  return mn_encode(hex);
}

export async function clearSessionsAndPreKeys() {
  window.log.info('clearing all sessions');
  // During secondary device registration we need to keep our prekeys sent
  // to other pubkeys
  await Promise.all([
    removeAllPreKeys(),
    removeAllSignedPreKeys(),
    removeAllContactPreKeys(),
    removeAllContactSignedPreKeys(),
    removeAllSessions(),
  ]);
}

export async function deleteAccount(reason?: string) {
  const deleteEverything = async () => {
    window.log.info(
      'configuration message sent successfully. Deleting everything'
    );
    await window.Signal.Logs.deleteAll();
    await window.Signal.Data.removeAll();
    await window.Signal.Data.close();
    await window.Signal.Data.removeDB();
    await window.Signal.Data.removeOtherData();
    // 'unlink' => toast will be shown on app restart
    window.localStorage.setItem('restart-reason', reason || '');
  };
  try {
    window.log.info('DeleteAccount => Sending a last SyncConfiguration');
    // be sure to wait for the message being effectively sent. Otherwise we won't be able to encrypt it for our devices !
    await forceSyncConfigurationNowIfNeeded(true);
    window.log.info('Last configuration message sent!');
    await deleteEverything();
  } catch (error) {
    window.log.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
    try {
      await deleteEverything();
    } catch (e) {
      window.log.error(e);
    }
  }
  window.restart();
}

async function createAccount(identityKeyPair: any) {
  const sodium = await getSodium();
  let password = fromArrayBufferToBase64(sodium.randombytes_buf(16));
  password = password.substring(0, password.length - 2);

  await Promise.all([
    window.textsecure.storage.remove('identityKey'),
    window.textsecure.storage.remove('signaling_key'),
    window.textsecure.storage.remove('password'),
    window.textsecure.storage.remove('registrationId'),
    window.textsecure.storage.remove('number_id'),
    window.textsecure.storage.remove('device_name'),
    window.textsecure.storage.remove('userAgent'),
    window.textsecure.storage.remove('read-receipt-setting'),
    window.textsecure.storage.remove('typing-indicators-setting'),
    window.textsecure.storage.remove('regionCode'),
  ]);

  // update our own identity key, which may have changed
  // if we're relinking after a reinstall on the master device
  const pubKeyString = toHex(identityKeyPair.pubKey);

  await window.textsecure.storage.put('identityKey', identityKeyPair);
  await window.textsecure.storage.put('password', password);
  await window.textsecure.storage.put('read-receipt-setting', false);

  // Enable typing indicators by default
  await window.textsecure.storage.put(
    'typing-indicators-setting',
    Boolean(true)
  );

  await window.textsecure.storage.user.setNumberAndDeviceId(pubKeyString, 1);
}

async function registrationDone(ourPubkey: string, displayName: string) {
  window.log.info('registration done');

  window.textsecure.storage.put('primaryDevicePubKey', ourPubkey);

  // Ensure that we always have a conversation for ourself
  const conversation = await ConversationController.getInstance().getOrCreateAndWait(
    ourPubkey,
    ConversationType.PRIVATE
  );
  await conversation.setLokiProfile({ displayName });
  const user = {
    ourNumber: getOurPubKeyStrFromCache(),
    ourPrimary: window.textsecure.storage.get('primaryDevicePubKey'),
  };
  window.inboxStore?.dispatch(userActions.userChanged(user));
  window.Whisper.Registration.markDone();
  window.log.info('dispatching registration event');
  trigger('registration_done');
}
