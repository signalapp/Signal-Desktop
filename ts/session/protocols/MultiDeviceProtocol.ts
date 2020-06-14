import _ from 'lodash';
import {
  createOrUpdatePairingAuthorisation,
  getPairingAuthorisationsFor,
  PairingAuthorisation,
  removePairingAuthorisationsFor,
} from '../../../js/modules/data';
import { PrimaryPubKey, PubKey, SecondaryPubKey } from '../types';

// TODO: We should fetch mappings when we can and only fetch them once every 5 minutes or something

/*
  The reason we're exporing a class here instead of just exporting the functions directly is for the sake of testing.
  We might want to stub out specific functions inside the multi device protocol itself but when export functions directly then it's not possible without weird hacks.
*/
// tslint:disable-next-line: no-unnecessary-class
export class MultiDeviceProtocol {
  /**
   * Save pairing authorisation to the database.
   * @param authorisation The pairing authorisation.
   */
  public static async savePairingAuthorisation(
    authorisation: PairingAuthorisation
  ): Promise<void> {
    return createOrUpdatePairingAuthorisation(authorisation);
  }

  /**
   * Get pairing authorisations for a given device.
   * @param device The device to get pairing authorisations for.
   */
  public static async getPairingAuthorisations(
    device: PubKey | string
  ): Promise<Array<PairingAuthorisation>> {
    const pubKey = typeof device === 'string' ? new PubKey(device) : device;

    return getPairingAuthorisationsFor(pubKey.key);
  }

  /**
   * Remove all pairing authorisations for a given device.
   * @param device The device to remove authorisation for.
   */
  public static async removePairingAuthorisations(
    device: PubKey | string
  ): Promise<void> {
    const pubKey = typeof device === 'string' ? new PubKey(device) : device;

    return removePairingAuthorisationsFor(pubKey.key);
  }

  /**
   * Get all devices linked to a user.
   *
   * @param user The user to get all the devices from.
   */
  public static async getAllDevices(
    user: PubKey | string
  ): Promise<Array<PubKey>> {
    const pubKey = typeof user === 'string' ? new PubKey(user) : user;
    const authorisations = await this.getPairingAuthorisations(pubKey);
    const devices = _.flatMap(
      authorisations,
      ({ primaryDevicePubKey, secondaryDevicePubKey }) => [
        primaryDevicePubKey,
        secondaryDevicePubKey,
      ]
    );

    return [...new Set(devices)].map(p => new PubKey(p));
  }

  /**
   * Get the primary device linked to a user.
   *
   * @param user The user to get primary device for.
   */
  public static async getPrimaryDevice(
    user: PubKey | string
  ): Promise<PrimaryPubKey> {
    const pubKey = typeof user === 'string' ? new PubKey(user) : user;
    const authorisations = await this.getPairingAuthorisations(pubKey);
    if (authorisations.length === 0) {
      return pubKey;
    }

    const primary = PrimaryPubKey.from(authorisations[0].primaryDevicePubKey);
    if (!primary) {
      throw new Error(`Primary user public key is invalid for ${pubKey.key}.`);
    }

    return primary;
  }

  /**
   * Get all the secondary devices linked to a user.
   *
   * @param user The user to get the devices from.
   */
  public static async getSecondaryDevices(
    user: PubKey | string
  ): Promise<Array<SecondaryPubKey>> {
    const primary = await this.getPrimaryDevice(user);
    const authorisations = await this.getPairingAuthorisations(primary);

    return authorisations
      .map(a => a.secondaryDevicePubKey)
      .map(pubKey => new SecondaryPubKey(pubKey));
  }
}
