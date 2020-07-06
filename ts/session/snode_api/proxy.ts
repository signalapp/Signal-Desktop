import fetch from 'node-fetch';
import https from 'https';

import * as SnodePool from './snodePool';
import { sleepFor } from '../../../js/modules/loki_primitives';
import { SnodeResponse } from './onions';
import _ from 'lodash';

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

type Snode = SnodePool.Snode;

// (Disable max body rule for code that we will be removing)
// tslint:disable: max-func-body-length
async function processProxyResponse(
  response: any,
  randSnode: any,
  targetNode: Snode,
  symmetricKey: any,
  options: any,
  retryNumber: number
) {
  const { log, dcodeIO } = window;

  if (response.status === 401) {
    // decom or dereg
    // remove
    // but which the proxy or the target...
    // we got a ton of randomPool nodes, let's just not worry about this one
    SnodePool.markNodeUnreachable(randSnode);
    const text = await response.text();
    log.warn(
      'lokiRpc:::sendToProxy -',
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`,
      'snode is decom or dereg: ',
      text,
      `Try #${retryNumber}`
    );
    // retry, just count it happening 5 times to be the target for now
    return sendToProxy(options, targetNode, retryNumber + 1);
  }

  // 504 is only present in 2.0.3 and after
  // relay is fine but destination is not good
  if (response.status === 504) {
    const pRetryNumber = retryNumber + 1;
    if (pRetryNumber > 3) {
      log.warn(
        `lokiRpc:::sendToProxy - snode ${randSnode.ip}:${randSnode.port}`,
        `can not relay to target node ${targetNode.ip}:${targetNode.port}`,
        'after 3 retries'
      );
      if (options.ourPubKey) {
        SnodePool.markNodeUnreachable(targetNode);
      }
      return false;
    }
    // we don't have to wait here
    // because we're not marking the random snode bad

    // grab a fresh random one
    return sendToProxy(options, targetNode, pRetryNumber);
  }
  // 502 is "Next node not found"

  // detect SNode is not ready (not in swarm; not done syncing)
  // 503 can be proxy target or destination in pre 2.0.3
  // 2.0.3 and after means target
  if (response.status === 503 || response.status === 500) {
    // this doesn't mean the random node is bad, it could be the target node
    // but we got a ton of randomPool nodes, let's just not worry about this one
    SnodePool.markNodeUnreachable(randSnode);
    const text = await response.text();
    log.warn(
      'lokiRpc:::sendToProxy -',
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`,
      `code ${response.status} error`,
      text,
      // `marking random snode bad ${randomPoolRemainingCount} remaining`
      `Try #${retryNumber}`
    );
    // mark as bad for this round (should give it some time and improve success rates)
    // retry for a new working snode
    const pRetryNumber = retryNumber + 1;
    if (pRetryNumber > 5) {
      // it's likely a net problem or an actual problem on the target node
      // lets mark the target node bad for now
      // we'll just rotate it back in if it's a net problem
      log.warn(
        `lokiRpc:::sendToProxy - Failing ${targetNode.ip}:${targetNode.port} after 5 retries`
      );
      if (options.ourPubKey) {
        SnodePool.markNodeUnreachable(targetNode);
      }
      return false;
    }
    // 500 burns through a node too fast,
    // let's slow the retry to give it more time to recover
    if (response.status === 500) {
      await sleepFor(5000);
    }
    return sendToProxy(options, targetNode, pRetryNumber);
  }
  /*
    if (response.status === 500) {
      // usually when the server returns nothing...
    }
    */

  // FIXME: handle fetch errors/exceptions...
  if (response.status !== 200) {
    // let us know we need to create handlers for new unhandled codes
    log.warn(
      'lokiRpc:::sendToProxy - fetch non-200 statusCode',
      response.status,
      `from snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`
    );
    return false;
  }

  const ciphertext = await response.text();
  if (!ciphertext) {
    // avoid base64 decode failure
    // usually a 500 but not always
    // could it be a timeout?
    log.warn(
      'lokiRpc:::sendToProxy - Server did not return any data for',
      options,
      targetNode
    );
    return false;
  }

  let plaintext;
  let ciphertextBuffer;
  try {
    ciphertextBuffer = dcodeIO.ByteBuffer.wrap(
      ciphertext,
      'base64'
    ).toArrayBuffer();

    const plaintextBuffer = await window.libloki.crypto.DHDecrypt(
      symmetricKey,
      ciphertextBuffer
    );

    const textDecoder = new TextDecoder();
    plaintext = textDecoder.decode(plaintextBuffer);
  } catch (e) {
    log.error(
      'lokiRpc:::sendToProxy - decode error',
      e.code,
      e.message,
      `from ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port} ciphertext:`,
      ciphertext
    );
    if (ciphertextBuffer) {
      log.error('ciphertextBuffer', ciphertextBuffer);
    }
    return false;
  }

  if (retryNumber) {
    log.debug(
      'lokiRpc:::sendToProxy - request succeeded,',
      `snode ${randSnode.ip}:${randSnode.port} to ${targetNode.ip}:${targetNode.port}`,
      `on retry #${retryNumber}`
    );
  }

  try {
    const jsonRes = JSON.parse(plaintext);
    if (jsonRes.body === 'Timestamp error: check your clock') {
      log.error(
        'lokiRpc:::sendToProxy - Timestamp error: check your clock',
        Date.now()
      );
    }
    return jsonRes;
  } catch (e) {
    log.error(
      'lokiRpc:::sendToProxy - (outer) parse error',
      e.code,
      e.message,
      `from ${randSnode.ip}:${randSnode.port} json:`,
      plaintext
    );
  }
  return false;
}

// tslint:enable: max-func-body-length

export async function sendToProxy(
  options: any = {},
  targetNode: Snode,
  retryNumber: any = 0
): Promise<boolean | SnodeResponse> {
  const { log, StringView, libloki, libsignal } = window;

  let snodePool = await SnodePool.getRandomSnodePool();

  if (snodePool.length < 2) {
    // this is semi-normal to happen
    log.info(
      'lokiRpc::sendToProxy - Not enough service nodes for a proxy request, only have:',
      snodePool.length,
      'snode, attempting refresh'
    );
    await SnodePool.refreshRandomPool([]);
    snodePool = await SnodePool.getRandomSnodePool();
    if (snodePool.length < 2) {
      log.error(
        'lokiRpc::sendToProxy - Not enough service nodes for a proxy request, only have:',
        snodePool.length,
        'failing'
      );
      return false;
    }
  }

  // Making sure the proxy node is not the same as the target node:
  const snodePoolSafe = _.without(
    snodePool,
    _.find(snodePool, { pubkey_ed25519: targetNode.pubkey_ed25519 })
  );

  const randSnode = _.sample(snodePoolSafe);

  if (!randSnode) {
    log.error('No snodes left for a proxy request');
    return false;
  }

  // Don't allow arbitrary URLs, only snodes and loki servers
  const url = `https://${randSnode.ip}:${randSnode.port}/proxy`;

  const snPubkeyHex = StringView.hexToArrayBuffer(targetNode.pubkey_x25519);

  const myKeys = await libloki.crypto.generateEphemeralKeyPair();

  const symmetricKey = await libsignal.Curve.async.calculateAgreement(
    snPubkeyHex,
    myKeys.privKey
  );

  const textEncoder = new TextEncoder();
  const body = JSON.stringify(options);

  const plainText = textEncoder.encode(body);
  const ivAndCiphertext = await libloki.crypto.DHEncrypt(
    symmetricKey,
    plainText
  );

  const firstHopOptions = {
    method: 'POST',
    body: ivAndCiphertext,
    headers: {
      'X-Sender-Public-Key': StringView.arrayBufferToHex(myKeys.pubKey),
      'X-Target-Snode-Key': targetNode.pubkey_ed25519,
    },
    agent: snodeHttpsAgent,
  };

  // we only proxy to snodes...
  const response = await fetch(url, firstHopOptions);

  return processProxyResponse(
    response,
    randSnode,
    targetNode,
    symmetricKey,
    options,
    retryNumber
  );
}
