
export class PubKey {
  public static readonly PUBKEY_LEN = 66;
  private static readonly regex: string = `^05[0-9a-fA-F]{${PubKey.PUBKEY_LEN -
    2}}$`;
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
    if (pubkeyString.match(PubKey.regex)) {
      return true;
    }

    return false;
  }

}
