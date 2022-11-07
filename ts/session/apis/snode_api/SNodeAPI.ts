import { snodeRpc } from './sessionRpc';

import { getSwarmFor } from './snodePool';
import { getSodiumRenderer } from '../../crypto';
import _, { compact, sample } from 'lodash';
import pRetry from 'p-retry';
import { fromBase64ToArray, fromHexToArray, fromUInt8ArrayToBase64 } from '../../utils/String';
import { Snode } from '../../../data/data';
import { ed25519Str } from '../../onions/onionPath';
import { StringUtils, UserUtils } from '../../utils';
import { GetNetworkTime } from './getNetworkTime';

export const ERROR_CODE_NO_CONNECT = 'ENETUNREACH: No network connection.';

// tslint:disable-next-line: max-func-body-length
const forceNetworkDeletion = async (): Promise<Array<string> | null> => {
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
        const snodeToMakeRequestTo: Snode | undefined = sample(userSwarm);
        const edKeyPrivBytes = fromHexToArray(edKeyPriv);

        if (!snodeToMakeRequestTo) {
          window?.log?.warn('Cannot forceNetworkDeletion, without a valid swarm node.');
          return null;
        }

        return pRetry(
          async () => {
            const timestamp = await GetNetworkTime.getNetworkTime(snodeToMakeRequestTo);

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
              const results: Array<string> = compact(
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
            minTimeout: SnodeAPI.TEST_getMinTimeout(),
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
        minTimeout: SnodeAPI.TEST_getMinTimeout(),
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
const TEST_getMinTimeout = () => 500;

/**
 * Locally deletes message and deletes message on the network (all nodes that contain the message)
 */
// tslint:disable-next-line: max-func-body-length
const networkDeleteMessages = async (hashes: Array<string>): Promise<Array<string> | null> => {
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
        const snodeToMakeRequestTo: Snode | undefined = sample(userSwarm);
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
              const results: Array<string> = compact(
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
            minTimeout: SnodeAPI.TEST_getMinTimeout(),
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
        minTimeout: SnodeAPI.TEST_getMinTimeout(),
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

export const SnodeAPI = {
  TEST_getMinTimeout,
  networkDeleteMessages,
  forceNetworkDeletion,
};
