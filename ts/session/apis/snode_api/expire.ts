import { isEmpty, sample } from 'lodash';
import { Snode } from '../../../data/data';
import { getSodiumRenderer } from '../../crypto';
import { StringUtils, UserUtils } from '../../utils';
import { fromBase64ToArray, fromHexToArray } from '../../utils/String';
import { EmptySwarmError } from '../../utils/errors';
import { UpdateExpireNodeParams } from './SnodeRequestTypes';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { getSwarmFor } from './snodePool';
import { SnodeSignature } from './snodeSignatures';

async function verifySignature({
  pubkey,
  snodePubkey,
  expiryApplied,
  signature,
  messageHashes,
  updatedHashes,
  unchangedHashes,
}: {
  pubkey: string;
  snodePubkey: any;
  expiryApplied: number;
  signature: string;
  messageHashes: Array<string>;
  updatedHashes: Array<string>;
  // only used when shorten or extend is in the request
  unchangedHashes?: Record<string, string>;
}): Promise<boolean> {
  if (!expiryApplied || isEmpty(messageHashes) || isEmpty(signature)) {
    window.log.warn('verifySignature missing argument');
    return false;
  }

  const edKeyPrivBytes = fromHexToArray(snodePubkey);
  /* PUBKEY_HEX || EXPIRY || RMSGs... || UMSGs... || CMSG_EXPs...
  where RMSGs are the requested expiry hashes,
  UMSGs are the actual updated hashes, and
  CMSG_EXPs are (HASH || EXPIRY) values, ascii-sorted by hash, for the unchanged message hashes included in the "unchanged" field.
  */
  const hashes = [...messageHashes, ...updatedHashes];
  if (unchangedHashes && Object.keys(unchangedHashes).length > 0) {
    hashes.push(
      ...Object.entries(unchangedHashes)
        .map(([key, value]: [string, string]) => {
          return `${key}${value}`;
        })
        .sort()
    );
  }

  const verificationString = `${pubkey}${expiryApplied}${hashes.join('')}`;
  const verificationData = StringUtils.encode(verificationString, 'utf8');
  window.log.debug('verifySignature verificationString', verificationString);

  const sodium = await getSodiumRenderer();
  try {
    const isValid = sodium.crypto_sign_verify_detached(
      fromBase64ToArray(signature),
      new Uint8Array(verificationData),
      edKeyPrivBytes
    );

    return isValid;
  } catch (e) {
    window.log.warn('verifySignature failed with: ', e.message);
    return false;
  }
}

async function processExpirationResults(
  pubkey: string,
  targetNode: Snode,
  swarm: Record<string, any>,
  messageHashes: Array<string>
) {
  if (isEmpty(swarm)) {
    throw Error(`expireOnNodes failed! ${messageHashes}`);
  }

  // TODO need proper typing for swarm and results
  const results: Record<string, { hashes: Array<string>; expiry: number }> = {};
  // window.log.debug(`processExpirationResults start`, swarm, messageHashes);

  for (const nodeKey of Object.keys(swarm)) {
    if (!isEmpty(swarm[nodeKey].failed)) {
      const reason = 'Unknown';
      const statusCode = '404';
      window?.log?.warn(
        `loki_message:::expireMessage - Couldn't delete data from: ${
          targetNode.pubkey_ed25519
        }${reason && statusCode && ` due to an error ${reason} (${statusCode})`}`
      );
      // TODO This might be a redundant step
      results[nodeKey] = { hashes: [], expiry: 0 };
    }

    const updatedHashes = swarm[nodeKey].updated;
    const unchangedHashes = swarm[nodeKey].unchanged;
    const expiryApplied = swarm[nodeKey].expiry;
    const signature = swarm[nodeKey].signature;

    const isValid = await verifySignature({
      pubkey,
      snodePubkey: nodeKey,
      expiryApplied,
      signature,
      messageHashes,
      updatedHashes,
      unchangedHashes,
    });

    if (!isValid) {
      window.log.warn(
        'loki_message:::expireMessage - Signature verification failed!',
        messageHashes
      );
    }
    results[nodeKey] = { hashes: updatedHashes, expiry: expiryApplied };
  }

  return results;
}

async function expireOnNodes(targetNode: Snode, params: UpdateExpireNodeParams) {
  try {
    const result = await doSnodeBatchRequest(
      [
        {
          method: 'expire',
          params,
        },
      ],
      targetNode,
      4000,
      params.pubkey,
      'batch'
    );

    if (!result || result.length !== 1 || result[0]?.code !== 200 || !result[0]?.body) {
      return false;
    }

    try {
      // TODOLATER make sure that this code still works once disappearing messages is merged
      const parsed = result[0].body;
      const expirationResults = await processExpirationResults(
        params.pubkey,
        targetNode,
        parsed.swarm,
        params.messages
      );
      window.log.debug('expireOnNodes attempt complete. Here are the results', expirationResults);

      return true;
    } catch (e) {
      window?.log?.warn('expireOnNodes Failed to parse "swarm" result: ', e.msg);
    }
    return false;
  } catch (e) {
    window?.log?.warn('expire - send error:', e, `destination ${targetNode.ip}:${targetNode.port}`);
    throw e;
  }
}

type ExpireMessageOnSnodeProps = {
  messageHash: string;
  expireTimer: number;
  extend?: boolean;
  shorten?: boolean;
};

// TODO make this retry in case of updated swarm
export async function expireMessageOnSnode(props: ExpireMessageOnSnodeProps) {
  const { messageHash, expireTimer, extend, shorten } = props;

  if (extend && shorten) {
    window.log.error(
      '[expireMessageOnSnode] We cannot extend and shorten a message at the same time',
      messageHash
    );
    return;
  }

  const shortenOrExtend = shorten ? 'shorten' : extend ? 'extend' : ('' as const);

  const ourPubKey = UserUtils.getOurPubKeyStrFromCache();

  if (!ourPubKey) {
    window.log.eror('[expireMessageOnSnode] No pubkey found', messageHash);
    return;
  }

  const swarm = await getSwarmFor(ourPubKey);
  const expiry = GetNetworkTime.getNowWithNetworkOffset() + expireTimer;
  const signResult = await SnodeSignature.generateUpdateExpirySignature({
    shortenOrExtend,
    timestamp: expiry,
    messageHashes: [messageHash],
  });

  if (!signResult) {
    window.log.error('[expireMessageOnSnode] Signing message expiry on swarm failed', messageHash);
    return;
  }

  const params: UpdateExpireNodeParams = {
    pubkey: ourPubKey,
    pubkey_ed25519: signResult.pubkey_ed25519.toUpperCase(),
    // TODO better testing for failed case
    messages: [messageHash],
    expiry,
    extend: extend || undefined,
    shorten: shorten || undefined,
    signature: signResult?.signature,
  };

  const snode = sample(swarm);
  if (!snode) {
    throw new EmptySwarmError(ourPubKey, 'Ran out of swarm nodes to query');
  }

  try {
    // TODO make this whole function `expireMessageOnSnode` retry
    await expireOnNodes(snode, params);
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `loki_message:::expireMessage - ${e.code ? `${e.code} ` : ''}${
        e.message
      } by ${ourPubKey} for ${messageHash} via snode:${snodeStr}`
    );
    throw e;
  }
}
