/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, lokiP2pAPI, lokiSnodeAPI, textsecure */

const _ = require('lodash');
const { rpc } = require('./loki_rpc');

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SUCCESSFUL_REQUESTS = 2;
const LOKI_LONGPOLL_HEADER = 'X-Loki-Long-Poll';

function sleepFor(time) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), time);
  });
}

const filterIncomingMessages = async messages => {
  const incomingHashes = messages.map(m => m.hash);
  const dupHashes = await window.Signal.Data.getSeenMessagesByHashList(
    incomingHashes
  );
  const newMessages = messages.filter(m => !dupHashes.includes(m.hash));
  if (newMessages.length) {
    const newHashes = newMessages.map(m => ({
      expiresAt: m.expiration,
      hash: m.hash,
    }));
    await window.Signal.Data.saveSeenMessageHashes(newHashes);
  }
  return newMessages;
};

const calcNonce = async (messageEventData, pubKey, data64, timestamp, ttl) => {
  // Nonce is returned as a base64 string to include in header
  try {
    window.Whisper.events.trigger('calculatingPoW', messageEventData);
    const development = window.getEnvironment() !== 'production';
    return callWorker(
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
}

const trySendP2p = async (pubKey, data64, isPing, messageEventData) => {
  const p2pDetails = lokiP2pAPI.getContactP2pDetails(pubKey);
  if (!p2pDetails || (!isPing && !p2pDetails.isOnline)) {
    return false;
  }
  try {
    const port = p2pDetails.port ? `:${p2pDetails.port}` : '';

    await rpc(p2pDetails.address, port, 'store', {
      data: data64,
    });
    lokiP2pAPI.setContactOnline(pubKey);
    window.Whisper.events.trigger('p2pMessageSent', messageEventData);
    if (isPing) {
      log.info(`Successfully pinged ${pubKey}`);
    } else {
      log.info(`Successful p2p message to ${pubKey}`);
    }
    return true;
  } catch (e) {
    lokiP2pAPI.setContactOffline(pubKey);
    if (isPing) {
      // If this was just a ping, we don't bother sending to storage server
      log.warn('Ping failed, contact marked offline', e);
      return true;
    }
    log.warn('Failed to send P2P message, falling back to storage', e);
    return false;
  }
}

class LokiMessageAPI {
  constructor({ snodeServerPort }) {
    this.snodeServerPort = snodeServerPort ? `:${snodeServerPort}` : '';
    this.jobQueue = new window.JobQueue();
    this.sendingSwarmNodes = {};
  }

  async sendMessage(numConnections, pubKey, data, messageTimeStamp, ttl, isPing = false) {
    // Data required to identify a message in a conversation
    const messageEventData = {
      pubKey,
      timestamp: messageTimeStamp,
    };

    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');
    const p2pSuccess = await trySendP2p(pubKey, data64, isPing, messageEventData);
    if (p2pSuccess) {
      return;
    }

    const timestamp = Date.now();
    const nonce = await calcNonce(messageEventData, pubKey, data64, timestamp, ttl);
    // Using timestamp as a unique identifier
    this.sendingSwarmNodes[timestamp] = lokiSnodeAPI.getSwarmNodesForPubKey(pubKey);
    if (this.sendingSwarmNodes[timestamp].length < numConnections) {
      const freshNodes = await lokiSnodeAPI.getFreshSwarmNodes(pubKey);
      await lokiSnodeAPI.updateSwarmNodes(pubKey, freshNodes);
      this.sendingSwarmNodes[timestamp] = freshNodes;
    }

    const params = {
      pubKey,
      ttl: ttl.toString(),
      nonce,
      timestamp: timestamp.toString(),
      data: data64,
    };
    const promises = [];
    for (let i = 0; i < numConnections; i += 1) {
      promises.push(this.openSendConnection(params));
    }

    const results = await Promise.all(promises);
    delete this.sendingSwarmNodes[timestamp];
    if (results.every(value => value === false)) {
      throw new window.textsecure.EmptySwarmError(
        pubKey,
        'Ran out of swarm nodes to query'
      );
    }
    if (results.every(value => value === true)) {
      log.info(`Successful storage message to ${pubKey}`);
    } else {
      log.warn(`Partially successful storage message to ${pubKey}`);
    }
  }

  async openSendConnection(params) {
    while (!_.isEmpty(this.sendingSwarmNodes[params.timestamp])) {
      const url = this.sendingSwarmNodes[params.timestamp].shift();
      const successfulSend = await this.sendToNode(url, params);
      if (successfulSend) {
        return true;
      }
    }
    return false;
  }

  async sendToNode(url, params) {
    let successiveFailures = 0;
    while (successiveFailures < 3) {
      await sleepFor(successiveFailures * 500);
      try {
        await rpc(`http://${url}`, this.snodeServerPort, 'store', params);
        return true;
      } catch (e) {
        log.warn('Loki send message:', e);
        if (e instanceof textsecure.WrongSwarmError) {
          const { newSwarm } = e;
          await lokiSnodeAPI.updateSwarmNodes(params.pubKey, newSwarm);
          this.sendingSwarmNodes[params.timestamp] = newSwarm;
          return false;
        } else if (e instanceof textsecure.NotFoundError) {
          // TODO: Handle resolution error
          successiveFailures += 1;
        } else if (e instanceof textsecure.HTTPError) {
          // TODO: Handle working connection but error response
          successiveFailures += 1;
        } else {
          successiveFailures += 1;
        }
      }
    }
    log.error(`Failed to send to node: ${url}`);
    await lokiSnodeAPI.unreachableNode(
      params.pubKey,
      url
    );
    return false;
  }

  async retrieveNextMessages(nodeUrl, nodeData, ourKey) {
    const params = {
      pubKey: ourKey,
      lastHash: nodeData.lastHash || '',
    };
    const options = {
      timeout: 40000,
      headers: {
        [LOKI_LONGPOLL_HEADER]: true,
      },
    };

    const result = await rpc(
      `http://${nodeUrl}`,
      this.snodeServerPort,
      'retrieve',
      params,
      options
    );
    return result.messages || [];
  }

  async openConnection(callback) {
    const ourKey = window.textsecure.storage.user.getNumber();
    while (!_.isEmpty(this.ourSwarmNodes)) {
      const url = Object.keys(this.ourSwarmNodes)[0];
      const nodeData = this.ourSwarmNodes[url];
      delete this.ourSwarmNodes[url];
      let successiveFailures = 0;
      while (successiveFailures < 3) {
        await sleepFor(successiveFailures * 1000);

        try {
          let messages = await this.retrieveNextMessages(
            url,
            nodeData,
            ourKey
          );
          successiveFailures = 0;
          if (messages.length) {
            const lastMessage = _.last(messages);
            nodeData.lashHash = lastMessage.hash;
            lokiSnodeAPI.updateLastHash(
              url,
              lastMessage.hash,
              lastMessage.expiration
            );
            messages = await this.jobQueue.add(() =>
              filterIncomingMessages(messages)
            );
          }
          // Execute callback even with empty array to signal online status
          callback(messages);
        } catch (e) {
          log.warn('Loki retrieve messages:', e);
          if (e instanceof textsecure.WrongSwarmError) {
            const { newSwarm } = e;
            await lokiSnodeAPI.updateOurSwarmNodes(newSwarm);
            // Try another snode
            break;
          } else if (e instanceof textsecure.NotFoundError) {
            // DNS/Lokinet error, needs to bubble up
            throw new window.textsecure.DNSResolutionError(
              'Retrieving messages'
            );
          }
          successiveFailures += 1;
        }
      }
    }
  }

  async startLongPolling(numConnections, callback) {
    this.ourSwarmNodes = await lokiSnodeAPI.getOurSwarmNodes();

    const promises = [];

    for (let i = 0; i < numConnections; i += 1)
      promises.push(this.openConnection(callback));

    // blocks until all snodes in our swarms have been removed from the list
    // or if there is network issues (ENOUTFOUND due to lokinet)
    await Promise.all(promises);
  }

  // stale function, kept around to reduce diff noise
  // TODO: remove
  async retrieveMessages(callback) {
    const ourKey = window.textsecure.storage.user.getNumber();
    const completedNodes = [];
    let canResolve = true;
    let successfulRequests = 0;

    let ourSwarmNodes = await lokiSnodeAPI.getOurSwarmNodes();

    const nodeComplete = nodeUrl => {
      completedNodes.push(nodeUrl);
      delete ourSwarmNodes[nodeUrl];
    };

    const doRequest = async (nodeUrl, nodeData) => {
      const params = {
        pubKey: ourKey,
        lastHash: nodeData.lastHash || '',
      };
      const options = {
        timeout: 40000,
        headers: {
          [LOKI_LONGPOLL_HEADER]: true,
        },
      };

      try {
        const result = await rpc(
          `http://${nodeUrl}`,
          this.snodeServerPort,
          'retrieve',
          params,
          options
        );

        nodeComplete(nodeUrl);
        successfulRequests += 1;

        if (Array.isArray(result.messages) && result.messages.length) {
          const lastMessage = _.last(result.messages);
          lokiSnodeAPI.updateLastHash(
            nodeUrl,
            lastMessage.hash,
            lastMessage.expiration
          );
          const filteredMessages = await this.jobQueue.add(() =>
            filterIncomingMessages(result.messages)
          );
          if (filteredMessages.length) {
            callback(filteredMessages);
          }
        }
      } catch (e) {
        log.warn('Loki retrieve messages:', e);
        if (e instanceof textsecure.WrongSwarmError) {
          const { newSwarm } = e;
          await lokiSnodeAPI.updateOurSwarmNodes(newSwarm);
          completedNodes.push(nodeUrl);
        } else if (e instanceof textsecure.NotFoundError) {
          canResolve = false;
        } else if (e instanceof textsecure.HTTPError) {
          // We mark the node as complete as we could still reach it
          nodeComplete(nodeUrl);
        } else {
          const removeNode = await lokiSnodeAPI.unreachableNode(
            ourKey,
            nodeUrl
          );
          if (removeNode) {
            log.error('Loki retrieve messages:', e);
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
        ourSwarmNodes = await lokiSnodeAPI.getOurSwarmNodes();
        // Filter out the nodes we have already got responses from
        completedNodes.forEach(nodeUrl => delete ourSwarmNodes[nodeUrl]);

        if (Object.keys(ourSwarmNodes).length === 0) {
          if (successfulRequests !== 0) {
            // TODO: Decide how to handle some completed requests but not enough
            return;
          }
          throw new window.textsecure.EmptySwarmError(
            ourKey,
            'Ran out of swarm nodes to query'
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
