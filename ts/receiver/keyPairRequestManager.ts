import { PubKey } from '../session/types';
import { SECONDS } from '../session/utils/Number';

/**
 * Singleton handling the logic behing requesting EncryptionKeypair for a closed group we need.
 *
 * Nothing is read/written to the db, it's all on memory for now.
 */
export class KeyPairRequestManager {
  public static DELAY_BETWEEN_TWO_REQUEST_MS = SECONDS * 30;
  private static instance: KeyPairRequestManager | null;
  private readonly requestTimestamps: Map<string, number>;

  private constructor() {
    this.requestTimestamps = new Map();
  }

  public static getInstance() {
    if (KeyPairRequestManager.instance) {
      return KeyPairRequestManager.instance;
    }
    KeyPairRequestManager.instance = new KeyPairRequestManager();
    return KeyPairRequestManager.instance;
  }

  public reset() {
    this.requestTimestamps.clear();
  }

  public markRequestSendFor(pubkey: PubKey, timestamp: number) {
    this.requestTimestamps.set(pubkey.key, timestamp);
  }

  public get(pubkey: PubKey) {
    return this.requestTimestamps.get(pubkey.key);
  }

  public canTriggerRequestWith(pubkey: PubKey) {
    const record = this.requestTimestamps.get(pubkey.key);
    if (!record) {
      return true;
    }

    const now = Date.now();
    return now - record >= KeyPairRequestManager.DELAY_BETWEEN_TWO_REQUEST_MS;
  }
}
