export class PubKey {
  public static readonly PUBKEY_LEN = 66;
  // This is a temporary fix to allow groupPubkeys created from mobile to be handled correctly
  // They have a different regex to match
  // FIXME move this to a new class which validates group ids and use it in all places where we have group ids (message sending included)
  public static readonly MOBILE_GROUP_PUBKEY_LEN = 32;
  public static readonly regexForPubkeys = `((05)?[0-9a-fA-F]{${PubKey.PUBKEY_LEN -
    2}})`;

  private static readonly regexForMobileGroupID = `__textsecure_group__![0-9a-fA-F]{${PubKey.MOBILE_GROUP_PUBKEY_LEN}}`;
  // prettier-ignore
  private static readonly regex: RegExp = new RegExp(
    `^${PubKey.regexForPubkeys}|${PubKey.regexForMobileGroupID}$`
  );
  public readonly key: string;

  /**
   * A PubKey object.
   * If `pubKeyString` is not valid then this will throw an `Error`.
   *
   * @param pubkeyString The public key string.
   */
  constructor(pubkeyString: string) {
    if (!PubKey.validate(pubkeyString)) {
      throw new Error(`Invalid pubkey string passed: ${pubkeyString}`);
    }
    this.key = pubkeyString.toLowerCase();
  }

  /**
   * Cast a `value` to a `PubKey`.
   * If `value` is not valid then this will throw.
   *
   * @param value The value to cast.
   */
  public static cast(value: string | PubKey): PubKey {
    return typeof value === 'string' ? new PubKey(value) : value;
  }

  /**
   * Try convert `pubKeyString` to `PubKey`.
   *
   * @param pubkeyString The public key string.
   * @returns `PubKey` if valid otherwise returns `undefined`.
   */
  public static from(pubkeyString: string): PubKey | undefined {
    // Returns a new instance if the pubkey is valid
    if (PubKey.validate(pubkeyString)) {
      return new PubKey(pubkeyString);
    }

    return undefined;
  }

  public static validate(pubkeyString: string): boolean {
    return this.regex.test(pubkeyString);
  }

  public isEqual(comparator: PubKey | string) {
    return comparator instanceof PubKey
      ? this.key === comparator.key
      : this.key === comparator.toLowerCase();
  }
}

export class PrimaryPubKey extends PubKey {}
export class SecondaryPubKey extends PubKey {}
