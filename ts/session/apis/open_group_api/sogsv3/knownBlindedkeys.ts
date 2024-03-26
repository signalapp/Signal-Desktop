import { crypto_sign_curve25519_pk_to_ed25519 } from 'curve25519-js';
import { from_hex, to_hex } from 'libsodium-wrappers-sumo';
import { cloneDeep, flatten, isEmpty, isEqual, isString, uniqBy } from 'lodash';

import { Data } from '../../../../data/data';
import { OpenGroupData } from '../../../../data/opengroups';
import { KNOWN_BLINDED_KEYS_ITEM } from '../../../../data/settings-key';
import { ConversationModel } from '../../../../models/conversation';
import { roomHasBlindEnabled } from '../../../../types/sqlSharedTypes';
import { Storage } from '../../../../util/storage';
import { getConversationController } from '../../../conversations';
import { LibSodiumWrappers } from '../../../crypto';
import { KeyPrefixType, PubKey } from '../../../types';
import { UserUtils } from '../../../utils';
import { combineKeys, generateBlindingFactor } from '../../../utils/SodiumUtils';
import { fromHexToArray } from '../../../utils/String';
import { SogsBlinding } from './sogsBlinding';

export type BlindedIdMapping = {
  blindedId: string;
  serverPublicKey: string;
  realSessionId: string;
};

// for now, we assume we won't find a lot of blinded keys.
// So we can store all of those in a single JSON string in the db.
let cachedKnownMapping: Array<BlindedIdMapping> | null = null;

/**
 * This function must only be used for testing
 */
export function TEST_resetCachedBlindedKeys() {
  cachedKnownMapping = null;
}

/**
 * This function must only be used for testing
 */
export function TEST_getCachedBlindedKeys() {
  return cloneDeep(cachedKnownMapping);
}

export async function loadKnownBlindedKeys() {
  if (cachedKnownMapping !== null) {
    throw new Error('loadKnownBlindedKeys must only be called once');
  }
  const fromDb = await Data.getItemById(KNOWN_BLINDED_KEYS_ITEM);

  if (fromDb && fromDb.value && !isEmpty(fromDb.value)) {
    try {
      const read = JSON.parse(fromDb.value);
      cachedKnownMapping = cachedKnownMapping || [];
      read.forEach((elem: any) => {
        cachedKnownMapping?.push(elem);
      });
    } catch (e) {
      window.log.error(e.message);
      cachedKnownMapping = [];
    }
  } else {
    cachedKnownMapping = [];
  }
}

/**
 * only exported for testing
 */
export async function writeKnownBlindedKeys() {
  if (cachedKnownMapping && cachedKnownMapping.length) {
    await Storage.put(KNOWN_BLINDED_KEYS_ITEM, JSON.stringify(cachedKnownMapping));
  }
}

function assertLoaded(): Array<BlindedIdMapping> {
  if (cachedKnownMapping === null) {
    throw new Error('loadKnownBlindedKeys must be called on app start');
  }
  return cachedKnownMapping;
}

export function isNonBlindedKey(blindedId: string) {
  if (
    blindedId.startsWith(KeyPrefixType.unblinded) ||
    blindedId.startsWith(KeyPrefixType.standard)
  ) {
    return true;
  }
  return false;
}

export function getCachedNakedKeyFromBlinded(
  blindedId: string,
  serverPublicKey: string
): string | undefined {
  if (isNonBlindedKey(blindedId)) {
    return blindedId;
  }
  const found = assertLoaded().find(
    m => m.serverPublicKey === serverPublicKey && m.blindedId === blindedId
  );
  return found?.realSessionId || undefined;
}

export async function addCachedBlindedKey({
  blindedId,
  serverPublicKey,
  realSessionId,
}: BlindedIdMapping) {
  if (isNonBlindedKey(blindedId)) {
    throw new Error('blindedId is not a blinded key');
  }
  if (!isNonBlindedKey(realSessionId)) {
    throw new Error('realSessionId must not be blinded');
  }
  const assertLoadedCache = assertLoaded();
  const foundIndex = assertLoadedCache.findIndex(
    m => m.blindedId === blindedId && serverPublicKey === m.serverPublicKey
  );

  if (foundIndex >= 0) {
    if (assertLoadedCache[foundIndex].realSessionId !== realSessionId) {
      window.log.warn(
        `overriding cached blinded mapping for ${assertLoadedCache[foundIndex].realSessionId} with ${realSessionId} on ${serverPublicKey}`
      );
      assertLoadedCache[foundIndex].realSessionId = realSessionId;
      await writeKnownBlindedKeys();
    }

    return;
  }
  assertLoadedCache.push({ blindedId, serverPublicKey, realSessionId });
  await writeKnownBlindedKeys();
}

/**
 * Only exported for testing
 * Try to match a blindedId with a standardSessionID. This is the only way we have to find that a standard and a blindedID are in fact, the same person.
 */
export function tryMatchBlindWithStandardKey(
  standardSessionId: string,
  blindedSessionId: string,
  serverPubKey: string,
  sodium: LibSodiumWrappers
): boolean {
  if (!standardSessionId.startsWith(KeyPrefixType.standard)) {
    throw new Error('standardKey must be a standard key (starting with 05)');
  }

  if (!PubKey.isBlinded(blindedSessionId)) {
    throw new Error('blindedKey must be a blinded key (starting with 15 or 25)');
  }

  // We don't want to stop iterating even if an error happens while looking for a blind/standard match.
  // That's why we catch any errors and return false if it happens.
  try {
    const sessionIdNoPrefix = PubKey.removePrefixIfNeeded(PubKey.cast(standardSessionId).key);
    const blindedIdNoPrefix = PubKey.removePrefixIfNeeded(PubKey.cast(blindedSessionId).key);
    const kBytes = generateBlindingFactor(serverPubKey, sodium);

    // From the account id (ignoring 05 prefix) we have two possible ed25519 pubkeys; the first is
    // the positive(which is what Signal's XEd25519 conversion always uses)

    const inbin = from_hex(sessionIdNoPrefix);
    // Note: The below method is code we have exposed from the method within the Curve25519-js library
    // rather than custom code we have written
    const xEd25519Key = crypto_sign_curve25519_pk_to_ed25519(inbin);

    // Blind it:
    const pk1 = combineKeys(kBytes, xEd25519Key, sodium);
    //  For the negative, what we're going to get out of the above is simply the negative of pk1, so
    // flip the sign bit to get pk2:
    const pk2 = cloneDeep(pk1);
    // eslint-disable-next-line no-bitwise
    pk2[31] = pk1[31] ^ 0b1000_0000;

    const match =
      isEqual(blindedIdNoPrefix, to_hex(pk1)) || isEqual(blindedIdNoPrefix, to_hex(pk2));

    if (!match) {
      return false;
    }

    return true;
  } catch (e) {
    window.log.warn('Failed to do crypto tryMatchBlindWithStandardKey with ', e.message);
    return false;
  }
}

/**
 * This function can be called to trigger a build of the cache.
 * This function is expensive depending on the contacts list length of the user
 * We only consider the private & approved conversations for mapping.
 */
function findNotCachedBlindingMatch(
  blindedId: string,
  serverPublicKey: string,
  sodium: LibSodiumWrappers
): string | undefined {
  if (isNonBlindedKey(blindedId)) {
    throw new Error('findNotCachedBlindingMatch blindedId is supposed to be blinded');
  }

  // we iterate only over the convos private, approved, and which have an unblinded id.
  const foundConvoMatchingBlindedPubkey = getConversationController()
    .getConversations()
    .filter(m => m.isPrivate() && m.isApproved() && !PubKey.isBlinded(m.id))
    .find(m => {
      return tryMatchBlindWithStandardKey(m.id, blindedId, serverPublicKey, sodium);
    });

  return foundConvoMatchingBlindedPubkey?.get('id') || undefined;
}

/**
 * This function returns true if the given blindedId matches our own blinded id on any pysogs.
 * If the given pubkey is not blinded, it returns true if it is our naked SessionID.
 * It can be used to replace mentions with the @You syntax and for the quotes too
 */
export function isUsAnySogsFromCache(blindedOrNakedId: string): boolean {
  const usUnblinded = UserUtils.getOurPubKeyStrFromCache();

  if (!PubKey.isBlinded(blindedOrNakedId)) {
    return blindedOrNakedId === usUnblinded;
  }
  const found = assertLoaded().find(
    m => m.blindedId === blindedOrNakedId && m.realSessionId === usUnblinded
  );
  return Boolean(found);
}

/**
 * This function returns the cached blindedId for us, given a public conversation.
 */
export function getUsBlindedInThatServer(convo: ConversationModel | string): string | undefined {
  if (!convo) {
    return undefined;
  }
  const convoId = isString(convo) ? convo : convo.id;

  if (!getConversationController().get(convoId)?.isOpenGroupV2()) {
    return undefined;
  }
  const room = OpenGroupData.getV2OpenGroupRoom(isString(convo) ? convo : convo.id);
  if (!room || !roomHasBlindEnabled(room) || !room.serverPublicKey) {
    return undefined;
  }
  const usNaked = UserUtils.getOurPubKeyStrFromCache();

  const found = assertLoaded().find(
    m => m.serverPublicKey === room.serverPublicKey && m.realSessionId === usNaked
  );
  return found?.blindedId;
}

/**
 * This function can be called to find all blinded conversations we have with a user given its real sessionID.
 * It should be used when we get a message request response, to merge all convos into one.
 *
 * This function is quite resource intensive, so do not call it everywhere
 */
function findNotCachedBlindedConvoFromUnblindedKey(
  unblindedID: string,
  serverPublicKey: string,
  sodium: LibSodiumWrappers
): Array<ConversationModel> {
  if (PubKey.isBlinded(unblindedID)) {
    throw new Error(
      'findNotCachedBlindedConvoFromUnblindedKey unblindedID is supposed to be unblinded!'
    );
  }

  // we iterate only over the convos private, with a blindedId, and active,
  // so the one to which we sent a message already or received one from outside sogs.
  const foundConvosForThisServerPk =
    getConversationController()
      .getConversations()
      .filter(m => m.isPrivate() && PubKey.isBlinded(m.id) && m.isActive())
      .filter(m => {
        return tryMatchBlindWithStandardKey(unblindedID, m.id, serverPublicKey, sodium);
      }) || [];

  // we should have only one per server, as we gave the serverpubkey and a blindedId is uniq for a serverPk

  return foundConvosForThisServerPk;
}

/**
 * Look for a cached match of that blindedId and that serverPubkey.
 * This function is expensive and should only be run on some very specific case. You shouldn't need to add any other calls to this function in the app
 * @param blindedId the blindedId to look for
 * @param serverPubKey the serverPubkey on which this blindedId is found
 * @param sodium the sodium instance
 * @returns the conversationId of the naked private convo found, matching that blindedId on that serverPubkey
 */
export async function findCachedBlindedMatchOrLookItUp(
  blindedId: string,
  serverPubKey: string,
  sodium: LibSodiumWrappers
): Promise<string | undefined> {
  if (!PubKey.isBlinded(blindedId)) {
    return blindedId;
  }
  const found = getCachedNakedKeyFromBlinded(blindedId, serverPubKey);

  if (found) {
    return found;
  }

  const realSessionIdFound = findNotCachedBlindingMatch(blindedId, serverPubKey, sodium);

  if (realSessionIdFound) {
    await addCachedBlindedKey({
      blindedId,
      realSessionId: realSessionIdFound,
      serverPublicKey: serverPubKey,
    });
    return realSessionIdFound;
  }
  return undefined;
}

/**
 * When we sent a message to a sogs with blinded enable, we need to store the message with the sender being our blinded pubkey.
 * We store that mapping <ourKey, serverPk, blindedKey> in the same cache, so we can map our own messages synced easily.
 * This function just find if there is such a mapping already cached, but won't try to update the cache to find one.
 */
export function findCachedBlindedIdFromUnblinded(
  unblindedId: string,
  serverPubKey: string
): string | undefined {
  if (PubKey.isBlinded(unblindedId)) {
    throw new Error('findCachedBlindedIdFromUnblinded needs an unblindedID');
  }
  const found = assertLoaded().find(
    m => m.serverPublicKey === serverPubKey && m.realSessionId === unblindedId
  );
  return found?.blindedId || undefined;
}

/**
 * This function can be used to generate our blindedId for a sogs requiring it, and cache it.
 */
export async function findCachedOurBlindedPubkeyOrLookItUp(
  serverPubKey: string,
  sodium: LibSodiumWrappers
): Promise<string> {
  const ourNakedSessionID = UserUtils.getOurPubKeyStrFromCache();

  if (PubKey.isBlinded(ourNakedSessionID)) {
    throw new Error('findCachedBlindedIdFromUnblindedOrLookItUp needs a unblindedID');
  }
  let found = findCachedBlindedIdFromUnblinded(ourNakedSessionID, serverPubKey);

  if (found) {
    return found;
  }
  const signingKeys = await UserUtils.getUserED25519KeyPairBytes();

  // just to make sure the mapping was not added during last line call

  if (!signingKeys) {
    throw new Error('addSingleOutgoingMessage: getUserED25519KeyPairBytes returned nothing');
  }

  const blindedPubkeyForThisSogs = SogsBlinding.getBlindedPubKey(
    fromHexToArray(serverPubKey),
    signingKeys,
    sodium
  );
  found = findCachedBlindedIdFromUnblinded(ourNakedSessionID, serverPubKey);

  if (found) {
    return found;
  }

  await addCachedBlindedKey({
    blindedId: blindedPubkeyForThisSogs,
    serverPublicKey: serverPubKey,
    realSessionId: ourNakedSessionID,
  });
  return blindedPubkeyForThisSogs;
}
export function getCachedNakedKeyFromBlindedNoServerPubkey(blindedId: string): string | undefined {
  if (isNonBlindedKey(blindedId)) {
    return blindedId;
  }
  const found = assertLoaded().find(m => m.blindedId === blindedId);
  return found?.realSessionId || undefined;
}

/**
 * Can be used when we get an unblinded message to check if this is actually a reply to any of the conversation we were having with a blinded id, on any sogs
 * @param unblindedId the blindedId of that user
 * @param sodium passed so we can make this function not async
 */
export function findCachedBlindedMatchOrLookupOnAllServers(
  unblindedId: string,
  sodium: LibSodiumWrappers
): Array<ConversationModel> {
  if (PubKey.isBlinded(unblindedId)) {
    throw new Error('findCachedBlindedMatchOrLookupOnAllServers needs an unblindedId');
  }

  const allServerPubkeys = OpenGroupData.getAllOpengroupsServerPubkeys();
  let matchingServerPubkeyWithThatBlindedId = flatten(
    allServerPubkeys.map(serverPk => {
      return findNotCachedBlindedConvoFromUnblindedKey(unblindedId, serverPk, sodium);
    })
  );
  matchingServerPubkeyWithThatBlindedId =
    uniqBy(matchingServerPubkeyWithThatBlindedId, m => m.id) || [];

  return matchingServerPubkeyWithThatBlindedId;
}
