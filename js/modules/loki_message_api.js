/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, lokiP2pAPI, lokiSnodeAPI, textsecure */

const _ = require('lodash');
const { rpc } = require('./loki_rpc');

const DEFAULT_CONNECTIONS = 3;
const MAX_ACCEPTABLE_FAILURES = 1;
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

const calcNonce = (messageEventData, pubKey, data64, timestamp, ttl) => {
  const difficulty = window.storage.get('PoWDifficulty', null);
  // Nonce is returned as a base64 string to include in header
  window.Whisper.events.trigger('calculatingPoW', messageEventData);
  return callWorker('calcPoW', timestamp, ttl, pubKey, data64, difficulty);
};

const trySendP2p = async (pubKey, data64, isPing, messageEventData) => {
  const p2pDetails = lokiP2pAPI.getContactP2pDetails(pubKey);
  if (!p2pDetails || (!isPing && !p2pDetails.isOnline)) {
    return false;
  }
  try {
    await rpc(p2pDetails.address, p2pDetails.port, 'store', {
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
};

class LokiMessageAPI {
  constructor() {
    this.jobQueue = new window.JobQueue();
    this.sendingSwarmNodes = {};
    this.ourKey = window.textsecure.storage.user.getNumber();
  }

  async sendMessage(pubKey, data, messageTimeStamp, ttl, options = {}) {
    const { isPing = false, numConnections = DEFAULT_CONNECTIONS } = options;
    // Data required to identify a message in a conversation
    const messageEventData = {
      pubKey,
      timestamp: messageTimeStamp,
    };

    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');
    const p2pSuccess = await trySendP2p(
      pubKey,
      data64,
      isPing,
      messageEventData
    );
    if (p2pSuccess) {
      return;
    }

    const timestamp = Date.now();
    const nonce = await calcNonce(
      messageEventData,
      pubKey,
      data64,
      timestamp,
      ttl
    );
    // Using timestamp as a unique identifier
    this.sendingSwarmNodes[timestamp] = lokiSnodeAPI.getSwarmNodesForPubKey(
      pubKey
    );
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

    // Taken from https://stackoverflow.com/questions/51160260/clean-way-to-wait-for-first-true-returned-by-promise
    // The promise returned by this function will resolve true when the first promise
    // in ps resolves true *or* it will resolve false when all of ps resolve false
    const firstTrue = ps => {
      const newPs = ps.map(
        p =>
          new Promise(
            // eslint-disable-next-line more/no-then
            (resolve, reject) => p.then(v => v && resolve(true), reject)
          )
      );
      // eslint-disable-next-line more/no-then
      newPs.push(Promise.all(ps).then(() => false));
      return Promise.race(newPs);
    };

    let success;
    try {
      // eslint-disable-next-line more/no-then
      Promise.all(promises).then(delete this.sendingSwarmNodes[timestamp]);
      success = await firstTrue(promises);
    } catch (e) {
      if (e instanceof textsecure.WrongDifficultyError) {
        // Force nonce recalculation
        this.sendMessage(pubKey, data, messageTimeStamp, ttl, options);
        return;
      }
      throw e;
    }
    if (!success) {
      throw new window.textsecure.EmptySwarmError(
        pubKey,
        'Ran out of swarm nodes to query'
      );
    }
    log.info(`Successful storage message to ${pubKey}`);
  }

  async openSendConnection(params) {
    while (!_.isEmpty(this.sendingSwarmNodes[params.timestamp])) {
      const snode = this.sendingSwarmNodes[params.timestamp].shift();
      // TODO: Revert back to using snode address instead of IP
      const successfulSend = await this.sendToNode(
        snode.ip,
        snode.port,
        params
      );
      if (successfulSend) {
        return true;
      }
    }
    return false;
  }

  async sendToNode(address, port, params) {
    let successiveFailures = 0;
    while (successiveFailures < MAX_ACCEPTABLE_FAILURES) {
      await sleepFor(successiveFailures * 500);
      try {
        const result = await rpc(`https://${address}`, port, 'store', params);

        // Make sure we aren't doing too much PoW
        const currentDifficulty = window.storage.get('PoWDifficulty', null);
        const newDifficulty = result.difficulty;
        if (newDifficulty != null && newDifficulty !== currentDifficulty) {
          window.storage.put('PoWDifficulty', newDifficulty);
        }
        return true;
      } catch (e) {
        log.warn('Loki send message:', e);
        if (e instanceof textsecure.WrongSwarmError) {
          const { newSwarm } = e;
          await lokiSnodeAPI.updateSwarmNodes(params.pubKey, newSwarm);
          this.sendingSwarmNodes[params.timestamp] = newSwarm;
          return false;
        } else if (e instanceof textsecure.WrongDifficultyError) {
          const { newDifficulty } = e;
          if (!Number.isNaN(newDifficulty)) {
            window.storage.put('PoWDifficulty', newDifficulty);
          }
          throw e;
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
    log.error(`Failed to send to node: ${address}`);
    await lokiSnodeAPI.unreachableNode(params.pubKey, address);
    return false;
  }

  async openRetrieveConnection(callback) {
    while (!_.isEmpty(this.ourSwarmNodes)) {
      const address = Object.keys(this.ourSwarmNodes)[0];
      const nodeData = this.ourSwarmNodes[address];
      delete this.ourSwarmNodes[address];
      let successiveFailures = 0;
      while (successiveFailures < MAX_ACCEPTABLE_FAILURES) {
        await sleepFor(successiveFailures * 1000);

        try {
          // TODO: Revert back to using snode address instead of IP
          let messages = await this.retrieveNextMessages(nodeData.ip, nodeData);
          successiveFailures = 0;
          if (messages.length) {
            const lastMessage = _.last(messages);
            nodeData.lastHash = lastMessage.hash;
            await lokiSnodeAPI.updateLastHash(
              address,
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
            await lokiSnodeAPI.updateSwarmNodes(this.ourKey, newSwarm);
            for (let i = 0; i < newSwarm.length; i += 1) {
              const lastHash = await window.Signal.Data.getLastHashBySnode(
                newSwarm[i]
              );
              this.ourSwarmNodes[newSwarm[i]] = {
                lastHash,
              };
            }
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
      if (successiveFailures >= 3) {
        await lokiSnodeAPI.unreachableNode(this.ourKey, address);
      }
    }
  }

  async retrieveNextMessages(nodeUrl, nodeData) {
    const params = {
      pubKey: this.ourKey,
      lastHash: nodeData.lastHash || '',
    };
    const options = {
      timeout: 40000,
      headers: {
        [LOKI_LONGPOLL_HEADER]: true,
      },
    };

    const result = await rpc(
      `https://${nodeUrl}`,
      nodeData.port,
      'retrieve',
      params,
      options
    );
    return result.messages || [];
  }

  async startLongPolling(numConnections, callback) {
    this.ourSwarmNodes = {};
    let nodes = await lokiSnodeAPI.getSwarmNodesForPubKey(this.ourKey);
    if (nodes.length < numConnections) {
      await lokiSnodeAPI.refreshSwarmNodesForPubKey(this.ourKey);
      nodes = await lokiSnodeAPI.getSwarmNodesForPubKey(this.ourKey);
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const lastHash = await window.Signal.Data.getLastHashBySnode(
        nodes[i].address
      );
      this.ourSwarmNodes[nodes[i].address] = {
        lastHash,
        ip: nodes[i].ip,
        port: nodes[i].port,
      };
    }

    const promises = [];

    for (let i = 0; i < numConnections; i += 1)
      promises.push(this.openRetrieveConnection(callback));

    // blocks until all snodes in our swarms have been removed from the list
    // or if there is network issues (ENOUTFOUND due to lokinet)
    await Promise.all(promises);
  }
}

module.exports = LokiMessageAPI;
