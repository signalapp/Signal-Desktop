/* eslint-disable no-restricted-syntax */
import { isEmpty, sample } from 'lodash';
import pRetry from 'p-retry';
import { Snode } from '../../../data/data';
import { getSodiumRenderer } from '../../crypto';
import { StringUtils, UserUtils } from '../../utils';
import { fromBase64ToArray, fromHexToArray } from '../../utils/String';
import { EmptySwarmError } from '../../utils/errors';
import { UpdateExpiryOnNodeSubRequest } from './SnodeRequestTypes';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { getSwarmFor } from './snodePool';
import { SnodeSignature } from './snodeSignatures';
import { ExpireMessageResultItem, ExpireMessagesResultsContent } from './types';
import { SeedNodeAPI } from '../seed_node_api';

export type verifyExpireMsgsResponseSignatureProps = ExpireMessageResultItem & {
  pubkey: string;
  snodePubkey: any;
  messageHashes: Array<string>;
};

export async function verifyExpireMsgsResponseSignature({
  pubkey,
  snodePubkey,
  messageHashes,
  expiry,
  signature,
  updated,
  unchanged,
}: verifyExpireMsgsResponseSignatureProps): Promise<boolean> {
  if (!expiry || isEmpty(messageHashes) || isEmpty(signature)) {
    window.log.warn(
      `WIP: [verifyExpireMsgsSignature] missing argument\nexpiry:${expiry}\nmessageHashes:${messageHashes}\nsignature:${signature}`
    );
    return false;
  }

  const edKeyPrivBytes = fromHexToArray(snodePubkey);
  const hashes = [...messageHashes, ...updated];
  if (unchanged && Object.keys(unchanged).length > 0) {
    hashes.push(
      ...Object.entries(unchanged)
        .map(([key, value]: [string, number]) => {
          return `${key}${value}`;
        })
        .sort()
    );
  }

  const verificationString = `${pubkey}${expiry}${hashes.join('')}`;
  const verificationData = StringUtils.encode(verificationString, 'utf8');
  // window.log.debug('WIP: [verifyExpireMsgsSignature] verificationString', verificationString);

  const sodium = await getSodiumRenderer();
  try {
    const isValid = sodium.crypto_sign_verify_detached(
      fromBase64ToArray(signature),
      new Uint8Array(verificationData),
      edKeyPrivBytes
    );

    return isValid;
  } catch (e) {
    window.log.warn('WIP: [verifyExpireMsgsSignature] failed with: ', e.message);
    return false;
  }
}

type ExpireRequestResponseResults = Record<string, { hashes: Array<string>; expiry: number }>;

async function processExpireRequestResponse(
  pubkey: string,
  targetNode: Snode,
  swarm: ExpireMessagesResultsContent,
  messageHashes: Array<string>
): Promise<ExpireRequestResponseResults> {
  if (isEmpty(swarm)) {
    throw Error(`[processExpireRequestResponse] Swarm is missing! ${messageHashes}`);
  }

  const results: ExpireRequestResponseResults = {};
  // window.log.debug(`WIP: [processExpireRequestResponse] initial results: `, swarm, messageHashes);

  for (const nodeKey of Object.keys(swarm)) {
    if (!isEmpty(swarm[nodeKey].failed)) {
      window.log.warn(
        `WIP: [processExpireRequestResponse] Swarm result failure on ${
          targetNode.pubkey_ed25519
        } for nodeKey ${nodeKey}\n${JSON.stringify(swarm[nodeKey])}`
      );
      continue;
    }

    const updatedHashes = swarm[nodeKey].updated;
    const unchangedHashes = swarm[nodeKey].unchanged;
    const expiry = swarm[nodeKey].expiry;
    const signature = swarm[nodeKey].signature;

    if (!updatedHashes || !expiry || !signature) {
      window.log.warn(
        `WIP: [processExpireRequestResponse] Missing arguments on ${
          targetNode.pubkey_ed25519
        } so we will ignore this result (${nodeKey}) and trust in the force.\n${JSON.stringify(
          swarm[nodeKey]
        )}`
      );
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const isValid = await verifyExpireMsgsResponseSignature({
      pubkey,
      snodePubkey: nodeKey,
      messageHashes,
      expiry,
      signature,
      updated: updatedHashes,
      unchanged: unchangedHashes,
    });

    if (!isValid) {
      window.log.warn(
        `WIP: [processExpireRequestResponse] Signature verification failed on ${
          targetNode.pubkey_ed25519
        }!\n${JSON.stringify(messageHashes)}`
      );
      continue;
    }
    results[nodeKey] = { hashes: updatedHashes, expiry };
  }

  return results;
}

async function expireOnNodes(
  targetNode: Snode,
  expireRequest: UpdateExpiryOnNodeSubRequest
): Promise<number> {
  try {
    const result = await doSnodeBatchRequest(
      [expireRequest],
      targetNode,
      4000,
      expireRequest.params.pubkey,
      'batch'
    );

    if (!result || result.length !== 1) {
      throw Error(
        `There was an issue with the results. sessionRpc ${targetNode.ip}:${
          targetNode.port
        } expireRequest ${JSON.stringify(expireRequest)}`
      );
    }

    // TODOLATER make sure that this code still works once disappearing messages is merged
    // do a basic check to know if we have something kind of looking right (status 200 should always be there for a retrieve)
    const firstResult = result[0];

    if (firstResult.code !== 200) {
      throw Error(`result is not 200 but ${firstResult.code}`);
    }

    const bodyFirstResult = firstResult.body;
    const expirationResults = await processExpireRequestResponse(
      expireRequest.params.pubkey,
      targetNode,
      bodyFirstResult.swarm as ExpireMessagesResultsContent,
      expireRequest.params.messages
    );
    const firstExpirationResult = Object.entries(expirationResults).at(0);
    if (!firstExpirationResult) {
      throw new Error('firstExpirationResult is null');
    }

    const messageHash = firstExpirationResult[0];
    const expiry = firstExpirationResult[1].expiry;

    if (!expiry || !messageHash) {
      throw new Error(
        `Something is wrong with the firstExpirationResult: ${JSON.stringify(
          JSON.stringify(firstExpirationResult)
        )}`
      );
    }

    // window.log.debug(
    //   `WIP: [expireOnNodes] Success!\nHere are the results from one of the snodes.\nmessageHash: ${messageHash} \nexpiry: ${expiry} \nexpires at: ${new Date(
    //     expiry
    //   ).toUTCString()}\nnow: ${new Date(GetNetworkTime.getNowWithNetworkOffset()).toUTCString()}`
    // );

    return expiry;
  } catch (err) {
    window?.log?.warn(
      'WIP: [expireOnNodes]',
      err.message || err,
      `destination ${targetNode.ip}:${targetNode.port}`
    );
    // NOTE batch requests have their own retry logic which includes abort errors that will break our retry logic so we need to catch them and throw regular errors
    if (err instanceof pRetry.AbortError) {
      throw Error(err.message);
    }

    throw err;
  }
}

export type ExpireMessageOnSnodeProps = {
  messageHash: string;
  expireTimer: number;
  extend?: boolean;
  shorten?: boolean;
};

export async function buildExpireRequest(
  props: ExpireMessageOnSnodeProps
): Promise<UpdateExpiryOnNodeSubRequest | null> {
  const { messageHash, expireTimer, extend, shorten } = props;

  if (extend && shorten) {
    window.log.error(
      'WIP: [buildExpireRequest] We cannot extend and shorten a message at the same time',
      messageHash
    );
    return null;
  }

  // NOTE empty string means we want to hardcode the expiry to a TTL value, otherwise it's a shorten or extension of the TTL
  const shortenOrExtend = shorten ? 'shorten' : extend ? 'extend' : ('' as const);

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('WIP: [buildExpireRequest] No pubkey found', messageHash);
    return null;
  }

  const expiry = GetNetworkTime.getNowWithNetworkOffset() + expireTimer;
  // window.log.debug(
  //   `WIP: [buildExpireRequest]\nmessageHash: ${messageHash} should expire at ${new Date(
  //     expiry
  //   ).toUTCString()}`
  // );
  const signResult = await SnodeSignature.generateUpdateExpirySignature({
    shortenOrExtend,
    timestamp: expiry,
    messageHashes: [messageHash],
  });

  if (!signResult) {
    window.log.error(
      `WIP: [buildExpireRequest] SnodeSignature.generateUpdateExpirySignature returned an empty result ${messageHash}`
    );
    return null;
  }

  const expireParams: UpdateExpiryOnNodeSubRequest = {
    method: 'expire',
    params: {
      pubkey: ourPubKey,
      pubkey_ed25519: signResult.pubkey_ed25519.toUpperCase(),
      messages: [messageHash],
      expiry,
      extend: extend || undefined,
      shorten: shorten || undefined,
      signature: signResult?.signature,
    },
  };

  // window.log.debug(`WIP: [buildExpireRequest] ${messageHash}\n${JSON.stringify(expireParams)}`);

  return expireParams;
}

/**
 * Sends an 'expire' request to the user's swarm for a specific message.
 * This supports both extending and shortening a message's TTL.
 * The returned TTL should be assigned to the message to expire.
 * @param messageHash the hash of the message to expire
 * @param expireTimer amount of time until we expire the message from now in milliseconds
 * @param extend whether to extend the message's TTL
 * @param shorten whether to shorten the message's TTL
 * @returns the TTL of the message as set by the server
 */
export async function expireMessageOnSnode(
  props: ExpireMessageOnSnodeProps
): Promise<number | null> {
  const { messageHash } = props;

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('WIP: [expireMessageOnSnode] No pubkey found', messageHash);
    return null;
  }

  let snode: Snode | undefined;

  try {
    const expireRequestParams = await buildExpireRequest(props);
    if (!expireRequestParams) {
      throw new Error(`Failed to build expire request ${JSON.stringify(props)}`);
    }
    let newTTL = null;

    await pRetry(
      async () => {
        const swarm = await getSwarmFor(ourPubKey);
        snode = sample(swarm);
        if (!snode) {
          throw new EmptySwarmError(ourPubKey, 'Ran out of swarm nodes to query');
        }
        newTTL = await expireOnNodes(snode, expireRequestParams);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: SeedNodeAPI.getMinTimeout(),
        onFailedAttempt: e => {
          window?.log?.warn(
            `WIP: [expireMessageOnSnode] expire message on snode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
          );
        },
      }
    );

    return newTTL;
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `WIP: [expireMessageOnSnode] ${e.code ? `${e.code} ` : ''}${e.message ||
        e} by ${ourPubKey} for ${messageHash} via snode:${snodeStr}`
    );
    throw e;
  }
}
