import { Data } from '../data/data';
import { commitConversationAndRefreshWrapper } from '../models/conversation';
import { PubKey } from '../session/types';
import { Storage } from './storage';

const BLOCKED_NUMBERS_ID = 'blocked';

export class BlockedNumberController {
  private static loaded: boolean = false;
  private static blockedNumbers: Set<string> = new Set();

  /**
   * Check if a device is blocked synchronously.
   * This will only check against the memory cache on if a device is blocked, it is recommended to pass in the primary device pub key.
   *
   * Make sure `load()` has been called before this function so that the correct blocked state is returned.
   *
   * @param number The device.
   */
  public static isBlocked(device: string | PubKey): boolean {
    // This function is not `async` because the old `isBlocked` function in js was also not async.
    // To convert it means we'll have to re-wire all our UI components to work with async.
    const stringValue = device instanceof PubKey ? device.key : device.toLowerCase();
    return this.blockedNumbers.has(stringValue);
  }

  /**
   * Block a user or group, by pubkey
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
      await commitConversationAndRefreshWrapper(toBlock.key);
    }
  }

  /**
   * Unblock all these users.
   * This will only unblock the primary device of the user.
   *
   * @param user The user to unblock.
   */
  public static async unblockAll(users: Array<string>): Promise<void> {
    await this.load();
    let changes = false;
    users.forEach(user => {
      const toUnblock = PubKey.cast(user);

      if (this.blockedNumbers.has(toUnblock.key)) {
        this.blockedNumbers.delete(toUnblock.key);
        changes = true;
      }
    });

    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      try {
        // eslint-disable-next-line no-await-in-loop
        await commitConversationAndRefreshWrapper(user);
      } catch (e) {
        window.log.warn(
          'failed to SessionUtilContact.insertContactFromDBIntoWrapperAndRefresh with: ',
          user
        );
      }
    }

    if (changes) {
      await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
    }
  }

  public static async setBlocked(user: string | PubKey, blocked: boolean): Promise<void> {
    if (blocked) {
      return BlockedNumberController.block(user);
    }
    return BlockedNumberController.unblockAll([PubKey.cast(user).key]);
  }

  public static getBlockedNumbers(): Array<string> {
    return [...this.blockedNumbers];
  }

  // ---- DB

  public static async load() {
    if (!this.loaded) {
      this.blockedNumbers = await this.getNumbersFromDB(BLOCKED_NUMBERS_ID);
      this.loaded = true;
    }
  }

  public static reset() {
    this.loaded = false;
    this.blockedNumbers = new Set();
  }

  private static async getNumbersFromDB(id: string): Promise<Set<string>> {
    const data = await Data.getItemById(id);
    if (!data || !data.value) {
      return new Set();
    }

    return new Set(data.value);
  }

  private static async saveToDB(id: string, numbers: Set<string>): Promise<void> {
    await Storage.put(id, [...numbers]);
  }
}
