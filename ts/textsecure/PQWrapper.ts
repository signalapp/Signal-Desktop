import { randomBytes } from 'crypto';
import { gcm } from '@noble/ciphers/aes.js';
import * as ML_KEM from '@noble/post-quantum/ml-kem.js';
import { log } from '../logging/log.std'; // FIX RELATIVE PATH IF NEEDED

const PQ_VERSION = 1;
const ML_KEM_PUBLIC_KEY_LENGTH = 1184; // ML-KEM-768 public key size

class PQCrypto {
  private myKeypair?: { publicKey: Uint8Array; secretKey: Uint8Array };
  private theirPublicKeys: Map<string, Uint8Array> = new Map();
  private messageCounts: Map<string, number> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      log.info('[PQ] Already initialized');
      return;
    }

    log.info('[PQ] Initializing PQ crypto system');

    try {
      log.info('[PQ] Generating new PQ keypair (in-memory only)');
      const keypair = ML_KEM.ml_kem768.keygen();

      this.myKeypair = {
        publicKey: keypair.publicKey,
        secretKey: keypair.secretKey,
      };

      this.initialized = true;
      log.info('[PQ] Initialization complete');
    } catch (error) {
      log.error('[PQ] Initialization failed:', error);
      throw error;
    }
  }

  getMyPublicKey(): Uint8Array {
    if (!this.myKeypair) {
      throw new Error('[PQ] Not initialized - call initialize() first');
    }
    return this.myKeypair.publicKey;
  }

  async storeTheirPublicKey(contactId: string, publicKey: Uint8Array): Promise<void> {
    log.info(`[PQ] Storing public key for: ${contactId} (in-memory)`);
    this.theirPublicKeys.set(contactId, publicKey);

    const keys = Array.from(this.theirPublicKeys.keys());
    log.info(`[PQ] Keyring now has ${keys.length} entries: ${keys.join(', ')}`);
  }

  async getTheirPublicKey(contactId: string): Promise<Uint8Array | undefined> {
    const publicKey = this.theirPublicKeys.get(contactId);
    if (!publicKey) {
      log.warn(`[PQ] No public key found for: ${contactId}`);
    }
    return publicKey;
  }

  async wrapOutgoing(
    contactId: string,
    signalCiphertext: Uint8Array
  ): Promise<{ wrapped: Uint8Array; pqPublicKey?: Uint8Array }> {
    log.info(`[PQ] WRAP START for: ${contactId}`);
    log.info(`[PQ] Input length: ${signalCiphertext.length}`);

    if (!this.initialized || !this.myKeypair) {
      log.warn('[PQ] Not initialized, sending unwrapped');

      const result = new Uint8Array(1 + signalCiphertext.length);
      result[0] = 0;
      result.set(signalCiphertext, 1);
      return { wrapped: result };
    }

    log.info(
      `[PQ] wrapOutgoing: looking up key for ${contactId}. Known keys: ${
        Array.from(this.theirPublicKeys.keys()).join(', ') || '(none)'
      }`
    );

    let theirPublicKey = await this.getTheirPublicKey(contactId);

    // DEV FALLBACK: if we only have one key, use it (helps with Alice/Bob mixups in dev)
    if (!theirPublicKey && this.theirPublicKeys.size === 1) {
      const [onlyId, onlyKey] = Array.from(this.theirPublicKeys.entries())[0];
      log.warn(
        `[PQ] No key found for ${contactId}, but exactly one key exists (${onlyId}).` +
          ' Using it as fallback (dev mode).'
      );
      theirPublicKey = onlyKey;
    }

    // Still no key ⇒ send unwrapped + our public key
    if (!theirPublicKey) {
      log.warn('[PQ] No public key for recipient, sending unwrapped with our key');

      const myPublicKey = this.getMyPublicKey();
      const result = new Uint8Array(
        1 + ML_KEM_PUBLIC_KEY_LENGTH + signalCiphertext.length
      );

      result[0] = 1;
      result.set(myPublicKey, 1);
      result.set(signalCiphertext, 1 + ML_KEM_PUBLIC_KEY_LENGTH);

      log.info(`[PQ] Attached our public key, total length: ${result.length}`);
      return { wrapped: result };
    }

    // Normal PQ encrypt
    try {
      log.info('[PQ] Encapsulating with their public key...');
      const { cipherText: kemCiphertext, sharedSecret } =
        ML_KEM.ml_kem768.encapsulate(theirPublicKey);

      log.info('[PQ] Encrypting with AES-GCM...');
      const nonce = randomBytes(12);
      const aes = gcm(sharedSecret.slice(0, 32), nonce);
      const encrypted = aes.encrypt(signalCiphertext);

      // [version][kemLen][kemCt][nonce][encrypted]
      const pqEncrypted = new Uint8Array(
        1 + 2 + kemCiphertext.length + nonce.length + encrypted.length
      );

      let offset = 0;
      pqEncrypted[offset++] = PQ_VERSION;

      const view = new DataView(pqEncrypted.buffer);
      view.setUint16(offset, kemCiphertext.length);
      offset += 2;

      pqEncrypted.set(kemCiphertext, offset);
      offset += kemCiphertext.length;

      pqEncrypted.set(nonce, offset);
      offset += nonce.length;

      pqEncrypted.set(encrypted, offset);

      const count = (this.messageCounts.get(contactId) || 0) + 1;
      this.messageCounts.set(contactId, count);

      const includePublicKey = count % 100 === 1;

      let result: Uint8Array;
      if (includePublicKey) {
        log.info('[PQ] Including our public key for rekeying');

        const myPublicKey = this.getMyPublicKey();
        result = new Uint8Array(
          1 + ML_KEM_PUBLIC_KEY_LENGTH + pqEncrypted.length
        );

        result[0] = 1;
        result.set(myPublicKey, 1);
        result.set(pqEncrypted, 1 + ML_KEM_PUBLIC_KEY_LENGTH);
      } else {
        result = new Uint8Array(1 + pqEncrypted.length);
        result[0] = 0;
        result.set(pqEncrypted, 1);
      }

      log.info(
        `[PQ] WRAP SUCCESS - PQ encrypted length: ${pqEncrypted.length}, ` +
          `total: ${result.length}, count: ${count}`
      );

      return { wrapped: result };
    } catch (error) {
      log.error('[PQ] WRAP FAILED:', error);

      const result = new Uint8Array(1 + signalCiphertext.length);
      result[0] = 0;
      result.set(signalCiphertext, 1);
      return { wrapped: result };
    }
  }

  async unwrapIncoming(
    contactId: string,
    wrappedCiphertext: Uint8Array,
    senderPublicKey?: Uint8Array
  ): Promise<Uint8Array> {
    log.info(`[PQ] UNWRAP START for: ${contactId}`);

    if (wrappedCiphertext.length < 1) {
      log.warn('[PQ] Message too short, returning as-is');
      return wrappedCiphertext;
    }

    const flag = wrappedCiphertext[0];
    if (flag !== 0 && flag !== 1) {
      log.info('[PQ] Does not look like PQ-formatted, returning as-is');
      return wrappedCiphertext;
    }

    const hasPublicKey = flag === 1;
    let offset = 1;

    if (hasPublicKey) {
      if (wrappedCiphertext.length < 1 + ML_KEM_PUBLIC_KEY_LENGTH) {
        log.warn('[PQ] Message claims to have public key but is too short');
        return wrappedCiphertext.slice(1);
      }

      const publicKey = wrappedCiphertext.slice(
        offset,
        offset + ML_KEM_PUBLIC_KEY_LENGTH
      );
      offset += ML_KEM_PUBLIC_KEY_LENGTH;

      log.info('[PQ] Received sender public key, storing');
      await this.storeTheirPublicKey(contactId, publicKey);
    }

    const actualMessage = wrappedCiphertext.slice(offset);

    if (actualMessage.length < 1 || actualMessage[0] !== PQ_VERSION) {
      log.info('[PQ] Not a PQ-wrapped message, returning as-is');
      return actualMessage;
    }

    if (!this.initialized || !this.myKeypair) {
      log.warn('[PQ] Not initialized, cannot unwrap');
      return actualMessage;
    }

    try {
      let msgOffset = 0;
      const version = actualMessage[msgOffset++];

      if (version !== PQ_VERSION) {
        throw new Error(`Unsupported PQ version: ${version}`);
      }

      const view = new DataView(
        actualMessage.buffer,
        actualMessage.byteOffset
      );

      const kemCtLen = view.getUint16(msgOffset);
      msgOffset += 2;

      const kemCt = actualMessage.slice(msgOffset, msgOffset + kemCtLen);
      msgOffset += kemCtLen;

      const nonce = actualMessage.slice(msgOffset, msgOffset + 12);
      msgOffset += 12;

      const encrypted = actualMessage.slice(msgOffset);

      log.info('[PQ] Decapsulating with our secret key...');
      const sharedSecret = ML_KEM.ml_kem768.decapsulate(
        kemCt,
        this.myKeypair.secretKey
      );

      log.info('[PQ] Decrypting with AES-GCM...');
      const aes = gcm(sharedSecret.slice(0, 32), nonce);
      const signalCiphertext = aes.decrypt(encrypted);

      log.info(
        `[PQ] UNWRAP SUCCESS - decrypted ${signalCiphertext.length} bytes`
      );

      return signalCiphertext;
    } catch (error) {
      log.error(`[PQ] UNWRAP FAILED from ${contactId}:`, error);
      return actualMessage;
    }
  }
}

export const pqCrypto = new PQCrypto();

(async () => {
  try {
    await pqCrypto.initialize();
  } catch (e) {
    log.error('[PQ] Failed to initialize PQ crypto', e);
  }
})();

