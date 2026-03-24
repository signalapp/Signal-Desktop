/* ==========================
   PQWrapper.ts – FULL MODULE
   ==========================
   Key behavior (LOCAL TEST MODE):
   - Each client swrites its own PQ pubkey into a shared folder once it knows its serviceId.
   - When sending:
       if we have their key -> send [PQ][version][kemLen][kemCt][nonce][encrypted(plaintext)]
       if we don't -> send [HANDSHAKE][PLAINTEXT] (still decodes on receiver)
   - When receiving:
       if [HANDSHAKE] -> store sender pubkey, return trailing plaintext
       else if [PQ] -> decrypt and return plaintext
       else passthrough
*/

import { randomBytes } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { PQ_SHARED_DIR, keyPathForServiceId } from './pqSharedDir';
import { performance } from 'perf_hooks';
import { benchLog } from './pqBenchmarkLogger';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { gcm } from '@noble/ciphers/aes.js';

/* ---------- CONSTANTS ---------- */

export const PQ_VERSION = 2; // bumped: real ML-KEM-768 + AES-256-GCM
export const ML_KEM_PUBLIC_KEY_LENGTH = ml_kem768.lengths.publicKey; // 1184
export const ML_KEM_SECRET_KEY_LENGTH = ml_kem768.lengths.secretKey; // 2400
export const ML_KEM_CIPHERTEXT_LENGTH = ml_kem768.lengths.cipherText; // 1088
export const PQ_ENABLED = true; // <-- flip to false for baseline

const NONCE_LENGTH = 12; // AES-GCM nonce

// “Kind” byte to avoid version/flag collisions
const KIND_HANDSHAKE = 0x01;
const KIND_PQ = 0x02;

/* ---------- TYPES ---------- */

type PQKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array; // ML-KEM secret key (2400 bytes for ML-KEM-768)
};

export type WrapOutgoingResult = {
  wrapped: Uint8Array;
  mode: 'passthrough' | 'handshake+plaintext' | 'pq';
};

/* =======================
   PQCrypto CLASS
   ======================= */

export class PQCrypto {
  /* ---------- STORAGE ---------- */
  private theirKeys = new Map<string, Uint8Array>();
  private ourKeyPair: PQKeyPair | null = null;
  private initPromise: Promise<void> | null = null;

  /* ---------- LOCAL TEST: OUR SERVICE ID ---------- */
  private ourServiceId: string | null = null;

  /* ---------- DEBUG ---------- */
  private debug = false;
  private dlog(...args: unknown[]) {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[PQ]', ...args);
    }
  }
  public setDebug(enabled: boolean) {
    this.debug = enabled;
    this.dlog('debug enabled');
  }

  /* ---------- NORMALIZATION ---------- */
  private normalizeServiceId(serviceId: string): string {
    return String(serviceId).trim().toLowerCase();
  }

  public setOurServiceId(serviceId: string) {
    const normalized = this.normalizeServiceId(serviceId);

    // Already set → do nothing
    if (this.ourServiceId === normalized) {
      return;
    }

    this.ourServiceId = normalized;
    this.dlog('setOurServiceId', { serviceId, normalized });

    void this.publishOurPublicKeyToSharedDir().catch(e => {
      this.dlog('publishOurPublicKeyToSharedDir failed (non-fatal)', e);
    });
  }

  /* ---------- INITIALIZATION ---------- */

  public async initPQ(): Promise<void> {
    if (this.ourKeyPair) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        const { publicKey, secretKey } = ml_kem768.keygen();
        this.ourKeyPair = { publicKey, secretKey };
        this.dlog('initialized (ML-KEM-768)', { pubLen: publicKey.length, skLen: secretKey.length });

        // Try to publish (no-op if ourServiceId not set yet).
        await this.publishOurPublicKeyToSharedDir();
      })();
    }

    await this.initPromise;
  }

  /* ---------- KEY ACCESS ---------- */

  public async getOurPublicKey(): Promise<Uint8Array> {
    await this.initPQ();
    if (!this.ourKeyPair) throw new Error('PQ not initialized');
    return this.ourKeyPair.publicKey;
  }

  public async getTheirPublicKey(serviceId: string): Promise<Uint8Array | null> {
    const normalized = this.normalizeServiceId(serviceId);
    return this.theirKeys.get(normalized) ?? null;
  }

  public async storeTheirPublicKey(serviceId: string, key: Uint8Array): Promise<void> {
    const normalized = this.normalizeServiceId(serviceId);

    if (key.length !== ML_KEM_PUBLIC_KEY_LENGTH) {
      this.dlog('storeTheirPublicKey: rejected length', {
        serviceId,
        normalized,
        got: key.length,
        expected: ML_KEM_PUBLIC_KEY_LENGTH,
      });
      return;
    }

    // Store a copy to avoid holding a view into a larger buffer.
    const copy = new Uint8Array(key.length);
    copy.set(key);

    this.theirKeys.set(normalized, copy);
    this.dlog('storeTheirPublicKey: stored', {
      serviceId,
      normalized,
      len: copy.length,
      totalKeys: this.theirKeys.size,
    });
  }

  /* ---------- SHARED DIR I/O (LOCAL TEST) ---------- */

  private async ensureSharedDir(): Promise<void> {
    await mkdir(PQ_SHARED_DIR, { recursive: true });
  }

  private async publishOurPublicKeyToSharedDir(): Promise<void> {
    // If we don't yet know our serviceId, skip.
    if (!this.ourServiceId) {
      this.dlog('publishOurPublicKeyToSharedDir: no ourServiceId set');
      return;
    }

    // If not yet initialized, initPQ() will call us again after key generation.
    if (!this.ourKeyPair) {
      this.dlog('publishOurPublicKeyToSharedDir: PQ not initialized yet');
      return;
    }

    await this.ensureSharedDir();

    const pub = this.ourKeyPair.publicKey;
    const filePath = keyPathForServiceId(this.ourServiceId);

    await writeFile(filePath, Buffer.from(pub));
    this.dlog('publishOurPublicKeyToSharedDir: wrote', {
      ourServiceId: this.ourServiceId,
      filePath,
      len: pub.length,
    });
  }

  private async maybeLoadTheirKeyFromSharedDir(normalizedRecipientServiceId: string): Promise<void> {
    if (this.theirKeys.has(normalizedRecipientServiceId)) return;

    try {
      await this.ensureSharedDir();

      const filePath = keyPathForServiceId(normalizedRecipientServiceId);
      const buf = await readFile(filePath);

      const key = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      await this.storeTheirPublicKey(normalizedRecipientServiceId, key);

      this.dlog('maybeLoadTheirKeyFromSharedDir: loaded', {
        recipient: normalizedRecipientServiceId,
        filePath,
        len: key.length,
      });
    } catch (_e) {
      // Expected when the file doesn't exist yet.
      this.dlog('maybeLoadTheirKeyFromSharedDir: not found', {
        recipient: normalizedRecipientServiceId,
      });
    }
  }

  /* ---------- REAL ML-KEM-768 ENCAPSULATE / DECAPSULATE ---------- */

  private encapsulate(theirPub: Uint8Array): { kemCt: Uint8Array; sharedSecret: Uint8Array } {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(theirPub);

    this.dlog('encapsulate (ML-KEM-768)', {
      ctLen: cipherText.length,
      ssLen: sharedSecret.length,
      ct0: Buffer.from(cipherText.slice(0, 6)).toString('hex'),
      ss0: Buffer.from(sharedSecret.slice(0, 6)).toString('hex'),
    });

    return { kemCt: cipherText, sharedSecret };
  }

  private decapsulate(secretKey: Uint8Array, kemCt: Uint8Array): Uint8Array {
    const sharedSecret = ml_kem768.decapsulate(kemCt, secretKey);

    this.dlog('decapsulate (ML-KEM-768)', {
      ctLen: kemCt.length,
      ssLen: sharedSecret.length,
      ct0: Buffer.from(kemCt.slice(0, 6)).toString('hex'),
      ss0: Buffer.from(sharedSecret.slice(0, 6)).toString('hex'),
    });

    return sharedSecret;
  }

  /* ---------- REAL AES-256-GCM ENCRYPT / DECRYPT ---------- */

  private encrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Uint8Array {
    // AES-256-GCM: returns ciphertext + 16-byte auth tag
    const cipher = gcm(key, nonce);
    return cipher.encrypt(plaintext);
  }

  private decrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    // AES-256-GCM: verifies auth tag, throws on tamper
    const cipher = gcm(key, nonce);
    return cipher.decrypt(ciphertext);
  }

    /* =======================
      OUTGOING WRAP
      ======================= */

    public async wrapOutgoing(
    recipientServiceId: string,
    plaintext: Uint8Array
  ): Promise<WrapOutgoingResult> {
    await this.initPQ();

    if (!PQ_ENABLED) {
      return { wrapped: plaintext, mode: 'passthrough' };
    }

    const normalized = this.normalizeServiceId(recipientServiceId);

    await this.maybeLoadTheirKeyFromSharedDir(normalized);
    const theirPub = await this.getTheirPublicKey(normalized);

    if (theirPub) {
      const tTotalStart = performance.now();

      const tEncapStart = performance.now();
      const { kemCt, sharedSecret } = this.encapsulate(theirPub);
      const tEncapEnd = performance.now();

      const nonce = randomBytes(NONCE_LENGTH);

      const tSymStart = performance.now();
      const encrypted = this.encrypt(sharedSecret, nonce, plaintext);
      const tSymEnd = performance.now();

      const out = new Uint8Array(
        1 + 1 + 2 + kemCt.length + nonce.length + encrypted.length
      );

      let o = 0;
      out[o++] = KIND_PQ;
      out[o++] = PQ_VERSION;
      out[o++] = (kemCt.length >> 8) & 0xff;
      out[o++] = kemCt.length & 0xff;
      out.set(kemCt, o);
      o += kemCt.length;
      out.set(nonce, o);
      o += nonce.length;
      out.set(encrypted, o);

      const tTotalEnd = performance.now();
      const pqEncapsulateMs = +(tEncapEnd - tEncapStart).toFixed(3);
      const pqSymmetricEncryptMs = +(tSymEnd - tSymStart).toFixed(3);
      const pqTotalWrapMs = +(tTotalEnd - tTotalStart).toFixed(3);

      this.dlog('[TIMING][PQ][SEND]', {
        pqEncapsulateMs,
        pqSymmetricEncryptMs,
        pqTotalWrapMs,
        plainLen: plaintext.length,
        outLen: out.length,
      });

      await benchLog({
        ts: Date.now(),
        side: 'send',
        stage: 'PQ_SEND',
        serviceId: recipientServiceId,
        values: {
          pqEncapsulateMs,
          pqSymmetricEncryptMs,
          pqTotalWrapMs,
          plainLen: plaintext.length,
          outLen: out.length,
        },
      });
      
      return { wrapped: out, mode: 'pq' };
    }

    // Handshake path unchanged
    const myPub = await this.getOurPublicKey();
    const handshake = new Uint8Array(1 + ML_KEM_PUBLIC_KEY_LENGTH);
    handshake[0] = KIND_HANDSHAKE;
    handshake.set(myPub, 1);

    const combined = new Uint8Array(handshake.length + plaintext.length);
    combined.set(handshake, 0);
    combined.set(plaintext, handshake.length);

    return { wrapped: combined, mode: 'handshake+plaintext' };
  }

    /* =======================
      INCOMING UNWRAP
      ======================= */

  public async unwrapIncoming(
    senderServiceId: string,
    ciphertext: Uint8Array
  ): Promise<Uint8Array> {
    await this.initPQ();

    if (!PQ_ENABLED) {
      return ciphertext;
    } 

    if (ciphertext.length === 0) return ciphertext;

    let offset = 0;
    const kind = ciphertext[offset++];

    if (kind === KIND_HANDSHAKE) {
      if (ciphertext.length < 1 + ML_KEM_PUBLIC_KEY_LENGTH) {
        return ciphertext;
      }

      const senderKey = ciphertext.slice(offset, offset + ML_KEM_PUBLIC_KEY_LENGTH);
      offset += ML_KEM_PUBLIC_KEY_LENGTH;

      await this.storeTheirPublicKey(senderServiceId, senderKey);
      return ciphertext.slice(offset);
    }

    if (kind !== KIND_PQ) {
      return ciphertext;
    }

    const version = ciphertext[offset++];
    if (version !== PQ_VERSION) return ciphertext;

    const kemLen = (ciphertext[offset++] << 8) | ciphertext[offset++];
    const kemCt = ciphertext.slice(offset, offset + kemLen);
    offset += kemLen;

    const nonce = ciphertext.slice(offset, offset + NONCE_LENGTH);
    offset += NONCE_LENGTH;

    const encrypted = ciphertext.slice(offset);

    if (!this.ourKeyPair) throw new Error('Missing PQ secret key');

    const tTotalStart = performance.now();

    const tDecapStart = performance.now();
    const sharedSecret = this.decapsulate(this.ourKeyPair.secretKey, kemCt);
    const tDecapEnd = performance.now();

    const tSymStart = performance.now();
    const plain = this.decrypt(sharedSecret, nonce, encrypted);
    const tSymEnd = performance.now();

    const tTotalEnd = performance.now();

    const pqDecapsulateMs = +(tDecapEnd - tDecapStart).toFixed(3);
    const pqSymmetricDecryptMs = +(tSymEnd - tSymStart).toFixed(3);
    const pqTotalUnwrapMs = +(tTotalEnd - tTotalStart).toFixed(3);

    this.dlog('[TIMING][PQ][RECV]', {
      pqDecapsulateMs,
      pqSymmetricDecryptMs,
      pqTotalUnwrapMs,
      cipherLen: ciphertext.length,
      plainLen: plain.length,
    });

    await benchLog({
      ts: Date.now(),
      side: 'recv',
      stage: 'PQ_RECV',
      serviceId: senderServiceId,
      values: {
        pqDecapsulateMs,
        pqSymmetricDecryptMs,
        pqTotalUnwrapMs,
        cipherLen: ciphertext.length,
        plainLen: plain.length,
      },
    });
    return plain;
  }

}

/* ---------- DEFAULT INSTANCE ---------- */

export const pqCrypto = new PQCrypto();

