/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, lokiP2pAPI, lokiSnodeAPI, libloki */

const nodeFetch = require('node-fetch');
const _ = require('lodash');
const { parse } = require('url');

const endpointBase = '/v1/storage_rpc';
const LOKI_EPHEMKEY_HEADER = 'X-Loki-EphemKey';

class HTTPError extends Error {
  constructor(response) {
    super(response.statusText);
    this.name = 'HTTPError';
    this.response = response;
  }
}

class NotFoundError extends Error {
  constructor() {
    super('ENOTFOUND');
    this.name = 'NotFoundError';
  }
}

// A small wrapper around node-fetch which deserializes response
const fetch = async (url, options = {}) => {
  const timeout = options.timeout || 10000;
  const method = options.method || 'GET';

  const address = parse(url).hostname;
  const doEncryptChannel = address.endsWith('.snode');
  if (doEncryptChannel) {
    try {
      // eslint-disable-next-line no-param-reassign
      options.body = await libloki.crypto.snodeCipher.encrypt(
        address,
        options.body
      );
      // eslint-disable-next-line no-param-reassign
      options.headers = {
        ...options.headers,
        'Content-Type': 'text/plain',
        [LOKI_EPHEMKEY_HEADER]: libloki.crypto.snodeCipher.getChannelPublicKeyHex(),
      };
    } catch (e) {
      log.warn(`Could not encrypt channel for ${address}: `, e);
    }
  }

  try {
    const response = await nodeFetch(url, {
      ...options,
      timeout,
      method,
    });

    if (!response.ok) {
      throw new HTTPError(response);
    }

    let result;
    if (response.headers.get('Content-Type') === 'application/json') {
      result = await response.json();
    } else if (options.responseType === 'arraybuffer') {
      result = await response.buffer();
    } else {
      result = await response.text();
      if (doEncryptChannel) {
        try {
          result = await libloki.crypto.snodeCipher.decrypt(address, result);
        } catch (e) {
          log.warn(`Could not decrypt response from ${address}`, e);
        }
        try {
          result = JSON.parse(result);
        } catch (e) {
          log.warn(`Could not parse string to json ${result}`, e);
        }
      }
    }

    return result;
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      throw new NotFoundError();
    }

    throw e;
  }
};

// Wrapper for a JSON RPC request
const rpc = (address, port, method, params, options = {}) => {
  const headers = options.headers || {};
  const url = `${address}${port}${endpointBase}`;
  const body = {
    method,
    params,
  };

  const fetchOptions = {
    method: 'POST',
    ...options,
    body: JSON.stringify(body),
    headers,
  };

  return fetch(url, fetchOptions);
};

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SUCCESSFUL_REQUESTS = 2;

class LokiMessageAPI {
  constructor({ messageServerPort }) {
    this.messageServerPort = messageServerPort ? `:${messageServerPort}` : '';
  }

  async sendMessage(pubKey, data, messageTimeStamp, ttl, isPing = false) {
    const timestamp = Math.floor(Date.now() / 1000);

    // Data required to identify a message in a conversation
    const messageEventData = {
      pubKey,
      timestamp: messageTimeStamp,
    };

    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');
    const p2pDetails = lokiP2pAPI.getContactP2pDetails(pubKey);
    if (p2pDetails && (isPing || p2pDetails.isOnline)) {
      try {
        const port = p2pDetails.port ? `:${p2pDetails.port}` : '';

        await rpc(p2pDetails.address, port, 'store', {
          data: data64,
        });
        lokiP2pAPI.setContactOnline(pubKey);
        window.Whisper.events.trigger('p2pMessageSent', messageEventData);
        return;
      } catch (e) {
        log.warn('Failed to send P2P message, falling back to storage', e);
        lokiP2pAPI.setContactOffline(pubKey);
        if (isPing) {
          // If this was just a ping, we don't bother sending to storage server
          return;
        }
      }
    }

    // Nonce is returned as a base64 string to include in header
    let nonce;
    try {
      window.Whisper.events.trigger('calculatingPoW', messageEventData);
      const development = window.getEnvironment() !== 'production';
      nonce = await callWorker(
        'calcPoW',
        timestamp,
        ttl,
        pubKey,
        data64,
        development
      );
    } catch (err) {
      // Something went horribly wrong
      throw err;
    }

    const completedNodes = [];
    const failedNodes = [];
    let successfulRequests = 0;
    let canResolve = true;

    let swarmNodes = await lokiSnodeAPI.getSwarmNodesForPubKey(pubKey);

    const nodeComplete = nodeUrl => {
      completedNodes.push(nodeUrl);
      swarmNodes = swarmNodes.filter(node => node !== nodeUrl);
    };

    const doRequest = async nodeUrl => {
      const params = {
        pubKey,
        ttl: ttl.toString(),
        nonce,
        timestamp: timestamp.toString(),
        data: data64,
      };

      try {
        await rpc(nodeUrl, this.messageServerPort, 'store', params);

        nodeComplete(nodeUrl);
        successfulRequests += 1;
      } catch (e) {
        log.warn('Send message error:', e);
        if (e instanceof NotFoundError) {
          canResolve = false;
        } else if (e instanceof HTTPError) {
          log.error(
            `POST ${e.response.url} (store)`,
            e.response.status,
            'Error sending message'
          );

          // We mark the node as complete as we could still reach it
          nodeComplete(nodeUrl);
        } else {
          const removeNode = await lokiSnodeAPI.unreachableNode(
            pubKey,
            nodeUrl
          );
          if (removeNode) {
            log.error('Loki SendMessages:', e);
            nodeComplete(nodeUrl);
            failedNodes.push(nodeUrl);
          }
        }
      }
    };

    while (successfulRequests < MINIMUM_SUCCESSFUL_REQUESTS) {
      if (!canResolve) {
        throw new window.textsecure.DNSResolutionError('Sending messages');
      }
      if (swarmNodes.length === 0) {
        const freshNodes = await lokiSnodeAPI.getFreshSwarmNodes(pubKey);
        const goodNodes = _.difference(freshNodes, failedNodes);
        await lokiSnodeAPI.updateSwarmNodes(pubKey, goodNodes);
        swarmNodes = _.difference(freshNodes, completedNodes);
        if (swarmNodes.length === 0) {
          if (successfulRequests !== 0) {
            // TODO: Decide how to handle some completed requests but not enough
            return;
          }
          throw new window.textsecure.EmptySwarmError(
            pubKey,
            new Error('Ran out of swarm nodes to query')
          );
        }
      }

      const remainingRequests =
        MINIMUM_SUCCESSFUL_REQUESTS - successfulRequests;

      await Promise.all(
        swarmNodes
          .splice(0, remainingRequests)
          .map(nodeUrl => doRequest(nodeUrl))
      );
    }
  }

  async retrieveMessages(callback) {
    const ourKey = window.textsecure.storage.user.getNumber();
    const completedNodes = [];
    let canResolve = true;
    let successfulRequests = 0;

    let ourSwarmNodes;
    try {
      ourSwarmNodes = await lokiSnodeAPI.getOurSwarmNodes();
    } catch (e) {
      throw new window.textsecure.EmptySwarmError(ourKey, e);
    }

    const nodeComplete = nodeUrl => {
      completedNodes.push(nodeUrl);
      delete ourSwarmNodes[nodeUrl];
    };

    const doRequest = async (nodeUrl, nodeData) => {
      const params = {
        pubKey: ourKey,
        lastHash: nodeData.lastHash,
      };

      try {
        const result = await rpc(
          nodeUrl,
          this.messageServerPort,
          'retrieve',
          params
        );

        nodeComplete(nodeUrl);

        if (result.lastHash) {
          lokiSnodeAPI.updateLastHash(nodeUrl, result.lastHash);
          callback(result.messages);
        }
        successfulRequests += 1;
      } catch (e) {
        log.warn('Retrieve message error:', e);
        if (e instanceof NotFoundError) {
          canResolve = false;
        } else if (e instanceof HTTPError) {
          log.error(
            `POST ${e.response.url} (retrieve)`,
            e.response.status,
            `Error retrieving messages from ${nodeUrl}`
          );

          // We mark the node as complete as we could still reach it
          nodeComplete(nodeUrl);
        } else {
          const removeNode = await lokiSnodeAPI.unreachableNode(
            ourKey,
            nodeUrl
          );
          if (removeNode) {
            log.error('Loki RetrieveMessages:', e);
            nodeComplete(nodeUrl);
          }
        }
      }
    };

    while (successfulRequests < MINIMUM_SUCCESSFUL_REQUESTS) {
      if (!canResolve) {
        throw new window.textsecure.DNSResolutionError('Retrieving messages');
      }
      if (Object.keys(ourSwarmNodes).length === 0) {
        try {
          ourSwarmNodes = await lokiSnodeAPI.getOurSwarmNodes();
          // Filter out the nodes we have already got responses from
          completedNodes.forEach(nodeUrl => delete ourSwarmNodes[nodeUrl]);
        } catch (e) {
          throw new window.textsecure.EmptySwarmError(
            window.textsecure.storage.user.getNumber(),
            e
          );
        }
        if (Object.keys(ourSwarmNodes).length === 0) {
          if (successfulRequests !== 0) {
            // TODO: Decide how to handle some completed requests but not enough
            return;
          }
          throw new window.textsecure.EmptySwarmError(
            window.textsecure.storage.user.getNumber(),
            new Error('Ran out of swarm nodes to query')
          );
        }
      }

      const remainingRequests =
        MINIMUM_SUCCESSFUL_REQUESTS - successfulRequests;

      await Promise.all(
        Object.entries(ourSwarmNodes)
          .splice(0, remainingRequests)
          .map(([nodeUrl, nodeData]) => doRequest(nodeUrl, nodeData))
      );
    }
  }
}

module.exports = LokiMessageAPI;
