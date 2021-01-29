import { createOrUpdateItem, getItemById } from '../../js/modules/data';
import { PubKey } from '../session/types';
import { UserUtils } from '../session/utils';

const BLOCKED_NUMBERS_ID = 'blocked';
const BLOCKED_GROUPS_ID = 'blocked-groups';

// tslint:disable-next-line: no-unnecessary-class
export class BlockedNumberController {
  private static loaded: boolean = false;
  private static blockedNumbers: Set<string> = new Set();
  private static blockedGroups: Set<string> = new Set();

  /**
   * Check if a device is blocked.
   *
   * @param user The user.
   */
  public static async isBlockedAsync(user: string | PubKey): Promise<boolean> {
    await this.load();
    const isOurDevice = UserUtils.isUsFromCache(user);
    if (isOurDevice) {
      return false;
    }

    const pubkey = PubKey.cast(user);
    return this.blockedNumbers.has(pubkey.key);
  }

  /**
   * Check if a device is blocked synchronously.
   * This will only check against the memory cache on if a device is blocked, it is reccomended to pass in the primary device pub key.
   *
   * Make sure `load()` has been called before this function so that the correct blocked state is returned.
   *
   * @param number The device.
   */
  public static isBlocked(device: string | PubKey): boolean {
    // This function is not `async` because the old `isBlocked` function in js was also not async.
    // To convert it means we'll have to re-wire all our UI components to work with async.
    const stringValue =
      device instanceof PubKey ? device.key : device.toLowerCase();
    return this.blockedNumbers.has(stringValue);
  }

  /**
   * Check if a group id is blocked.
   * Make sure `load()` has been called before this function so that the correct blocked state is returned.
   *
   * @param groupId The group id.
   */
  public static isGroupBlocked(groupId: string | PubKey): boolean {
    const stringValue =
      groupId instanceof PubKey ? groupId.key : groupId.toLowerCase();
    return this.blockedGroups.has(stringValue);
  }

  /**
   * Block a user.
   * This will only block the primary device of the user.
   *
   * @param user The user to block.
   */
  public static async block(user: string | PubKey): Promise<void> {
    // The reason we add all linked device to block number set instead of checking if any device of a user is in the `isBlocked` function because
    // `isBlocked` is used synchronously in the code. To check if any device is blocked needs it to be async, which would mean all calls to `isBlocked` will also need to be async and so on
    // This is too much of a hassle at the moment as some UI code will have to be migrated to work with this async call.
    await this.load();
    const toBlock = PubKey.cast(user);
    if (!this.blockedNumbers.has(toBlock.key)) {
      this.blockedNumbers.add(toBlock.key);
      await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
    }
  }

  /**
   * Unblock a user.
   * This will only unblock the primary device of the user.
   *
   * @param user The user to unblock.
   */
  public static async unblock(user: string | PubKey): Promise<void> {
    await this.load();
    const toUnblock = PubKey.cast(user);

    if (this.blockedNumbers.has(toUnblock.key)) {
      this.blockedNumbers.delete(toUnblock.key);
      await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
    }
  }

  public static async setBlocked(
    user: string | PubKey,
    blocked: boolean
  ): Promise<void> {
    if (blocked) {
      return BlockedNumberController.block(user);
    }
    return BlockedNumberController.unblock(user);
  }

  public static async setGroupBlocked(
    groupId: string | PubKey,
    blocked: boolean
  ): Promise<void> {
    if (blocked) {
      return BlockedNumberController.blockGroup(groupId);
    }
    return BlockedNumberController.unblockGroup(groupId);
  }

  public static async blockGroup(groupId: string | PubKey): Promise<void> {
    await this.load();
    const id = PubKey.cast(groupId);
    this.blockedGroups.add(id.key);
    await this.saveToDB(BLOCKED_GROUPS_ID, this.blockedGroups);
  }

  public static async unblockGroup(groupId: string | PubKey): Promise<void> {
    await this.load();
    const id = PubKey.cast(groupId);
    this.blockedGroups.delete(id.key);
    await this.saveToDB(BLOCKED_GROUPS_ID, this.blockedGroups);
  }

  public static getBlockedNumbers(): Array<string> {
    return [...this.blockedNumbers];
  }

  public static getBlockedGroups(): Array<string> {
    return [...this.blockedGroups];
  }

  // ---- DB

  public static async load() {
    if (!this.loaded) {
      this.blockedNumbers = await this.getNumbersFromDB(BLOCKED_NUMBERS_ID);
      this.blockedGroups = await this.getNumbersFromDB(BLOCKED_GROUPS_ID);
      this.loaded = true;
    }
  }

  public static reset() {
    this.loaded = false;
    this.blockedNumbers = new Set();
    this.blockedGroups = new Set();
  }

  private static async getNumbersFromDB(id: string): Promise<Set<string>> {
    const data = await getItemById(id);
    if (!data || !data.value) {
      return new Set();
    }

    return new Set(data.value);
  }

  private static async saveToDB(
    id: string,
    numbers: Set<string>
  ): Promise<void> {
    await createOrUpdateItem({
      id,
      value: [...numbers],
    });
  }
}
