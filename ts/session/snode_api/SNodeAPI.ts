// we don't throw or catch here
import { default as insecureNodeFetch } from 'node-fetch';
import https from 'https';

import fs from 'fs';
import path from 'path';
import tls from 'tls';
import Electron from 'electron';

const { remote } = Electron;

import { snodeRpc } from './lokiRpc';

import {
  getRandomSnode,
  getRandomSnodePool,
  getSwarmFor,
  requiredSnodesForAgreement,
} from './snodePool';
import { Constants } from '..';
import { getSodium, sha256 } from '../crypto';
import _, { range } from 'lodash';
import pRetry from 'p-retry';
import {
  fromBase64ToArray,
  fromHexToArray,
  fromUInt8ArrayToBase64,
  stringToUint8Array,
  toHex,
} from '../utils/String';
import { Snode } from '../../data/data';
import { updateIsOnline } from '../../state/ducks/onion';
import { ed25519Str } from '../onions/onionPath';
import { StringUtils, UserUtils } from '../utils';

// ONS name can have [a-zA-Z0-9_-] except that - is not allowed as start or end
// do not define a regex but rather create it on the fly to avoid https://stackoverflow.com/questions/3891641/regex-test-only-works-every-other-time
export const onsNameRegex = '^\\w([\\w-]*[\\w])?$';

export const ERROR_CODE_NO_CONNECT = 'ENETUNREACH: No network connection.';

const getSslAgentForSeedNode = (seedNodeHost: string, isSsl = false) => {
  let filePrefix = '';
  let pubkey256 = '';
  let cert256 = '';
  if (!isSsl) {
    return undefined;
  }

  switch (seedNodeHost) {
    case 'storage.seed1.loki.network':
      filePrefix = 'storage-seed-1';
      pubkey256 = 'JOsnIcAanVbgECNA8lHtC8f/cqN9m8EP7jKT6XCjeL8=';
      cert256 =
        '6E:2B:AC:F3:6E:C1:FF:FF:24:F3:CA:92:C6:94:81:B4:82:43:DF:C7:C6:03:98:B8:F5:6B:7D:30:7B:16:C1:CB';
      break;
    case 'storage.seed3.loki.network':
      filePrefix = 'storage-seed-3';
      pubkey256 = 'mMmZD3lG4Fi7nTC/EWzRVaU3bbCLsH6Ds2FHSTpo0Rk=';
      cert256 =
        '24:13:4C:0A:03:D8:42:A6:09:DE:35:76:F4:BD:FB:11:60:DB:F9:88:9F:98:46:B7:60:A6:60:0C:4C:CF:60:72';

      break;
    case 'public.loki.foundation':
      filePrefix = 'public-loki-foundation';
      pubkey256 = 'W+Zv52qlcm1BbdpJzFwxZrE7kfmEboq7h3Dp/+Q3RPg=';
      cert256 =
        '40:E4:67:7D:18:6B:4D:08:8D:E9:D5:47:52:25:B8:28:E0:D3:63:99:9B:38:46:7D:92:19:5B:61:B9:AE:0E:EA';

      break;

    default:
      throw new Error(`Unknown seed node: ${seedNodeHost}`);
  }
  // tslint:disable: non-literal-fs-path
  // read the cert each time. We only run this request once for each seed node nevertheless.
  const appPath = remote.app.getAppPath();
  const crt = fs.readFileSync(path.join(appPath, `/certificates/${filePrefix}.crt`), 'utf-8');
  const sslOptions = {
    // as the seed nodes are using a self signed certificate, we have to provide it here.
    ca: crt,
    // we have to reject them, otherwise our errors returned in the checkServerIdentity are simply not making the call fail.
    // so in production, rejectUnauthorized must be true.
    rejectUnauthorized: true,
    keepAlive: false,
    checkServerIdentity: (host: string, cert: any) => {
      // Make sure the certificate is issued to the host we are connected to
      const err = tls.checkServerIdentity(host, cert);
      if (err) {
        return err;
      }

      // Pin the public key, similar to HPKP pin-sha25 pinning
      if (sha256(cert.pubkey) !== pubkey256) {
        const msg =
          'Certificate verification error: ' +
          `The public key of '${cert.subject.CN}' ` +
          'does not match our pinned fingerprint';
        return new Error(msg);
      }

      // Pin the exact certificate, rather than the pub key
      if (cert.fingerprint256 !== cert256) {
        const msg =
          'Certificate verification error: ' +
          `The certificate of '${cert.subject.CN}' ` +
          'does not match our pinned fingerprint';
        return new Error(msg);
      }
      return undefined;
    },
  };

  // we're creating a new Agent that will now use the certs we have configured
  return new https.Agent(sslOptions);
};

export async function getSnodesFromSeedUrl(urlObj: URL): Promise<Array<any>> {
  // Removed limit until there is a way to get snode info
  // for individual nodes (needed for guard nodes);  this way
  // we get all active nodes
  window?.log?.info(`getSnodesFromSeedUrl starting with ${urlObj.href}`);

  const params = {
    active_only: true,
    fields: {
      public_ip: true,
      storage_port: true,
      pubkey_x25519: true,
      pubkey_ed25519: true,
    },
  };

  const endpoint = 'json_rpc';
  const url = `${urlObj.href}${endpoint}`;

  const body = {
    jsonrpc: '2.0',
    id: '0',
    method: 'get_n_service_nodes',
    params,
  };

  const sslAgent = getSslAgentForSeedNode(
    urlObj.hostname,
    urlObj.protocol !== Constants.PROTOCOLS.HTTP
  );

  const fetchOptions = {
    method: 'POST',
    timeout: 5000,
    body: JSON.stringify(body),
    headers: {
      'User-Agent': 'WhatsApp',
      'Accept-Language': 'en-us',
    },
    agent: sslAgent,
  };
  window?.log?.info('insecureNodeFetch => plaintext for getSnodesFromSeedUrl');

  const response = await insecureNodeFetch(url, fetchOptions);

  if (response.status !== 200) {
    window?.log?.error(
      `loki_snode_api:::getSnodesFromSeedUrl - invalid response from seed ${urlObj.toString()}:`,
      response
    );
    return [];
  }

  if (response.headers.get('Content-Type') !== 'application/json') {
    window?.log?.error('Response is not json');
    return [];
  }

  try {
    const json = await response.json();

    // TODO: validate that all of the fields are present?
    const result = json.result;

    if (!result) {
      window?.log?.error(
        `loki_snode_api:::getSnodesFromSeedUrl - invalid result from seed ${urlObj.toString()}:`,
        response
      );
      return [];
    }
    // Filter 0.0.0.0 nodes which haven't submitted uptime proofs
    return result.service_node_states.filter((snode: any) => snode.public_ip !== '0.0.0.0');
  } catch (e) {
    window?.log?.error('Invalid json response');
    return [];
  }
}

export type SendParams = {
  pubKey: string;
  ttl: string;
  timestamp: string;
  data: string;
};

// get snodes for pubkey from random snode. Uses an existing snode

async function requestSnodesForPubkeyWithTargetNodeRetryable(
  pubKey: string,
  targetNode: Snode
): Promise<Array<Snode>> {
  const params = {
    pubKey,
  };
  const result = await snodeRpc('get_snodes_for_pubkey', params, targetNode, pubKey);

  if (!result) {
    window?.log?.warn(
      `LokiSnodeAPI::requestSnodesForPubkeyWithTargetNodeRetryable - lokiRpc on ${targetNode.ip}:${targetNode.port} returned falsish value`,
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
        `LokiSnodeAPI::requestSnodesForPubkeyRetryable - lokiRpc on ${targetNode.ip}:${targetNode.port} returned falsish value for snodes`,
        result
      );
      throw new Error('Invalid json (empty)');
    }

    const snodes = json.snodes.filter((tSnode: any) => tSnode.ip !== '0.0.0.0');
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
    window?.log?.error('LokiSnodeAPI::requestSnodesForPubkey - error', e);

    return [];
  }
}

export async function getSessionIDForOnsName(onsNameCase: string) {
  const validationCount = 3;

  const onsNameLowerCase = onsNameCase.toLowerCase();
  const sodium = await getSodium();
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
    const result = await snodeRpc('oxend_request', params, targetNode);
    if (!result || result.status !== 200 || !result.body) {
      throw new Error('ONSresolve:Failed to resolve ONS');
    }
    let parsedBody;

    try {
      parsedBody = JSON.parse(result.body);
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
 * Return the list of nodes all snodes agreed on.
 */
export async function getSnodePoolFromSnodes() {
  const existingSnodePool = await getRandomSnodePool();
  if (existingSnodePool.length < 3) {
    window?.log?.warn('cannot get snodes from snodes; not enough snodes', existingSnodePool.length);
    return;
  }

  // Note intersectionWith only works with 3 at most array to find the common snodes.
  const nodesToRequest = _.sampleSize(existingSnodePool, 3);
  const results = await Promise.all(
    nodesToRequest.map(async node => {
      // this call is already retried if the snode does not reply
      // at least when onion requests enabled
      return getSnodePoolFromSnode(node);
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
    throw new Error('inconsistentSnodePools');
  }
  return commonSnodes;
}

/**
 * Returns a list of uniq snodes got from the specified targetNode.
 * This is exported for testing purpose only
 */
export async function getSnodePoolFromSnode(targetNode: Snode): Promise<Array<Snode>> {
  const params = {
    endpoint: 'get_service_nodes',
    params: {
      active_only: true,
      // limit: 256,
      fields: {
        public_ip: true,
        storage_port: true,
        pubkey_x25519: true,
        pubkey_ed25519: true,
      },
    },
  };
  const result = await snodeRpc('oxend_request', params, targetNode);
  if (!result || result.status !== 200) {
    throw new Error('Invalid result');
  }

  try {
    const json = JSON.parse(result.body);

    if (!json || !json.result || !json.result.service_node_states?.length) {
      window?.log?.error(
        'loki_snode_api:::getSnodePoolFromSnode - invalid result from seed',
        result.body
      );
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
        version: '',
      })) as Array<Snode>;

    // we the return list by the snode is already made of uniq snodes
    return _.compact(snodes);
  } catch (e) {
    window?.log?.error('Invalid json response');
    return [];
  }
}

export async function storeOnNode(targetNode: Snode, params: SendParams): Promise<boolean> {
  try {
    // no retry here. If an issue is with the path this is handled in lokiOnionFetch
    // if there is an issue with the targetNode, we still send a few times this request to a few snodes in // already so it's handled
    const result = await snodeRpc('store', params, targetNode, params.pubKey);

    if (!result || result.status !== 200) {
      return false;
    }

    return true;
  } catch (e) {
    window?.log?.warn(
      'loki_message:::store - send error:',
      e,
      `destination ${targetNode.ip}:${targetNode.port}`
    );
    throw e;
  }
}

/** */
export async function retrieveNextMessages(
  targetNode: Snode,
  lastHash: string,
  associatedWith: string
): Promise<Array<any>> {
  const params = {
    pubKey: associatedWith,
    lastHash: lastHash || '',
  };

  // let exceptions bubble up
  // no retry for this one as this a call we do every few seconds while polling for messages
  const result = await snodeRpc('retrieve', params, targetNode, associatedWith);

  if (!result) {
    window?.log?.warn(
      `loki_message:::_retrieveNextMessages - lokiRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
    throw new Error(
      `loki_message:::_retrieveNextMessages - lokiRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
  }

  if (result.status !== 200) {
    window?.log?.warn('retrieve result is not 200');
    throw new Error(
      `loki_message:::_retrieveNextMessages - retrieve result is not 200 with ${targetNode.ip}:${targetNode.port}`
    );
  }

  try {
    const json = JSON.parse(result.body);
    window.inboxStore?.dispatch(updateIsOnline(true));

    return json.messages || [];
  } catch (e) {
    window?.log?.warn('exception while parsing json of nextMessage:', e);
    window.inboxStore?.dispatch(updateIsOnline(true));
    throw new Error(
      `loki_message:::_retrieveNextMessages - exception while parsing json of nextMessage ${targetNode.ip}:${targetNode.port}: ${e?.message}`
    );
  }
}

/**
 * Makes a post to a node to receive the timestamp info. If non-existant, returns -1
 * @param snode Snode to send request to
 * @returns timestamp of the response from snode
 */
// tslint:disable-next-line: variable-name
export const TEST_getNetworkTime = async (snode: Snode): Promise<string | number> => {
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
            const timestamp = await exports.TEST_getNetworkTime(snodeToMakeRequestTo);

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
                      window?.log?.warn(
                        `Could not delete data from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )} due to error: ${reason}: ${statusCode}`
                      );
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
            `delete_all OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
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
