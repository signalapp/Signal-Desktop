/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, Whisper */

const nodeFetch = require('node-fetch');
const _ = require('lodash');

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
  const timeout = 10000;
  const method = options.method || 'GET';

  try {
    const response = await nodeFetch(url, {
      timeout,
      method,
      ...options,
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
    }

    return result;
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      throw new NotFoundError();
    }

    throw e;
  }
};

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SUCCESSFUL_REQUESTS = 2;

class LokiMessageAPI {
  constructor({ messageServerPort }) {
    this.messageServerPort = messageServerPort ? `:${messageServerPort}` : '';
  }

  async sendMessage(pubKey, data, messageTimeStamp, ttl) {
    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');
    const timestamp = Math.floor(Date.now() / 1000);
    // Nonce is returned as a base64 string to include in header
    let nonce;
    try {
      window.Whisper.events.trigger('calculatingPoW', {
        pubKey,
        timestamp: messageTimeStamp,
      });
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
    let successfulRequests = 0;
    let canResolve = true;

    let swarmNodes = await window.Signal.Data.getSwarmNodesByPubkey(pubKey);

    const doRequest = async nodeUrl => {
      const url = `${nodeUrl}${this.messageServerPort}/store`;
      const fetchOptions = {
        method: 'POST',
        body: data64,
        headers: {
          'X-Loki-pow-nonce': nonce,
          'X-Loki-timestamp': timestamp.toString(),
          'X-Loki-ttl': ttl.toString(),
          'X-Loki-recipient': pubKey,
        },
      };

      try {
        await fetch(url, fetchOptions);

        completedNodes.push(nodeUrl);
        swarmNodes = swarmNodes.filter(node => node !== nodeUrl);
        successfulRequests += 1;
      } catch (e) {
        if (e instanceof NotFoundError) {
          canResolve = false;
        } else if (e instanceof HTTPError) {
          log.error(
            `POST ${e.response.url}`,
            e.response.status,
            'Error sending message'
          );
        } else {
          log.error('Loki SendMessages:', e);
          if (window.LokiSnodeAPI.unreachableNode(pubKey, nodeUrl)) {
            completedNodes.push(nodeUrl);
            swarmNodes = swarmNodes.filter(node => node !== nodeUrl);
          }
        }
      }
    };

    while (successfulRequests < MINIMUM_SUCCESSFUL_REQUESTS) {
      if (!canResolve) {
        throw new window.textsecure.DNSResolutionError('Sending messages');
      }
      if (swarmNodes.length === 0) {
        const freshNodes = await window.LokiSnodeAPI.getFreshSwarmNodes(pubKey);
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
        await window.Signal.Data.saveSwarmNodesForPubKey(pubKey, swarmNodes, {
          Conversation: Whisper.Conversation,
        });
      }

      const remainingRequests =
        MINIMUM_SUCCESSFUL_REQUESTS - completedNodes.length;

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
      ourSwarmNodes = await window.LokiSnodeAPI.getOurSwarmNodes();
    } catch (e) {
      throw new window.textsecure.EmptySwarmError(ourKey, e);
    }

    const doRequest = async (nodeUrl, nodeData) => {
      const url = `${nodeUrl}${this.messageServerPort}/retrieve`;
      const headers = {
        'X-Loki-recipient': ourKey,
      };

      if (nodeData.lastHash) {
        headers['X-Loki-last-hash'] = nodeData.lastHash;
      }

      try {
        const result = await fetch(url, {
          headers,
        });

        completedNodes.push(nodeUrl);
        delete ourSwarmNodes[nodeUrl];

        if (result.lastHash) {
          window.LokiSnodeAPI.updateLastHash(nodeUrl, result.lastHash);
          callback(result.messages);
        }
        successfulRequests += 1;
      } catch (e) {
        if (e instanceof NotFoundError) {
          canResolve = false;
        } else if (e instanceof HTTPError) {
          log.error(
            `GET ${e.response.url}`,
            e.response.status,
            `Error retrieving messages from ${nodeUrl}`
          );
        } else {
          log.error('Loki RetrieveMessages:', e);
          if (window.LokiSnodeAPI.unreachableNode(ourKey, nodeUrl)) {
            completedNodes.push(nodeUrl);
            delete ourSwarmNodes[nodeUrl];
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
          ourSwarmNodes = await window.LokiSnodeAPI.getOurSwarmNodes();
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
        MINIMUM_SUCCESSFUL_REQUESTS - completedNodes.length;

      await Promise.all(
        Object.entries(ourSwarmNodes)
          .splice(0, remainingRequests)
          .map(([nodeUrl, lastHash]) => doRequest(nodeUrl, lastHash))
      );
    }
  }
}

module.exports = {
  LokiMessageAPI,
};
