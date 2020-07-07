import { createOrUpdateItem, getItemById } from '../../js/modules/data';
import { PubKey } from '../session/types';
import { MultiDeviceProtocol } from '../session/protocols';

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
   * @param number The device.
   */
  public static isBlocked(device: string | PubKey): boolean {
    void this.load();
    const stringValue =
      device instanceof PubKey ? device.key : device.toLowerCase();
    return this.blockedNumbers.has(stringValue);
  }

  /**
   * Check if a group id is blocked.
   * @param groupId The group id.
   */
  public static isGroupBlocked(groupId: string | PubKey): boolean {
    void this.load();
    const stringValue =
      groupId instanceof PubKey ? groupId.key : groupId.toLowerCase();
    return this.blockedGroups.has(stringValue);
  }

  /**
   * Block a user (including their linked devices).
   *
   * @param user The user to block.
   */
  public static async block(user: string | PubKey): Promise<void> {
    // The reason we add all linked device to block number set instead of checking if any device of a user is in the `isBlocked` function because
    // `isBlocked` is used synchronously in the code. To check if any device is blocked needs it to be async, which would mean all calls to `isBlocked` will also need to be async and so on
    // This is too much of a hassle at the moment as some UI code will have to be migrated to work with this async call.
    await this.load();
    const devices = await MultiDeviceProtocol.getAllDevices(user);
    devices.forEach(pubKey => this.blockedNumbers.add(pubKey.key));
    await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
  }

  /**
   * Unblock a user (including their linked devices).
   * @param user The user to unblock.
   */
  public static async unblock(user: string | PubKey): Promise<void> {
    await this.load();
    const devices = await MultiDeviceProtocol.getAllDevices(user);
    devices.forEach(pubKey => this.blockedNumbers.delete(pubKey.key));
    await this.saveToDB(BLOCKED_NUMBERS_ID, this.blockedNumbers);
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
