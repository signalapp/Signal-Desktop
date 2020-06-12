import _ from 'lodash';
import {
  createOrUpdatePairingAuthorisation,
  getPairingAuthorisationsFor,
  PairingAuthorisation,
  removePairingAuthorisationsFor,
} from '../../../js/modules/data';
import { PrimaryPubKey, PubKey, SecondaryPubKey } from '../types';

// TODO: We should fetch mappings when we can and only fetch them once every 5 minutes or something

/**
 * Save pairing authorisation to the database.
 * @param authorisation The pairing authorisation.
 */
export async function savePairingAuthorisation(
  authorisation: PairingAuthorisation
): Promise<void> {
  return createOrUpdatePairingAuthorisation(authorisation);
}

/**
 * Get pairing authorisations for a given device.
 * @param device The device to get pairing authorisations for.
 */
export async function getPairingAuthorisations(
  device: PubKey
): Promise<Array<PairingAuthorisation>> {
  return getPairingAuthorisationsFor(device.key);
}

/**
 * Remove all pairing authorisations for a given device.
 * @param device The device to remove authorisation for.
 */
export async function removePairingAuthorisations(
  device: PubKey
): Promise<void> {
  return removePairingAuthorisationsFor(device.key);
}

/**
 * Get all devices linked to a user.
 *
 * @param user The user to get all the devices from.
 */
export async function getAllDevices(user: PubKey): Promise<Array<PubKey>> {
  const authorisations = await getPairingAuthorisations(user);
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
export async function getPrimaryDevice(user: PubKey): Promise<PrimaryPubKey> {
  const authorisations = await getPairingAuthorisations(user);
  if (authorisations.length === 0) {
    return user;
  }

  const pubKey = PrimaryPubKey.from(authorisations[0].primaryDevicePubKey);
  if (!pubKey) {
    throw new Error(`Primary user public key is invalid for ${user.key}.`);
  }

  return pubKey;
}

/**
 * Get all the secondary devices linked to a user.
 *
 * @param user The user to get the devices from.
 */
export async function getSecondaryDevices(
  user: PubKey
): Promise<Array<SecondaryPubKey>> {
  const primary = await getPrimaryDevice(user);
  const authorisations = await getPairingAuthorisations(primary);

  return authorisations
    .map(a => a.secondaryDevicePubKey)
    .map(pubKey => new SecondaryPubKey(pubKey));
}
