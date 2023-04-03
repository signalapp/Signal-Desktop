import { isEmpty, slice } from 'lodash';
import { Snode } from '../../../data/data';
import { getSodiumRenderer } from '../../crypto';
import { DEFAULT_CONNECTIONS } from '../../sending/MessageSender';
import { PubKey } from '../../types';
import { StringUtils, UserUtils } from '../../utils';
import { EmptySwarmError } from '../../utils/errors';
import { firstTrue } from '../../utils/Promise';
import { fromBase64ToArray, fromHexToArray, fromUInt8ArrayToBase64 } from '../../utils/String';
import { snodeRpc } from './sessionRpc';
import { getNowWithNetworkOffset } from './SNodeAPI';
import { getSwarmFor } from './snodePool';

async function generateSignature({
  pubkey_ed25519,
  timestamp,
  messageHashes,
}: {
  pubkey_ed25519: UserUtils.HexKeyPair;
  timestamp: number;
  messageHashes: Array<string>;
}): Promise<{ signature: string; pubkey_ed25519: string } | null> {
  if (!pubkey_ed25519) {
    return null;
  }

  const edKeyPrivBytes = fromHexToArray(pubkey_ed25519?.privKey);

  const verificationData = StringUtils.encode(
    `expire${timestamp}${messageHashes.join('')}`,
    'utf8'
  );
  console.log(
    `WIP: generateSignature verificationData`,
    `expire${timestamp}${messageHashes.join('')}`
  );
  const message = new Uint8Array(verificationData);

  const sodium = await getSodiumRenderer();
  try {
    const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
    const signatureBase64 = fromUInt8ArrayToBase64(signature);

    return {
      signature: signatureBase64,
      pubkey_ed25519: pubkey_ed25519.pubKey,
    };
  } catch (e) {
    window.log.warn('WIP: generateSignature failed with: ', e.message);
    return null;
  }
}

async function verifySignature({
  pubkey,
  snodePubkey,
  expiryApplied,
  messageHashes,
  resultHashes,
  signature,
}: {
  pubkey: PubKey;
  snodePubkey: any;
  expiryApplied: number;
  messageHashes: Array<string>;
  resultHashes: Array<string>;
  signature: string;
}): Promise<boolean> {
  if (!expiryApplied || isEmpty(messageHashes) || isEmpty(resultHashes) || isEmpty(signature)) {
    return false;
  }

  const edKeyPrivBytes = fromHexToArray(snodePubkey);

  const verificationData = StringUtils.encode(
    `${pubkey.key}${expiryApplied}${messageHashes.join('')}${resultHashes.join('')}`,
    'utf8'
  );
  console.log(
    `WIP: verifySignature verificationData`,
    `${pubkey.key}${expiryApplied}${messageHashes.join('')}${resultHashes.join('')}`
  );

  const sodium = await getSodiumRenderer();
  try {
    const isValid = sodium.crypto_sign_verify_detached(
      fromBase64ToArray(signature),
      new Uint8Array(verificationData),
      edKeyPrivBytes
    );

    return isValid;
  } catch (e) {
    window.log.warn('WIP: verifySignature failed with: ', e.message);
    return false;
  }
}

async function processExpirationResults(
  pubkey: PubKey,
  targetNode: Snode,
  swarm: Record<string, any>,
  messageHashes: Array<string>
) {
  if (isEmpty(swarm)) {
    throw Error(`WIP: expireOnNodes failed! ${messageHashes}`);
  }

  // TODO need proper typing for swarm and results
  const results: Record<string, { hashes: Array<string>; expiry: number }> = {};
  console.log(`WIP: processExpirationResults`, swarm, messageHashes);

  for (const nodeKey of Object.keys(swarm)) {
    console.log(`WIP: processExpirationResults we got this far`, nodeKey, swarm[nodeKey]);
    if (!isEmpty(swarm[nodeKey].failed)) {
      const reason = 'Unknown';
      const statusCode = '404';
      window?.log?.warn(
        `WIP: loki_message:::expireMessage - Couldn't delete data from: ${
          targetNode.pubkey_ed25519
        }${reason && statusCode && ` due to an error ${reason} (${statusCode})`}`
      );
      // TODO This might be a redundant step
      results[nodeKey] = { hashes: [], expiry: 0 };
    }

    const resultHashes = swarm[nodeKey].updated;
    const expiryApplied = swarm[nodeKey].expiry;
    const signature = swarm[nodeKey].signature;

    const isValid = await verifySignature({
      pubkey,
      snodePubkey: nodeKey,
      expiryApplied,
      messageHashes,
      resultHashes,
      signature,
    });

    if (!isValid) {
      window.log.warn(
        `WIP: loki_message:::expireMessage - Signature verification failed!`,
        messageHashes
      );
    }
    results[nodeKey] = { hashes: resultHashes, expiry: expiryApplied };
  }

  return results;
}

type ExpireParams = {
  pubkey: PubKey;
  messages: Array<string>;
  expiry: number;
  signature: string;
};

async function expireOnNodes(targetNode: Snode, params: ExpireParams) {
  // THE RPC requires the pubkey needs to be a string but we need the Pubkey for signature processing.
  const rpcParams = { ...params, pubkey: params.pubkey.key };
  try {
    const result = await snodeRpc({
      method: 'expire',
      params: rpcParams,
      targetNode,
      associatedWith: params.pubkey.key,
    });

    if (!result || result.status !== 200 || !result.body) {
      return false;
    }

    try {
      const parsed = JSON.parse(result.body);
      const expirationResults = await processExpirationResults(
        params.pubkey,
        targetNode,
        parsed.swarm,
        params.messages
      );

      console.log(`WIP: expireOnNodes attempt complete. Here are the results`, expirationResults);

      return true;
    } catch (e) {
      window?.log?.warn('WIP: Failed to parse "swarm" result: ', e.msg);
    }
    return false;
  } catch (e) {
    window?.log?.warn(
      'WIP: store - send error:',
      e,
      `destination ${targetNode.ip}:${targetNode.port}`
    );
    throw e;
  }
}

export async function expireMessageOnSnode(messageHash: string, expireTimer: number) {
  console.log(`WIP: expireMessageOnSnode running!`);
  const ourPubKey = UserUtils.getOurPubKeyFromCache();
  const ourEd25519Key = await UserUtils.getUserED25519KeyPair();

  if (!ourPubKey || !ourEd25519Key) {
    window.log.info(`WIP: expireMessageOnSnode failed!`, messageHash);
    return;
  }

  const swarm = await getSwarmFor(ourPubKey.key);

  const expiry = getNowWithNetworkOffset() + expireTimer;
  const signResult = await generateSignature({
    pubkey_ed25519: ourEd25519Key,
    timestamp: expiry,
    messageHashes: [messageHash],
  });

  if (!signResult) {
    window.log.info(`WIP: Signing message expiry on swarm failed!`, messageHash);
    return;
  }

  const params = {
    pubkey: ourPubKey,
    pubkey_ed25519: ourEd25519Key.pubKey,
    // TODO better testing for failed case
    // messages: ['WabEZS4RH/NrDhm8vh1gXK4xSmyJL1d4BUC/Ho6GRxA'],
    messages: [messageHash],
    expiry,
    signature: signResult?.signature,
  };

  const usedNodes = slice(swarm, 0, DEFAULT_CONNECTIONS);
  if (!usedNodes || usedNodes.length === 0) {
    throw new EmptySwarmError(ourPubKey.key, 'Ran out of swarm nodes to query');
  }

  const promises = usedNodes.map(async usedNode => {
    const successfulSend = await expireOnNodes(usedNode, params);
    if (successfulSend) {
      return usedNode;
    }
    return undefined;
  });

  let snode: Snode | undefined;
  try {
    const firstSuccessSnode = await firstTrue(promises);
    console.log(`WIP: expireMessageOnSnode firstSuccessSnode`, firstSuccessSnode);
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `WIP: loki_message:::expireMessage - ${e.code} ${e.message} by ${ourPubKey} for ${messageHash} via snode:${snodeStr}`
    );
    throw e;
  }
}
