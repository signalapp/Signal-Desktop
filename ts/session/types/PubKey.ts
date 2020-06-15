export class PubKey {
  public static readonly PUBKEY_LEN = 66;
  private static readonly regex: RegExp = new RegExp(
    `^05[0-9a-fA-F]{${PubKey.PUBKEY_LEN - 2}}$`
  );
  public readonly key: string;

  constructor(pubkeyString: string) {
    PubKey.validate(pubkeyString);
    this.key = pubkeyString;
  }

  public static from(pubkeyString: string): PubKey | undefined {
    // Returns a new instance if the pubkey is valid
    if (PubKey.validate(pubkeyString)) {
      return new PubKey(pubkeyString);
    }

    return undefined;
  }

  public static validate(pubkeyString: string): boolean {
    if (this.regex.test(pubkeyString)) {
      return true;
    }

    return false;
  }

  public static isEqual(key: PubKey, comparator: PubKey) {
    return key.key === comparator.key;
  }
}
