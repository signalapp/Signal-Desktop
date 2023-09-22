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
  // window.log.debug(`WIP: [processExpireRequestResponse] initial results: `, swarm, messageHashes);

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

async function expireOnNodes(
  targetNode: Snode,
  expireRequest: UpdateExpiryOnNodeSubRequest
): Promise<number | null> {
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
        `WIP: [expireOnNodes] There was an issue with the results. sessionRpc ${targetNode.ip}:${
          targetNode.port
        } expireRequest ${JSON.stringify(expireRequest)}`
      );
      return null;
    }

    // TODOLATER make sure that this code still works once disappearing messages is merged
    // do a basic check to know if we have something kind of looking right (status 200 should always be there for a retrieve)
    const firstResult = result[0];

    if (firstResult.code !== 200) {
      window?.log?.warn(`WIP: [expireOnNods] result is not 200 but ${firstResult.code}`);
      return null;
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
      if (!firstExpirationResult) {
        window?.log?.warn(
          'WIP: [expireOnNodes] failed to parse "swarm" result. firstExpirationResult is null'
        );
        throw new Error('firstExpirationResult is null');
      }

      const messageHash = firstExpirationResult[0];
      const expiry = firstExpirationResult[1].expiry;

      window.log.debug(
        `WIP: [expireOnNodes] Success!\nHere are the results from one of the snodes.\nmessageHash: ${messageHash} \nexpiry: ${expiry} \nexpires at: ${new Date(
          expiry
        ).toUTCString()}\nnow: ${new Date(GetNetworkTime.getNowWithNetworkOffset()).toUTCString()}`
      );

      return expiry;
    } catch (e) {
      window?.log?.warn('WIP: [expireOnNodes] Failed to parse "swarm" result: ', e.msg);
    }
    return null;
  } catch (e) {
    window?.log?.warn(
      'WIP: [expireOnNodes] - send error:',
      e,
      `destination ${targetNode.ip}:${targetNode.port}`
    );
    throw e;
  }
}

type GetExpiriesFromSnodeProps = {
  messageHashes: Array<string>;
  timestamp: number;
};

async function buildGetExpiriesRequest(
  props: GetExpiriesFromSnodeProps
): Promise<UpdateExpiryOnNodeSubRequest | null> {
  const { messageHashes, timestamp } = props;

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('WIP: [buildGetExpiriesRequest] No pubkey found', messageHashes);
    return null;
  }

  window.log.debug(
    `WIP: [buildGetExpiriesRequest] gettig expiries for messageHashes: ${messageHashes} from ${new Date(
      timestamp
    ).toUTCString()}`
  );

  const signResult = await SnodeSignature.generateGetExpiriesSignature({
    timestamp,
    messageHashes,
  });

  if (!signResult) {
    window.log.error(
      `WIP: [buildGetExpiriesRequest] SnodeSignature.generateUpdateExpirySignature returned an empty result ${messageHashes}`
    );
    return null;
  }

  const expireParams: UpdateExpiryOnNodeSubRequest = {
    method: 'expire',
    params: {
      pubkey: ourPubKey,
      pubkey_ed25519: signResult.pubkey_ed25519.toUpperCase(),
      // TODO better testing for failed case
      messages: [messageHashes],
      expiry,
      extend: extend || undefined,
      shorten: shorten || undefined,
      signature: signResult?.signature,
    },
  };

  window.log.debug(
    `WIP: [buildGetExpiriesRequest] ${messageHashes}\n${JSON.stringify(expireParams)}`
  );

  return expireParams;
}

/**
 * Sends an 'expire' request to the user's swarm for a specific message.
 * This supports both extending and shortening a message's TTL.
 * The returned TTL should be assigned to the message to expire.
 * @param messageHashes the hashes of the messages we want the current expiries for
 * @param timestamp the time (ms) the request was initiated, must be within ±60s of the current time so using the server time is recommended.
 * @returns the TTL of the message as set by the server
 */
export async function getExpiriesFromSnode(props: GetExpiriesFromSnodeProps) {
  const { messageHashes } = props;

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubKey) {
    window.log.error('WIP: [getExpiriesFromSnode] No pubkey found', messageHashes);
    return null;
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
          `WIP: [getExpiriesFromSnode] get snode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
        );
      },
    }
  );

  try {
    const expireRequestParams = await buildGetExpiriesRequest(props);
    if (!expireRequestParams) {
      throw new Error(`Failed to build expire request ${JSON.stringify(props)}`);
    }

    let newTTL = null;

    await pRetry(
      async () => {
        if (!snode) {
          throw new Error(`No snode found.\n${JSON.stringify(props)}`);
        }
        newTTL = await expireOnNodes(snode, expireRequestParams);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: SeedNodeAPI.getMinTimeout(),
        onFailedAttempt: e => {
          window?.log?.warn(
            `WIP: [getExpiriesFromSnode] expire message on snode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
          );
        },
      }
    );

    return newTTL;
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `WIP: loki_message:::expireMessage - ${e.code ? `${e.code} ` : ''}${
        e.message
      } by ${ourPubKey} for ${messageHashes} via snode:${snodeStr}`
    );
    throw e;
  }
}
