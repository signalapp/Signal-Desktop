/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, lokiP2pAPI, lokiSnodeAPI, textsecure */

const _ = require('lodash');
const { rpc } = require('./loki_rpc');

// Will be raised (to 3?) when we get more nodes
const MINIMUM_SUCCESSFUL_REQUESTS = 2;
const LOKI_LONGPOLL_HEADER = 'X-Loki-Long-Poll';

async function sleep_for(time) {
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

class LokiMessageAPI {
  constructor({ snodeServerPort }) {
    this.snodeServerPort = snodeServerPort ? `:${snodeServerPort}` : '';
    this.jobQueue = new window.JobQueue();
  }

  async sendMessage(pubKey, data, messageTimeStamp, ttl, isPing = false) {
    const timestamp = Date.now();

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
        if (isPing) {
          log.info(`Successfully pinged ${pubKey}`);
        } else {
          log.info(`Successful p2p message to ${pubKey}`);
        }
        return;
      } catch (e) {
        lokiP2pAPI.setContactOffline(pubKey);
        if (isPing) {
          // If this was just a ping, we don't bother sending to storage server
          log.warn('Ping failed, contact marked offline', e);
          return;
        }
        log.warn('Failed to send P2P message, falling back to storage', e);
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
        await rpc(`http://${nodeUrl}`, this.snodeServerPort, 'store', params);

        nodeComplete(nodeUrl);
        successfulRequests += 1;
      } catch (e) {
        log.warn('Loki send message:', e);
        if (e instanceof textsecure.WrongSwarmError) {
          const { newSwarm } = e;
          await lokiSnodeAPI.updateSwarmNodes(pubKey, newSwarm);
          completedNodes.push(nodeUrl);
        } else if (e instanceof textsecure.NotFoundError) {
          canResolve = false;
        } else if (e instanceof textsecure.HTTPError) {
          // We mark the node as complete as we could still reach it
          nodeComplete(nodeUrl);
        } else {
          const removeNode = await lokiSnodeAPI.unreachableNode(
            pubKey,
            nodeUrl
          );
          if (removeNode) {
            log.error('Loki send message:', e);
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
            log.warn(`Partially successful storage message to ${pubKey}`);
            return;
          }
          throw new window.textsecure.EmptySwarmError(
            pubKey,
            'Ran out of swarm nodes to query'
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
    log.info(`Successful storage message to ${pubKey}`);
  }

  async *retrieveNextMessage(nodeUrl) {
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
    while (true) {
      const result = await rpc(
        `http://${nodeUrl}`,
        this.snodeServerPort,
        'retrieve',
        params,
        options
      );
      if (Array.isArray(result.messages) && result.messages.length) {
        const filteredMessages = await this.jobQueue.add(() =>
          filterIncomingMessages(result.messages)
        );
        if (filteredMessages.length) {
          yield filteredMessages;
        }
      }
    }
  }

  async openConnection(callback) {
    while (this.ourSwarmNodes.length > 0) {
      const url = this.ourSwarmNodes.pop();
      const successive_failures = 0;
      while (true) {
        // loop breaks upon error
        try {
          for await (let messages of retrieveNextMessages(url)) {
            const lastMessage = _.last(message.messages);
            lokiSnodeAPI.updateLastHash(
              url,
              lastMessage.hash,
              lastMessage.expiration
            );
            callback(messages);
            successive_failures = 0;
          }
        } catch (e) {
          log.warn('Loki retrieve messages:', e);
          if (e instanceof textsecure.WrongSwarmError) {
            const { newSwarm } = e;
            await lokiSnodeAPI.updateOurSwarmNodes(newSwarm);
            // Try another snode
            break;
          } else if (e instanceof textsecure.NotFoundError) {
            // DNS/Lokinet error, needs to bubble up
            throw new window.textsecure.DNSResolutionError('Retrieving messages');
          }
        }

        successive_failures += 1;

        if (successive_failures >= 3)
          // Try another snode
          break;

        await sleep_for(successive_failures * 1000);
      }
    }
  }

  async startLongPolling(numConnections, callback) {
    this.ourSwarmNodes = await lokiSnodeAPI.getOurSwarmNodes();

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
