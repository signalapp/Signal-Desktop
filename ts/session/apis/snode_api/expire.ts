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

async function verifyExpireMsgsResponseSignature({
  pubkey,
  snodePubkey,
  messageHashes,
  expiry,
  signature,
  updated,
  unchanged,
}: ExpireMessageResultItem & {
  pubkey: string;
  snodePubkey: any;
  messageHashes: Array<string>;
}): Promise<boolean> {
  if (!expiry || isEmpty(messageHashes) || isEmpty(signature)) {
    window.log.warn('WIP: [verifyExpireMsgsSignature] missing argument');
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
    throw Error(`[expireOnNodes] failed! ${messageHashes}`);
  }

  const results: ExpireRequestResponseResults = {};
  window.log.debug(`WIP: [processExpireRequestResponse] initial results: `, swarm, messageHashes);

  for (const nodeKey of Object.keys(swarm)) {
    if (!isEmpty(swarm[nodeKey].failed)) {
      const reason = 'Unknown';
      const statusCode = '404';
      window?.log?.warn(
        `WIP: loki_message:::expireMessage - Couldn't delete data from: ${
          targetNode.pubkey_ed25519
        }${reason && statusCode && ` due to an error ${reason} (${statusCode})`}`
      );
      // Make sure to clear the result since it failed
      results[nodeKey] = { hashes: [], expiry: 0 };
    }

    const updatedHashes = swarm[nodeKey].updated;
    const unchangedHashes = swarm[nodeKey].unchanged;
    const expiry = swarm[nodeKey].expiry;
    const signature = swarm[nodeKey].signature;

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
        'WIP: loki_message:::expireMessage - Signature verification failed!',
        messageHashes
      );
    }
    results[nodeKey] = { hashes: updatedHashes, expiry };
  }

  return results;
}

async function expireOnNodes(targetNode: Snode, expireRequest: UpdateExpiryOnNodeSubRequest) {
  try {
    const result = await doSnodeBatchRequest(
      [expireRequest],
      targetNode,
      4000,
      expireRequest.params.pubkey,
      'batch'
    );

    if (!result || result.length !== 1) {
      window?.log?.warn(
        `WIP: [expireOnNodes] - There was an issue with the results. sessionRpc ${targetNode.ip}:${
          targetNode.port
        } expireRequest ${JSON.stringify(expireRequest)}`
      );
      return false;
    }

    // TODOLATER make sure that this code still works once disappearing messages is merged
    // do a basic check to know if we have something kind of looking right (status 200 should always be there for a retrieve)
    const firstResult = result[0];

    if (firstResult.code !== 200) {
      window?.log?.warn(`WIP: [expireOnNods] result is not 200 but ${firstResult.code}`);
      return false;
    }

    try {
      const bodyFirstResult = firstResult.body;
      const expirationResults = await processExpireRequestResponse(
        expireRequest.params.pubkey,
        targetNode,
        bodyFirstResult.swarm as ExpireMessagesResultsContent,
        expireRequest.params.messages
      );
      const firstExpirationResult = Object.entries(expirationResults).at(0);
      window.log.debug(
        `WIP: expireOnNodes succeeded! Here are the results from one of the snodes.\nmessageHash: ${
          firstExpirationResult?.[0]
        } \nexpires at: ${
          firstExpirationResult?.[1]?.expiry
            ? new Date(firstExpirationResult?.[1]?.expiry).toUTCString()
            : 'unknown'
        }\nnow: ${new Date(GetNetworkTime.getNowWithNetworkOffset()).toUTCString()}`
      );

      return true;
    } catch (e) {
      window?.log?.warn('WIP: expireOnNodes Failed to parse "swarm" result: ', e.msg);
    }
    return false;
  } catch (e) {
    window?.log?.warn(
      'WIP: expire - send error:',
      e,
      `destination ${targetNode.ip}:${targetNode.port}`
    );
    throw e;
  }
}

type ExpireMessageOnSnodeProps = {
  messageHash: string;
  expireTimer: number;
  extend?: boolean;
  shorten?: boolean;
};

async function buildExpireRequest(
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
  window.log.debug(
    `WIP: [buildExpireRequest] messageHash: ${messageHash} should expire at ${new Date(
      expiry
    ).toUTCString()}`
  );
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
      // TODO better testing for failed case
      messages: [messageHash],
      expiry,
      extend: extend || undefined,
      shorten: shorten || undefined,
      signature: signResult?.signature,
    },
  };

  window.log.debug(`WIP: [buildExpireRequest] ${messageHash} ${JSON.stringify(expireParams)}`);

  return expireParams;
}

/**
 * Sends an 'expire' request to the user's swarm for a specific message.
 * This supports both extending and shortening a message's TTL.
 * @param messageHash the hash of the message to expire
 * @param expireTimer amount of time until we expire the message from now in milliseconds
 * @param extend whether to extend the message's TTL
 * @param shorten whether to shorten the message's TTL
 */
export async function expireMessageOnSnode(props: ExpireMessageOnSnodeProps) {
  const { messageHash } = props;

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('WIP: [expireMessageOnSnode] No pubkey found', messageHash);
    return;
  }

  let snode: Snode | undefined;

  await pRetry(
    async () => {
      const swarm = await getSwarmFor(ourPubKey);
      snode = sample(swarm);
      if (!snode) {
        throw new EmptySwarmError(ourPubKey, 'Ran out of swarm nodes to query');
      }
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: SeedNodeAPI.getMinTimeout(),
      onFailedAttempt: e => {
        window?.log?.warn(
          `WIP: [expireMessageOnSnode] get snode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
        );
      },
    }
  );

  try {
    const expireRequestParams = await buildExpireRequest(props);
    if (!expireRequestParams) {
      throw new Error(`Failed to build expire request ${JSON.stringify(props)}`);
    }

    await pRetry(
      async () => {
        if (!snode) {
          throw new Error(`No snode found.\n${JSON.stringify(props)}`);
        }
        await expireOnNodes(snode, expireRequestParams);
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
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `WIP: loki_message:::expireMessage - ${e.code ? `${e.code} ` : ''}${
        e.message
      } by ${ourPubKey} for ${messageHash} via snode:${snodeStr}`
    );
    throw e;
  }
}
