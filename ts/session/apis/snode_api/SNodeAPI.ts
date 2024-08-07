/* eslint-disable no-prototype-builtins */
/* eslint-disable no-restricted-syntax */
import { compact, sample } from 'lodash';
import pRetry from 'p-retry';
import { Snode } from '../../../data/types';
import { getSodiumRenderer } from '../../crypto';
import { StringUtils, UserUtils } from '../../utils';
import { ed25519Str, fromBase64ToArray, fromHexToArray } from '../../utils/String';
import { doSnodeBatchRequest } from './batchRequest';
import { getSwarmFor } from './snodePool';
import { SnodeSignature } from './snodeSignatures';

export const ERROR_CODE_NO_CONNECT = 'ENETUNREACH: No network connection.';

// TODOLATER we should merge those two functions together as they are almost exactly the same
const forceNetworkDeletion = async (): Promise<Array<string> | null> => {
  const sodium = await getSodiumRenderer();
  const userX25519PublicKey = UserUtils.getOurPubKeyStrFromCache();

  const userED25519KeyPair = await UserUtils.getUserED25519KeyPair();

  if (!userED25519KeyPair) {
    window?.log?.warn('Cannot forceNetworkDeletion, did not find user ed25519 key.');
    return null;
  }
  const method = 'delete_all' as const;
  const namespace = 'all' as const;

  try {
    const maliciousSnodes = await pRetry(
      async () => {
        const userSwarm = await getSwarmFor(userX25519PublicKey);
        const snodeToMakeRequestTo: Snode | undefined = sample(userSwarm);

        if (!snodeToMakeRequestTo) {
          window?.log?.warn('Cannot forceNetworkDeletion, without a valid swarm node.');
          return null;
        }

        return pRetry(
          async () => {
            const signOpts = await SnodeSignature.getSnodeSignatureParams({
              method,
              namespace,
              pubkey: userX25519PublicKey,
            });

            const ret = await doSnodeBatchRequest(
              [{ method, params: { ...signOpts, namespace } }],
              snodeToMakeRequestTo,
              10000,
              userX25519PublicKey
            );

            if (!ret || !ret?.[0].body || ret[0].code !== 200) {
              throw new Error(
                `Empty response got for ${method} on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}`
              );
            }

            try {
              const firstResultParsedBody = ret[0].body;
              const { swarm } = firstResultParsedBody;

              if (!swarm) {
                throw new Error(
                  `Invalid JSON swarm response got for ${method} on snode ${ed25519Str(
                    snodeToMakeRequestTo.pubkey_ed25519
                  )}, ${firstResultParsedBody}`
                );
              }
              const swarmAsArray = Object.entries(swarm) as Array<Array<any>>;
              if (!swarmAsArray.length) {
                throw new Error(
                  `Invalid JSON swarmAsArray response got for ${method} on snode ${ed25519Str(
                    snodeToMakeRequestTo.pubkey_ed25519
                  )}, ${firstResultParsedBody}`
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
                        `Could not ${method} from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )} due to error: ${reason}: ${statusCode}`
                      );
                      // if we tried to make the delete on a snode not in our swarm, just trigger a pRetry error so the outer block here finds new snodes to make the request to.
                      if (statusCode === 421) {
                        throw new pRetry.AbortError(
                          `421 error on network ${method}. Retrying with a new snode`
                        );
                      }
                    } else {
                      window?.log?.warn(
                        `Could not ${method} from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )}`
                      );
                    }
                    return snodePubkey;
                  }

                  const deletedObj = snodeJson.deleted as Record<number, Array<string>>;
                  const hashes: Array<string> = [];

                  for (const key in deletedObj) {
                    if (deletedObj.hasOwnProperty(key)) {
                      hashes.push(...deletedObj[key]);
                    }
                  }
                  const sortedHashes = hashes.sort();
                  const signatureSnode = snodeJson.signature as string;
                  // The signature format is (with sortedHashes accross all namespaces) ( PUBKEY_HEX || TIMESTAMP || DELETEDHASH[0] || ... || DELETEDHASH[N] )
                  const dataToVerify = `${userX25519PublicKey}${
                    signOpts.timestamp
                  }${sortedHashes.join('')}`;

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
                `Invalid JSON response got for ${method} on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}, ${ret}`
              );
            }
          },
          {
            retries: 3,
            minTimeout: SnodeAPI.TEST_getMinTimeout(),
            onFailedAttempt: e => {
              window?.log?.warn(
                `${method} INNER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
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
            `${method} OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... ${e.message}`
          );
        },
      }
    );

    return maliciousSnodes;
  } catch (e) {
    window?.log?.warn(`failed to ${method} everything on network:`, e);
    return null;
  }
};

const TEST_getMinTimeout = () => 500;

/**
 * Locally deletes message and deletes message on the network (all nodes that contain the message)
 */
const networkDeleteMessages = async (hashes: Array<string>): Promise<Array<string> | null> => {
  const sodium = await getSodiumRenderer();
  const userX25519PublicKey = UserUtils.getOurPubKeyStrFromCache();

  const userED25519KeyPair = await UserUtils.getUserED25519KeyPair();

  if (!userED25519KeyPair) {
    window?.log?.warn('Cannot networkDeleteMessages, did not find user ed25519 key.');
    return null;
  }
  const method = 'delete' as const;

  try {
    const maliciousSnodes = await pRetry(
      async () => {
        const userSwarm = await getSwarmFor(userX25519PublicKey);
        const snodeToMakeRequestTo: Snode | undefined = sample(userSwarm);

        if (!snodeToMakeRequestTo) {
          window?.log?.warn('Cannot networkDeleteMessages, without a valid swarm node.');
          return null;
        }

        return pRetry(
          async () => {
            const signOpts = await SnodeSignature.getSnodeSignatureByHashesParams({
              messages: hashes,
              method,
              pubkey: userX25519PublicKey,
            });

            const ret = await doSnodeBatchRequest(
              [{ method, params: signOpts }],
              snodeToMakeRequestTo,
              10000,
              userX25519PublicKey
            );

            if (!ret || !ret?.[0].body || ret[0].code !== 200) {
              throw new Error(
                `Empty response got for ${method} on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}`
              );
            }

            try {
              const firstResultParsedBody = ret[0].body;
              const { swarm } = firstResultParsedBody;

              if (!swarm) {
                throw new Error(
                  `Invalid JSON swarm response got for ${method} on snode ${ed25519Str(
                    snodeToMakeRequestTo.pubkey_ed25519
                  )}, ${firstResultParsedBody}`
                );
              }
              const swarmAsArray = Object.entries(swarm) as Array<Array<any>>;
              if (!swarmAsArray.length) {
                throw new Error(
                  `Invalid JSON swarmAsArray response got for ${method} on snode ${ed25519Str(
                    snodeToMakeRequestTo.pubkey_ed25519
                  )}, ${firstResultParsedBody}`
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
                        `Could not ${method} from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )} due to error: ${reason}: ${statusCode}`
                      );
                      // if we tried to make the delete on a snode not in our swarm, just trigger a pRetry error so the outer block here finds new snodes to make the request to.
                      if (statusCode === 421) {
                        throw new pRetry.AbortError(
                          `421 error on network ${method}. Retrying with a new snode`
                        );
                      }
                    } else {
                      window?.log?.warn(
                        `Could not ${method} from ${ed25519Str(
                          snodeToMakeRequestTo.pubkey_ed25519
                        )}`
                      );
                    }
                    return snodePubkey;
                  }

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
                })
              );

              return results;
            } catch (e) {
              throw new Error(
                `Invalid JSON response got for ${method} on snode ${ed25519Str(
                  snodeToMakeRequestTo.pubkey_ed25519
                )}, ${ret}`
              );
            }
          },
          {
            retries: 3,
            minTimeout: SnodeAPI.TEST_getMinTimeout(),
            onFailedAttempt: e => {
              window?.log?.warn(
                `${method} INNER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
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
            `${method} OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... ${e.message}`
          );
        },
      }
    );

    return maliciousSnodes;
  } catch (e) {
    window?.log?.warn(`failed to ${method} message on network:`, e);
    return null;
  }
};

export const SnodeAPI = {
  TEST_getMinTimeout,
  networkDeleteMessages,
  forceNetworkDeletion,
};
