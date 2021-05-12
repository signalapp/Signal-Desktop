import _ from 'lodash';
import { Snode } from '../onions';
import { SendParams, storeOnNode } from '../snode_api/serviceNodeAPI';
import { getSwarm } from '../snode_api/snodePool';
import { firstTrue } from '../utils/Promise';

const DEFAULT_CONNECTIONS = 3;

async function openSendConnection(snode: Snode, params: SendParams) {
  // TODO: Revert back to using snode address instead of IP
  const successfulSend = await storeOnNode(snode, params);
  if (successfulSend) {
    return snode;
  }
  // should we mark snode as bad if it can't store our message?
  return undefined;
}

/**
 * Refactor note: We should really clean this up ... it's very messy
 *
 * We need to split it into 2 sends:
 *  - Snodes
 *  - Open Groups
 *
 * Mikunj:
 *  Temporarily i've made it so `MessageSender` handles open group sends and calls this function for regular sends.
 */

export async function sendMessage(
  pubKey: string,
  data: Uint8Array,
  messageTimeStamp: number,
  ttl: number,
  options: {
    isPublic?: boolean;
  } = {}
): Promise<void> {
  const { isPublic = false } = options;

  if (isPublic) {
    window.log.warn('this sendMessage() should not be called anymore with an open group message');
    return;
  }

  const data64 = window.dcodeIO.ByteBuffer.wrap(data).toString('base64');

  // Using timestamp as a unique identifier
  const swarm = await getSwarm(pubKey);

  // send parameters
  const params = {
    pubKey,
    ttl: ttl.toString(),
    timestamp: messageTimeStamp.toString(),
    data: data64,
  };

  const usedNodes = _.slice(swarm, 0, DEFAULT_CONNECTIONS);

  const promises = usedNodes.map(snodeConnection => openSendConnection(snodeConnection, params));

  let snode;
  try {
    snode = await firstTrue(promises);
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window.log.warn(
      `loki_message:::sendMessage - ${e.code} ${e.message} to ${pubKey} via snode:${snodeStr}`
    );
    throw e;
  }
  if (!snode) {
    throw new window.textsecure.EmptySwarmError(pubKey, 'Ran out of swarm nodes to query');
  } else {
    window.log.info(
      `loki_message:::sendMessage - Successfully stored message to ${pubKey} via ${snode.ip}:${snode.port}`
    );
  }
}
