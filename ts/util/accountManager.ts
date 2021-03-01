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
  let seedHex = window.mnemonic.mn_decode(mnemonic, mnemonicLanguage);
  // handle shorter than 32 bytes seeds
  const privKeyHexLength = 32 * 2;
  if (seedHex.length !== privKeyHexLength) {
    seedHex = seedHex.concat('0'.repeat(32));
    seedHex = seedHex.substring(0, privKeyHexLength);
  }
  const seed = fromHex(seedHex);
  console.warn('generateKeypair seedHex', seedHex);
  console.warn('generateKeypair seed', seed);
  return sessionGenerateKeyPair(seed);
};

// TODO not sure why AccountManager was a singleton before. Can we get rid of it as a singleton?
// tslint:disable-next-line: no-unnecessary-class
export class AccountManager {
  public static async registerSingleDevice(
    mnemonic: string,
    mnemonicLanguage: string,
    profileName: string
  ) {
    const createAccount = this.createAccount.bind(this);
    const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
    const registrationDone = this.registrationDone.bind(this);
    if (!mnemonic) {
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

    const identityKeyPair = await generateKeypair(mnemonic, mnemonicLanguage);
    await createAccount(identityKeyPair);
    UserUtils.saveRecoveryPhrase(mnemonic);
    await clearSessionsAndPreKeys();
    const pubKeyString = toHex(identityKeyPair.pubKey);
    await registrationDone(pubKeyString, profileName);
  }

  public static async generateMnemonic(language = 'english') {
    // Note: 4 bytes are converted into 3 seed words, so length 12 seed words
    // (13 - 1 checksum) are generated using 12 * 4 / 3 = 16 bytes.
    const seedSize = 16;
    const seed = window.Signal.Crypto.getRandomBytes(seedSize);
    const hex = toHex(seed);
    return window.mnemonic.mn_encode(hex, language);
  }

  public static async clearSessionsAndPreKeys() {
    window.log.info('clearing all sessions');
    // During secondary device registration we need to keep our prekeys sent
    // to other pubkeys
    await Promise.all([
      window.Signal.Data.removeAllPreKeys(),
      window.Signal.Data.removeAllSignedPreKeys(),
      window.Signal.Data.removeAllContactPreKeys(),
      window.Signal.Data.removeAllContactSignedPreKeys(),
      window.Signal.Data.removeAllSessions(),
    ]);
  }

  private static async createAccount(identityKeyPair: any) {
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

  private static async registrationDone(number: string, displayName: string) {
    window.log.info('registration done');

    window.textsecure.storage.put('primaryDevicePubKey', number);

    // Ensure that we always have a conversation for ourself
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      number,
      'private'
    );
    await conversation.setLokiProfile({ displayName });
    const user = {
      ourNumber: getOurPubKeyStrFromCache(),
      ourPrimary: window.textsecure.storage.get('primaryDevicePubKey'),
    };
    trigger('userChanged', user);

    window.Whisper.Registration.markDone();
    window.log.info('dispatching registration event');
    trigger('registration_done');
  }
}
