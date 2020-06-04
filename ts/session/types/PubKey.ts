
import * as crypto from 'crypto';

export enum PubKeyCategory {
  Primary = 'priamry',
  Secondary = 'secondary',
  Group = 'group',
}

export class PubKey {
  private static readonly PUBKEY_LEN = 66;
  private static readonly regex: string = `^05[0-9a-fA-F]{${PubKey.PUBKEY_LEN - 2}}$`;
  public readonly key: string;
  public type?: PubKeyCategory;

  constructor(pubkeyString: string, type?: PubKeyCategory) {
    PubKey.validate(pubkeyString);
    this.key = pubkeyString;
    this.type = type;
  }

  public static from(pubkeyString: string): PubKey | undefined {
    // Returns a new instance if the pubkey is valid
    if (PubKey.validate(pubkeyString)) {
      return new PubKey(pubkeyString);
    }

    return undefined;
  }

  public static validate(pubkeyString: string): boolean {
    if (pubkeyString.match(PubKey.regex)) {
      return true;
    }

    return false;
  }

  public static generateFake(): PubKey {
    // Generates a mock pubkey for testing
    const numBytes = (PubKey.PUBKEY_LEN / 2) - 1;
    const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
    const pubkeyString = `05${hexBuffer}`;

    return new PubKey(pubkeyString);
  }
}
