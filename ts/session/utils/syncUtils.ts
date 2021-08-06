import {
  createOrUpdateItem,
  getItemById,
  getLatestClosedGroupEncryptionKeyPair,
  Snode,
} from '../../../ts/data/data';
import { getMessageQueue, Utils } from '..';
import { getConversationController } from '../conversations';
import uuid from 'uuid';
import { StringUtils, UserUtils } from '.';
import { ECKeyPair } from '../../receiver/keypairs';
import {
  ConfigurationMessage,
  ConfigurationMessageClosedGroup,
  ConfigurationMessageContact,
} from '../messages/outgoing/controlMessage/ConfigurationMessage';
import { ConversationModel } from '../../models/conversation';
import {
  fromArrayBufferToBase64,
  fromBase64ToArray,
  fromBase64ToArrayBuffer,
  fromHex,
  fromHexToArray,
  fromUInt8ArrayToBase64,
  stringToArrayBuffer,
  stringToUint8Array,
  toHex,
} from './String';
import { SignalService } from '../../protobuf';
import _ from 'lodash';
import {
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  VisibleMessage,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { ExpirationTimerUpdateMessage } from '../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { getV2OpenGroupRoom } from '../../data/opengroups';
import { getCompleteUrlFromRoom } from '../../opengroup/utils/OpenGroupUtils';
import { DURATION } from '../constants';
import { snodeHttpsAgent } from '../snode_api/onions';

import { default as insecureNodeFetch } from 'node-fetch';
import { getSodium } from '../crypto';
import { snodeRpc } from '../snode_api/lokiRpc';
import { getSwarmFor, getSwarmFromCacheOrDb } from '../snode_api/snodePool';
import { base64_variants, crypto_sign, to_base64, to_hex } from 'libsodium-wrappers';
import {
  textToArrayBuffer,
  TextToBase64,
  verifyED25519Signature,
} from '../../opengroup/opengroupV2/ApiUtil';
import { KeyPair } from '../../../libtextsecure/libsignal-protocol';
import { getIdentityKeyPair } from './User';
import { PubKey } from '../types';
import pRetry from 'p-retry';
import { ed25519Str } from '../onions/onionPath';

const ITEM_ID_LAST_SYNC_TIMESTAMP = 'lastSyncedTimestamp';

const getLastSyncTimestampFromDb = async (): Promise<number | undefined> =>
  (await getItemById(ITEM_ID_LAST_SYNC_TIMESTAMP))?.value;

const writeLastSyncTimestampToDb = async (timestamp: number) =>
  createOrUpdateItem({ id: ITEM_ID_LAST_SYNC_TIMESTAMP, value: timestamp });

export const syncConfigurationIfNeeded = async () => {
  const lastSyncedTimestamp = (await getLastSyncTimestampFromDb()) || 0;
  const now = Date.now();

  // if the last sync was less than 2 days before, return early.
  if (Math.abs(now - lastSyncedTimestamp) < DURATION.DAYS * 7) {
    return;
  }

  const allConvos = getConversationController().getConversations();
  const configMessage = await getCurrentConfigurationMessage(allConvos);
  try {
    // window?.log?.info('syncConfigurationIfNeeded with', configMessage);

    await getMessageQueue().sendSyncMessage(configMessage);
  } catch (e) {
    window?.log?.warn('Caught an error while sending our ConfigurationMessage:', e);
    // we do return early so that next time we use the old timestamp again
    // and so try again to trigger a sync
    return;
  }
  await writeLastSyncTimestampToDb(now);
};

export const forceSyncConfigurationNowIfNeeded = async (waitForMessageSent = false) =>
  new Promise(resolve => {
    const allConvos = getConversationController().getConversations();

    // if we hang for more than 10sec, force resolve this promise.
    setTimeout(() => {
      resolve(false);
    }, 10000);

    void getCurrentConfigurationMessage(allConvos)
      .then(configMessage => {
        // this just adds the message to the sending queue.
        // if waitForMessageSent is set, we need to effectively wait until then
        // tslint:disable-next-line: no-void-expression
        const callback = waitForMessageSent
          ? () => {
              resolve(true);
            }
          : undefined;
        void getMessageQueue().sendSyncMessage(configMessage, callback as any);
        // either we resolve from the callback if we need to wait for it,
        // or we don't want to wait, we resolve it here.
        if (!waitForMessageSent) {
          resolve(true);
        }
      })
      .catch(e => {
        window?.log?.warn('Caught an error while building our ConfigurationMessage:', e);
        resolve(false);
      });
  });

/**
 * Makes a post to a node to receive the timestamp info. If non-existant, returns -1
 * @param snode Snode to send request to
 * @returns timestamp of the response from snode
 */
const getNetworkTime = async (snode: Snode): Promise<string | number> => {
  const response: any = await snodeRpc('info', {}, snode);
  const body = JSON.parse(response.body);
  const timestamp = body?.timestamp;
  if (!timestamp) {
    throw new Error(`getNetworkTime returned invalid timestamp: ${timestamp}`);
  }
  return timestamp;
};

// tslint:disable-next-line: max-func-body-length
export const forceNetworkDeletion = async (): Promise<Array<string> | null> => {
  const sodium = await getSodium();
  const userX25519PublicKey = UserUtils.getOurPubKeyStrFromCache();

  const userED25519KeyPair = await UserUtils.getUserED25519KeyPair();

  if (!userED25519KeyPair) {
    window.log.warn('Cannot forceNetworkDeletion, did not find user ed25519 key.');
    return null;
  }
  const edKeyPriv = userED25519KeyPair.privKey;

  try {
    const maliciousSnodes = await pRetry(async () => {
      const userSwarm = await getSwarmFor(userX25519PublicKey);
      const snodeToMakeRequestTo: Snode | undefined = _.sample(userSwarm);
      const edKeyPrivBytes = fromHexToArray(edKeyPriv);

      if (!snodeToMakeRequestTo) {
        window.log.warn('Cannot forceNetworkDeletion, without a valid swarm node.');
        return null;
      }

      return pRetry(
        async () => {
          const timestamp = await getNetworkTime(snodeToMakeRequestTo);

          const verificationData = StringUtils.encode(`delete_all${timestamp}`, 'utf8');
          const message = new Uint8Array(verificationData);
          const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
          const signatureBase64 = fromUInt8ArrayToBase64(signature);

          const deleteMessageParams = {
            pubkey: userX25519PublicKey,
            pubkey_ed25519: userED25519KeyPair.pubKey.toUpperCase(),
            timestamp,
            signature: signatureBase64,
          };

          const ret = await snodeRpc(
            'delete_all',
            deleteMessageParams,
            snodeToMakeRequestTo,
            userX25519PublicKey
          );

          if (!ret) {
            throw new Error(
              `Empty response got for delete_all on snode ${ed25519Str(
                snodeToMakeRequestTo.pubkey_ed25519
              )}`
            );
          }

          try {
            const parsedResponse = JSON.parse(ret.body);
            const { swarm } = parsedResponse;

            if (!swarm) {
              throw new Error(
                `Invalid JSON swarm response got for delete_all on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}, ${ret?.body}`
              );
            }
            const swarmAsArray = Object.entries(swarm) as Array<Array<any>>;
            if (!swarmAsArray.length) {
              throw new Error(
                `Invalid JSON swarmAsArray response got for delete_all on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}, ${ret?.body}`
              );
            }
            // results will only contains the snode pubkeys which returned invalid/empty results
            const results: Array<string> = _.compact(
              swarmAsArray.map(snode => {
                const snodePubkey = snode[0];
                const snodeJson = snode[1];

                const isFailed = snodeJson.failed || false;

                if (isFailed) {
                  const reason = snodeJson.reason;
                  const statusCode = snodeJson.code;
                  if (reason && statusCode) {
                    window.log.warn(
                      `Could not delete data from ${ed25519Str(
                        snodeToMakeRequestTo.pubkey_ed25519
                      )} due to error: ${reason}: ${statusCode}`
                    );
                  } else {
                    window.log.warn(
                      `Could not delete data from ${ed25519Str(
                        snodeToMakeRequestTo.pubkey_ed25519
                      )}`
                    );
                  }
                  return snodePubkey;
                }

                const hashes = snodeJson.deleted as Array<string>;
                const signatureSnode = snodeJson.signature as string;
                // The signature format is ( PUBKEY_HEX || TIMESTAMP || DELETEDHASH[0] || ... || DELETEDHASH[N] )
                const dataToVerify = `${userX25519PublicKey}${timestamp}${hashes.join('')}`;
                const dataToVerifyUtf8 = StringUtils.encode(dataToVerify, 'utf8');
                const isValid = sodium.crypto_sign_verify_detached(
                  fromBase64ToArray(signatureSnode),
                  new Uint8Array(dataToVerifyUtf8),
                  fromHexToArray(snodePubkey)
                );
                if (!isValid) {
                  return snodePubkey;
                }
                return null;
              })
            );

            return results;
          } catch (e) {
            throw new Error(
              `Invalid JSON response got for delete_all on snode ${ed25519Str(
                snodeToMakeRequestTo.pubkey_ed25519
              )}, ${ret?.body}`
            );
          }
        },
        {
          retries: 3,
          minTimeout: 500,
          onFailedAttempt: e => {
            window?.log?.warn(
              `delete_all request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
            );
          },
        }
      );
    }, {});

    return maliciousSnodes;
  } catch (e) {
    window.log.warn('failed to delete everything on network:', e);
    return null;
  }
};

const getActiveOpenGroupV2CompleteUrls = async (
  convos: Array<ConversationModel>
): Promise<Array<string>> => {
  // Filter open groups v2
  const openGroupsV2ConvoIds = convos
    .filter(c => !!c.get('active_at') && c.isOpenGroupV2() && !c.get('left'))
    .map(c => c.id) as Array<string>;

  const urls = await Promise.all(
    openGroupsV2ConvoIds.map(async opengroup => {
      const roomInfos = await getV2OpenGroupRoom(opengroup);
      if (roomInfos) {
        return getCompleteUrlFromRoom(roomInfos);
      }
      return null;
    })
  );

  return _.compact(urls) || [];
};

const getValidClosedGroups = async (convos: Array<ConversationModel>) => {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();

  // Filter Closed/Medium groups
  const closedGroupModels = convos.filter(
    c =>
      !!c.get('active_at') &&
      c.isMediumGroup() &&
      c.get('members')?.includes(ourPubKey) &&
      !c.get('left') &&
      !c.get('isKickedFromGroup') &&
      !c.isBlocked() &&
      c.get('name')
  );

  const closedGroups = await Promise.all(
    closedGroupModels.map(async c => {
      const groupPubKey = c.get('id');
      const fetchEncryptionKeyPair = await getLatestClosedGroupEncryptionKeyPair(groupPubKey);
      if (!fetchEncryptionKeyPair) {
        return null;
      }

      return new ConfigurationMessageClosedGroup({
        publicKey: groupPubKey,
        name: c.get('name') || '',
        members: c.get('members') || [],
        admins: c.get('groupAdmins') || [],
        encryptionKeyPair: ECKeyPair.fromHexKeyPair(fetchEncryptionKeyPair),
      });
    })
  );

  const onlyValidClosedGroup = closedGroups.filter(m => m !== null) as Array<
    ConfigurationMessageClosedGroup
  >;
  return onlyValidClosedGroup;
};

const getValidContacts = (convos: Array<ConversationModel>) => {
  // Filter contacts
  const contactsModels = convos.filter(
    c => !!c.get('active_at') && c.getLokiProfile()?.displayName && c.isPrivate() && !c.isBlocked()
  );

  const contacts = contactsModels.map(c => {
    try {
      const profileKey = c.get('profileKey');
      let profileKeyForContact = null;
      if (typeof profileKey === 'string') {
        // this will throw if the profileKey is not in hex.
        try {
          // for some reason, at some point, the saved profileKey is a string in base64 format
          // this hack is here to update existing conversations with a non-hex profileKey to a hex format and save them

          if (!/^[0-9a-fA-F]+$/.test(profileKey)) {
            throw new Error('Not Hex');
          }
          profileKeyForContact = fromHexToArray(profileKey);
        } catch (e) {
          // if not hex, try to decode it as base64
          profileKeyForContact = fromBase64ToArray(profileKey);
          // if the line above does not fail, update the stored profileKey for this convo
          void c.setProfileKey(profileKeyForContact);
        }
      } else if (profileKey) {
        window.log.warn(
          'Got a profileKey for a contact in another format than string. Contact: ',
          c.id
        );
        return null;
      }

      return new ConfigurationMessageContact({
        publicKey: c.id as string,
        displayName: c.getLokiProfile()?.displayName,
        profilePictureURL: c.get('avatarPointer'),
        profileKey: !profileKeyForContact?.length ? undefined : profileKeyForContact,
      });
    } catch (e) {
      window?.log.warn('getValidContacts', e);
      return null;
    }
  });
  return _.compact(contacts);
};

export const getCurrentConfigurationMessage = async (convos: Array<ConversationModel>) => {
  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = convos.find(convo => convo.id === ourPubKey);

  const opengroupV2CompleteUrls = await getActiveOpenGroupV2CompleteUrls(convos);
  const onlyValidClosedGroup = await getValidClosedGroups(convos);
  const validContacts = getValidContacts(convos);

  if (!ourConvo) {
    window?.log?.error('Could not find our convo while building a configuration message.');
  }

  const ourProfileKeyHex =
    getConversationController()
      .get(UserUtils.getOurPubKeyStrFromCache())
      ?.get('profileKey') || null;
  const profileKey = ourProfileKeyHex ? fromHexToArray(ourProfileKeyHex) : undefined;

  const profilePicture = ourConvo?.get('avatarPointer') || undefined;
  const displayName = ourConvo?.getLokiProfile()?.displayName || undefined;

  const activeOpenGroups = [...opengroupV2CompleteUrls];

  return new ConfigurationMessage({
    identifier: uuid(),
    timestamp: Date.now(),
    activeOpenGroups,
    activeClosedGroups: onlyValidClosedGroup,
    displayName,
    profilePicture,
    profileKey,
    contacts: validContacts,
  });
};

const buildSyncVisibleMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  timestamp: number,
  syncTarget: string
) => {
  const body = dataMessage.body || undefined;

  const wrapToUInt8Array = (buffer: any) => {
    if (!buffer) {
      return undefined;
    }
    if (buffer instanceof Uint8Array) {
      // Audio messages are already uint8Array
      return buffer;
    }
    return new Uint8Array(buffer.toArrayBuffer());
  };
  const attachments = (dataMessage.attachments || []).map(attachment => {
    const key = wrapToUInt8Array(attachment.key);
    const digest = wrapToUInt8Array(attachment.digest);

    return {
      ...attachment,
      key,
      digest,
    };
  }) as Array<AttachmentPointerWithUrl>;
  const quote = (dataMessage.quote as Quote) || undefined;
  const preview = (dataMessage.preview as Array<PreviewWithAttachmentUrl>) || [];
  const expireTimer = dataMessage.expireTimer;

  return new VisibleMessage({
    identifier,
    timestamp,
    attachments,
    body,
    quote,
    preview,
    syncTarget,
    expireTimer,
  });
};

const buildSyncExpireTimerMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  timestamp: number,
  syncTarget: string
) => {
  const expireTimer = dataMessage.expireTimer;

  return new ExpirationTimerUpdateMessage({
    identifier,
    timestamp,
    expireTimer,
    syncTarget,
  });
};

export type SyncMessageType = VisibleMessage | ExpirationTimerUpdateMessage | ConfigurationMessage;

export const buildSyncMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  syncTarget: string,
  sentTimestamp: number
): VisibleMessage | ExpirationTimerUpdateMessage => {
  if (
    (dataMessage as any).constructor.name !== 'DataMessage' &&
    !(dataMessage instanceof SignalService.DataMessage)
  ) {
    window?.log?.warn('buildSyncMessage with something else than a DataMessage');
  }

  if (!sentTimestamp || !_.isNumber(sentTimestamp)) {
    throw new Error('Tried to build a sync message without a sentTimestamp');
  }
  // don't include our profileKey on syncing message. This is to be done by a ConfigurationMessage now
  const timestamp = _.toNumber(sentTimestamp);
  if (dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE) {
    return buildSyncExpireTimerMessage(identifier, dataMessage, timestamp, syncTarget);
  }
  return buildSyncVisibleMessage(identifier, dataMessage, timestamp, syncTarget);
};
