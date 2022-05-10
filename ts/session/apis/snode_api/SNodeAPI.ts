import { snodeRpc } from './sessionRpc';

import {
  getRandomSnode,
  getSwarmFor,
  minSnodePoolCount,
  requiredSnodesForAgreement,
} from './snodePool';
import { getSodiumRenderer } from '../../crypto';
import _, { isEmpty, range } from 'lodash';
import pRetry from 'p-retry';
import {
  fromBase64ToArray,
  fromHexToArray,
  fromUInt8ArrayToBase64,
  stringToUint8Array,
  toHex,
} from '../../utils/String';
import { Snode } from '../../../data/data';
import { updateIsOnline } from '../../../state/ducks/onion';
import { ed25519Str } from '../../onions/onionPath';
import { StringUtils, UserUtils } from '../../utils';
import { SnodePool } from '.';
import { handleHardforkResult } from './hfHandling';

// ONS name can have [a-zA-Z0-9_-] except that - is not allowed as start or end
// do not define a regex but rather create it on the fly to avoid https://stackoverflow.com/questions/3891641/regex-test-only-works-every-other-time
export const onsNameRegex = '^\\w([\\w-]*[\\w])?$';

export const ERROR_CODE_NO_CONNECT = 'ENETUNREACH: No network connection.';

let latestTimestampOffset = Number.MAX_SAFE_INTEGER;

function handleTimestampOffset(_request: string, snodeTimestamp: number) {
  if (snodeTimestamp && _.isNumber(snodeTimestamp) && snodeTimestamp > 1609419600 * 1000) {
    // first january 2021. Arbitrary, just want to make sure the return timestamp is somehow valid and not some crazy low value
    const now = Date.now();
    // window?.log?.info(`timestamp offset from request ${request}:  ${now - snodeTimestamp}ms`);
    latestTimestampOffset = now - snodeTimestamp;
  }
}

/**
 * This function has no use to be called except during tests.
 * @returns the current offset we have with the rest of the network.
 */
export function getLatestTimestampOffset() {
  if (latestTimestampOffset === Number.MAX_SAFE_INTEGER) {
    window.log.warn('latestTimestampOffset is not set yet');
    return 0;
  }
  // window.log.info('latestTimestampOffset is ', latestTimestampOffset);

  return latestTimestampOffset;
}

export function getNowWithNetworkOffset() {
  // make sure to call exports here, as we stub the exported one for testing.
  return Date.now() - exports.getLatestTimestampOffset();
}

export type SendParams = {
  pubKey: string;
  ttl: string;
  timestamp: string;
  data: string;
  isSyncMessage?: boolean;
  messageId?: string;
  namespace: number;
};

/**
 * get snodes for pubkey from random snode. Uses an existing snode
 */
async function requestSnodesForPubkeyWithTargetNodeRetryable(
  pubKey: string,
  targetNode: Snode
): Promise<Array<Snode>> {
  const params = {
    pubKey,
  };

  const result = await snodeRpc({
    method: 'get_snodes_for_pubkey',
    params,
    targetNode,
    associatedWith: pubKey,
  });
  if (!result) {
    window?.log?.warn(
      `SessionSnodeAPI::requestSnodesForPubkeyWithTargetNodeRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsish value`,
      result
    );
    throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid result');
  }

  if (result.status !== 200) {
    window?.log?.warn('Status is not 200 for get_snodes_for_pubkey');
    throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid status code');
  }

  try {
    const json = JSON.parse(result.body);

    if (!json.snodes) {
      // we hit this when snode gives 500s
      window?.log?.warn(
        `SessionSnodeAPI::requestSnodesForPubkeyRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsish value for snodes`,
        result
      );
      throw new Error('Invalid json (empty)');
    }

    const snodes = json.snodes.filter((tSnode: any) => tSnode.ip !== '0.0.0.0');
    handleTimestampOffset('get_snodes_for_pubkey', json.t);
    return snodes;
  } catch (e) {
    throw new Error('Invalid json');
  }
}

async function requestSnodesForPubkeyWithTargetNode(
  pubKey: string,
  targetNode: Snode
): Promise<Array<Snode>> {
  // don't catch exception in here. we want them to bubble up

  // this is the level where our targetNode is supposed to be valid. We retry a few times with this one.
  // if all our retries fails, we retry from the caller of this function with a new target node.
  return pRetry(
    async () => {
      return requestSnodesForPubkeyWithTargetNodeRetryable(pubKey, targetNode);
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 100,
      maxTimeout: 2000,
      onFailedAttempt: e => {
        window?.log?.warn(
          `requestSnodesForPubkeyWithTargetNode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
        );
      },
    }
  );
}

async function requestSnodesForPubkeyRetryable(pubKey: string): Promise<Array<Snode>> {
  // don't catch exception in here. we want them to bubble up

  // this is the level where our targetNode is not yet known. We retry a few times with a new one everytime.
  // the idea is that the requestSnodesForPubkeyWithTargetNode will remove a failing targetNode
  return pRetry(
    async () => {
      const targetNode = await getRandomSnode();

      return requestSnodesForPubkeyWithTargetNode(pubKey, targetNode);
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 100,
      maxTimeout: 4000,
      onFailedAttempt: e => {
        window?.log?.warn(
          `requestSnodesForPubkeyRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
        );
      },
    }
  );
}

export async function requestSnodesForPubkey(pubKey: string): Promise<Array<Snode>> {
  try {
    // catch exception in here only.
    // the idea is that the pretry will retry a few times each calls, except if an AbortError is thrown.

    // if all retry fails, we will end up in the catch below when the last exception thrown
    return await requestSnodesForPubkeyRetryable(pubKey);
  } catch (e) {
    window?.log?.error('SessionSnodeAPI::requestSnodesForPubkey - error', e);

    return [];
  }
}

export async function getSessionIDForOnsName(onsNameCase: string) {
  const validationCount = 3;

  const onsNameLowerCase = onsNameCase.toLowerCase();
  const sodium = await getSodiumRenderer();
  const nameAsData = stringToUint8Array(onsNameLowerCase);
  const nameHash = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData);
  const base64EncodedNameHash = fromUInt8ArrayToBase64(nameHash);

  const params = {
    endpoint: 'ons_resolve',
    params: {
      type: 0,
      name_hash: base64EncodedNameHash,
    },
  };
  // we do this request with validationCount snodes
  const promises = range(0, validationCount).map(async () => {
    const targetNode = await getRandomSnode();
    const result = await snodeRpc({ method: 'oxend_request', params, targetNode });
    if (!result || result.status !== 200 || !result.body) {
      throw new Error('ONSresolve:Failed to resolve ONS');
    }
    let parsedBody;

    try {
      parsedBody = JSON.parse(result.body);
      handleTimestampOffset('ons_resolve', parsedBody.t);
    } catch (e) {
      window?.log?.warn('ONSresolve: failed to parse ons result body', result.body);
      throw new Error('ONSresolve: json ONS resovle');
    }
    const intermediate = parsedBody?.result;

    if (!intermediate || !intermediate?.encrypted_value) {
      throw new Error('ONSresolve: no encrypted_value');
    }
    const hexEncodedCipherText = intermediate?.encrypted_value;

    const isArgon2Based = !Boolean(intermediate?.nonce);
    const ciphertext = fromHexToArray(hexEncodedCipherText);
    let sessionIDAsData: Uint8Array;
    let nonce: Uint8Array;
    let key: Uint8Array;

    if (isArgon2Based) {
      // Handle old Argon2-based encryption used before HF16
      const salt = new Uint8Array(sodium.crypto_pwhash_SALTBYTES);
      nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
      try {
        const keyHex = sodium.crypto_pwhash(
          sodium.crypto_secretbox_KEYBYTES,
          onsNameLowerCase,
          salt,
          sodium.crypto_pwhash_OPSLIMIT_MODERATE,
          sodium.crypto_pwhash_MEMLIMIT_MODERATE,
          sodium.crypto_pwhash_ALG_ARGON2ID13,
          'hex'
        );
        if (!keyHex) {
          throw new Error('ONSresolve: key invalid argon2');
        }
        key = fromHexToArray(keyHex);
      } catch (e) {
        throw new Error('ONSresolve: Hashing failed');
      }

      sessionIDAsData = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
      if (!sessionIDAsData) {
        throw new Error('ONSresolve: Decryption failed');
      }

      return toHex(sessionIDAsData);
    }

    // not argon2Based
    const hexEncodedNonce = intermediate.nonce as string;
    if (!hexEncodedNonce) {
      throw new Error('ONSresolve: No hexEncodedNonce');
    }
    nonce = fromHexToArray(hexEncodedNonce);

    try {
      key = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData, nameHash);
      if (!key) {
        throw new Error('ONSresolve: Hashing failed');
      }
    } catch (e) {
      window?.log?.warn('ONSresolve: hashing failed', e);
      throw new Error('ONSresolve: Hashing failed');
    }

    sessionIDAsData = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      key
    );

    if (!sessionIDAsData) {
      throw new Error('ONSresolve: Decryption failed');
    }

    return toHex(sessionIDAsData);
  });

  try {
    // if one promise throws, we end un the catch case
    const allResolvedSessionIds = await Promise.all(promises);
    if (allResolvedSessionIds?.length !== validationCount) {
      throw new Error('ONSresolve: Validation failed');
    }

    // assert all the returned session ids are the same
    if (_.uniq(allResolvedSessionIds).length !== 1) {
      throw new Error('ONSresolve: Validation failed');
    }
    return allResolvedSessionIds[0];
  } catch (e) {
    window.log.warn('ONSresolve: error', e);
    throw e;
  }
}

/**
 * Try to fetch from 3 different snodes an updated list of snodes.
 * If we get less than 24 common snodes in those result, we consider the request to failed and an exception is thrown.
 * The three snode we make the request to is randomized.
 * This function is to be called with a pRetry so that if one snode does not reply anything, another might be choose next time.
 * Return the list of nodes all snodes agreed on.
 */
export async function getSnodePoolFromSnodes() {
  const existingSnodePool = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();
  if (existingSnodePool.length <= minSnodePoolCount) {
    window?.log?.warn(
      'getSnodePoolFromSnodes: Cannot get snodes list from snodes; not enough snodes',
      existingSnodePool.length
    );
    throw new Error(
      `Cannot get snodes list from snodes; not enough snodes even after refetching from seed', ${existingSnodePool.length}`
    );
  }

  // Note intersectionWith only works with 3 at most array to find the common snodes.
  const nodesToRequest = _.sampleSize(existingSnodePool, 3);
  const results = await Promise.all(
    nodesToRequest.map(async node => {
      /**
       * this call is already retried if the snode does not reply
       * (at least when onion requests are enabled)
       * this request might want to rebuild a path if the snode length gets < minSnodePoolCount during the
       * retries, so we need to make sure this does not happen.
       *
       * Remember that here, we are trying to fetch from snodes the updated list of snodes to rebuild a path.
       * If we don't disable rebuilding a path below, this gets to a chicken and egg problem.
       */
      return TEST_getSnodePoolFromSnode(node);
    })
  );

  // we want those at least `requiredSnodesForAgreement` snodes common between all the result
  const commonSnodes = _.intersectionWith(
    results[0],
    results[1],
    results[2],
    (s1: Snode, s2: Snode) => {
      return s1.ip === s2.ip && s1.port === s2.port;
    }
  );
  // We want the snodes to agree on at least this many snodes
  if (commonSnodes.length < requiredSnodesForAgreement) {
    throw new Error(
      `Inconsistent snode pools. We did not get at least ${requiredSnodesForAgreement} in common`
    );
  }
  return commonSnodes;
}

/**
 * Returns a list of unique snodes got from the specified targetNode.
 * This function won't try to rebuild a path if at some point we don't have enough snodes.
 * This is exported for testing purpose only
 */
// tslint:disable-next-line: function-name
export async function TEST_getSnodePoolFromSnode(targetNode: Snode): Promise<Array<Snode>> {
  const params = {
    endpoint: 'get_service_nodes',
    params: {
      active_only: true,
      fields: {
        public_ip: true,
        storage_port: true,
        pubkey_x25519: true,
        pubkey_ed25519: true,
      },
    },
  };
  const result = await snodeRpc({
    method: 'oxend_request',
    params,
    targetNode,
  });
  if (!result || result.status !== 200) {
    throw new Error('Invalid result');
  }

  try {
    const json = JSON.parse(result.body);

    if (!json || !json.result || !json.result.service_node_states?.length) {
      window?.log?.error('getSnodePoolFromSnode - invalid result from snode', result.body);
      return [];
    }

    // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
    const snodes = json.result.service_node_states
      .filter((snode: any) => snode.public_ip !== '0.0.0.0')
      .map((snode: any) => ({
        ip: snode.public_ip,
        port: snode.storage_port,
        pubkey_x25519: snode.pubkey_x25519,
        pubkey_ed25519: snode.pubkey_ed25519,
      })) as Array<Snode>;
    handleTimestampOffset('get_service_nodes', json.t);

    // we the return list by the snode is already made of uniq snodes
    return _.compact(snodes);
  } catch (e) {
    window?.log?.error('Invalid json response');
    return [];
  }
}

export async function storeOnNode(
  targetNode: Snode,
  params: SendParams
): Promise<string | null | boolean> {
  try {
    // no retry here. If an issue is with the path this is handled in lokiOnionFetch
    // if there is an issue with the targetNode, we still send a few times this request to a few snodes in // already so it's handled
    const result = await snodeRpc({
      method: 'store',
      params,
      targetNode,
      associatedWith: params.pubKey,
    });

    if (!result || result.status !== 200 || !result.body) {
      return false;
    }

    try {
      const parsed = JSON.parse(result.body);
      handleTimestampOffset('store', parsed.t);
      await handleHardforkResult(parsed);

      const messageHash = parsed.hash;
      if (messageHash) {
        return messageHash;
      }

      return true;
    } catch (e) {
      window?.log?.warn('Failed to parse "store" result: ', e.msg);
    }
    return false;
  } catch (e) {
    window?.log?.warn('store - send error:', e, `destination ${targetNode.ip}:${targetNode.port}`);
    throw e;
  }
}

async function getRetrieveSignatureParams(
  params: RetrieveRequestParams
): Promise<{ timestamp: number; signature: string; pubkey_ed25519: string } | null> {
  const ourPubkey = UserUtils.getOurPubKeyFromCache();
  const ourEd25519Key = await UserUtils.getUserED25519KeyPair();

  if (isEmpty(params?.pubKey) || ourPubkey.key !== params.pubKey || !ourEd25519Key) {
    return null;
  }
  const hasNamespace = params.namespace && params.namespace !== 0;
  const namespace = params.namespace || 0;
  const edKeyPrivBytes = fromHexToArray(ourEd25519Key?.privKey);

  const signatureTimestamp = getNowWithNetworkOffset();

  const verificationData = hasNamespace
    ? StringUtils.encode(`retrieve${namespace}${signatureTimestamp}`, 'utf8')
    : StringUtils.encode(`retrieve${signatureTimestamp}`, 'utf8');
  const message = new Uint8Array(verificationData);

  const sodium = await getSodiumRenderer();
  try {
    const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
    const signatureBase64 = fromUInt8ArrayToBase64(signature);

    const namespaceObject = hasNamespace ? { namespace } : {};

    return {
      timestamp: signatureTimestamp,
      signature: signatureBase64,
      pubkey_ed25519: ourEd25519Key.pubKey,
      ...namespaceObject,
    };
  } catch (e) {
    window.log.warn('getSignatureParams failed with: ', e.message);
    return null;
  }
}

type RetrieveRequestParams = {
  pubKey: string;
  lastHash: string;
  namespace?: number;
};

/** */
export async function retrieveNextMessages(
  targetNode: Snode,
  lastHash: string,
  associatedWith: string,
  namespace?: number
): Promise<Array<any>> {
  const params: RetrieveRequestParams = {
    pubKey: associatedWith,
    lastHash: lastHash || '',
    namespace,
  };

  const signatureParams = (await getRetrieveSignatureParams(params)) || {};

  // let exceptions bubble up
  // no retry for this one as this a call we do every few seconds while polling for messages
  const result = await snodeRpc({
    method: 'retrieve',
    params: { ...signatureParams, ...params },
    targetNode,
    associatedWith,
    timeout: 4000,
  });

  if (!result) {
    window?.log?.warn(
      `_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
    throw new Error(
      `_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
  }

  if (result.status !== 200) {
    window?.log?.warn('retrieve result is not 200');
    throw new Error(
      `_retrieveNextMessages - retrieve result is not 200 with ${targetNode.ip}:${targetNode.port}`
    );
  }

  try {
    const json = JSON.parse(result.body);
    if (!window.inboxStore?.getState().onionPaths.isOnline) {
      window.inboxStore?.dispatch(updateIsOnline(true));
    }

    handleTimestampOffset('retrieve', json.t);
    await handleHardforkResult(json);

    return json.messages || [];
  } catch (e) {
    window?.log?.warn('exception while parsing json of nextMessage:', e);
    if (!window.inboxStore?.getState().onionPaths.isOnline) {
      window.inboxStore?.dispatch(updateIsOnline(true));
    }
    throw new Error(
      `_retrieveNextMessages - exception while parsing json of nextMessage ${targetNode.ip}:${targetNode.port}: ${e?.message}`
    );
  }
}

/**
 * Makes a post to a node to receive the timestamp info. If non-existant, returns -1
 * @param snode Snode to send request to
 * @returns timestamp of the response from snode
 */
// tslint:disable-next-line: variable-name
export const getNetworkTime = async (snode: Snode): Promise<string | number> => {
  const response: any = await snodeRpc({ method: 'info', params: {}, targetNode: snode });
  const body = JSON.parse(response.body);
  const timestamp = body?.timestamp;
  if (!timestamp) {
    throw new Error(`getNetworkTime returned invalid timestamp: ${timestamp}`);
  }
  return timestamp;
};

// tslint:disable-next-line: max-func-body-length
export const forceNetworkDeletion = async (): Promise<Array<string> | null> => {
  const sodium = await getSodiumRenderer();
  const userX25519PublicKey = UserUtils.getOurPubKeyStrFromCache();

  const userED25519KeyPair = await UserUtils.getUserED25519KeyPair();

  if (!userED25519KeyPair) {
    window?.log?.warn('Cannot forceNetworkDeletion, did not find user ed25519 key.');
    return null;
  }
  const edKeyPriv = userED25519KeyPair.privKey;

  try {
    const maliciousSnodes = await pRetry(
      async () => {
        const userSwarm = await getSwarmFor(userX25519PublicKey);
        const snodeToMakeRequestTo: Snode | undefined = _.sample(userSwarm);
        const edKeyPrivBytes = fromHexToArray(edKeyPriv);

        if (!snodeToMakeRequestTo) {
          window?.log?.warn('Cannot forceNetworkDeletion, without a valid swarm node.');
          return null;
        }

        return pRetry(
          async () => {
            const timestamp = await exports.getNetworkTime(snodeToMakeRequestTo);

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
            const ret = await snodeRpc({
              method: 'delete_all',
              params: deleteMessageParams,
              targetNode: snodeToMakeRequestTo,
              associatedWith: userX25519PublicKey,
            });

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
                      window?.log?.warn(
                        `Could not delete data from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )} due to error: ${reason}: ${statusCode}`
                      );
                      // if we tried to make the delete on a snode not in our swarm, just trigger a pRetry error so the outer block here finds new snodes to make the request to.
                      if (statusCode === 421) {
                        throw new pRetry.AbortError(
                          '421 error on network delete_all. Retrying with a new snode'
                        );
                      }
                    } else {
                      window?.log?.warn(
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
            minTimeout: exports.TEST_getMinTimeout(),
            onFailedAttempt: e => {
              window?.log?.warn(
                `delete_all INNER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
              );
            },
          }
        );
      },
      {
        retries: 3,
        minTimeout: exports.TEST_getMinTimeout(),
        onFailedAttempt: e => {
          window?.log?.warn(
            `delete_all OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... ${e.message}`
          );
        },
      }
    );

    return maliciousSnodes;
  } catch (e) {
    window?.log?.warn('failed to delete everything on network:', e);
    return null;
  }
};

// tslint:disable-next-line: variable-name
export const TEST_getMinTimeout = () => 500;

/**
 * Locally deletes message and deletes message on the network (all nodes that contain the message)
 */
// tslint:disable-next-line: max-func-body-length
export const networkDeleteMessages = async (
  hashes: Array<string>
): Promise<Array<string> | null> => {
  const sodium = await getSodiumRenderer();
  const userX25519PublicKey = UserUtils.getOurPubKeyStrFromCache();

  const userED25519KeyPair = await UserUtils.getUserED25519KeyPair();

  if (!userED25519KeyPair) {
    window?.log?.warn('Cannot networkDeleteMessages, did not find user ed25519 key.');
    return null;
  }
  const edKeyPriv = userED25519KeyPair.privKey;

  try {
    const maliciousSnodes = await pRetry(
      async () => {
        const userSwarm = await getSwarmFor(userX25519PublicKey);
        const snodeToMakeRequestTo: Snode | undefined = _.sample(userSwarm);
        const edKeyPrivBytes = fromHexToArray(edKeyPriv);

        if (!snodeToMakeRequestTo) {
          window?.log?.warn('Cannot networkDeleteMessages, without a valid swarm node.');
          return null;
        }

        return pRetry(
          async () => {
            const verificationData = StringUtils.encode(`delete${hashes.join('')}`, 'utf8');
            const message = new Uint8Array(verificationData);
            const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
            const signatureBase64 = fromUInt8ArrayToBase64(signature);

            const deleteMessageParams = {
              pubkey: userX25519PublicKey,
              pubkey_ed25519: userED25519KeyPair.pubKey.toUpperCase(),
              messages: hashes,
              signature: signatureBase64,
            };
            const ret = await snodeRpc({
              method: 'delete',
              params: deleteMessageParams,
              targetNode: snodeToMakeRequestTo,
              associatedWith: userX25519PublicKey,
            });
            if (!ret) {
              throw new Error(
                `Empty response got for delete on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}`
              );
            }

            try {
              const parsedResponse = JSON.parse(ret.body);
              const { swarm } = parsedResponse;

              if (!swarm) {
                throw new Error(
                  `Invalid JSON swarm response got for delete on snode ${ed25519Str(
                    snodeToMakeRequestTo.pubkey_ed25519
                  )}, ${ret?.body}`
                );
              }
              const swarmAsArray = Object.entries(swarm) as Array<Array<any>>;
              if (!swarmAsArray.length) {
                throw new Error(
                  `Invalid JSON swarmAsArray response got for delete on snode ${ed25519Str(
                    snodeToMakeRequestTo.pubkey_ed25519
                  )}, ${ret?.body}`
                );
              }
              // results will only contains the snode pubkeys which returned invalid/empty results
              const results: Array<string> = _.compact(
                swarmAsArray.map(snode => {
                  const snodePubkey = snode[0];
                  const snodeJson = snode[1];

                  //#region failure handling
                  const isFailed = snodeJson.failed || false;

                  if (isFailed) {
                    const reason = snodeJson.reason;
                    const statusCode = snodeJson.code;
                    if (reason && statusCode) {
                      window?.log?.warn(
                        `Could not delete msgs from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )} due to error: ${reason}: ${statusCode}`
                      );
                      // if we tried to make the delete on a snode not in our swarm, just trigger a pRetry error so the outer block here finds new snodes to make the request to.
                      if (statusCode === 421) {
                        throw new pRetry.AbortError(
                          '421 error on network delete_all. Retrying with a new snode'
                        );
                      }
                    } else {
                      window?.log?.info(
                        `Could not delete msgs from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )}`
                      );
                    }
                    return snodePubkey;
                  }
                  //#endregion

                  //#region verification
                  const responseHashes = snodeJson.deleted as Array<string>;
                  const signatureSnode = snodeJson.signature as string;
                  // The signature looks like ( PUBKEY_HEX || RMSG[0] || ... || RMSG[N] || DMSG[0] || ... || DMSG[M] )
                  const dataToVerify = `${userX25519PublicKey}${hashes.join(
                    ''
                  )}${responseHashes.join('')}`;
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
                  //#endregion
                })
              );

              return results;
            } catch (e) {
              throw new Error(
                `Invalid JSON response got for delete on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}, ${ret?.body}`
              );
            }
          },
          {
            retries: 3,
            minTimeout: exports.TEST_getMinTimeout(),
            onFailedAttempt: e => {
              window?.log?.warn(
                `delete INNER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
              );
            },
          }
        );
      },
      {
        retries: 3,
        minTimeout: exports.TEST_getMinTimeout(),
        onFailedAttempt: e => {
          window?.log?.warn(
            `delete OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
          );
        },
      }
    );

    return maliciousSnodes;
  } catch (e) {
    window?.log?.warn('failed to delete message on network:', e);
    return null;
  }
};
