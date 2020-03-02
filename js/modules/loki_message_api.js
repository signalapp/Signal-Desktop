/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, lokiSnodeAPI, textsecure */

const _ = require('lodash');
const { lokiRpc } = require('./loki_rpc');

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

class LokiMessageAPI {
  constructor(ourKey) {
    this.jobQueue = new window.JobQueue();
    this.sendingData = {};
    this.ourKey = ourKey;
  }

  async sendMessage(pubKey, data, messageTimeStamp, ttl, options = {}) {
    const {
      isPublic = false,
      numConnections = DEFAULT_CONNECTIONS,
      publicSendData = null,
    } = options;
    // Data required to identify a message in a conversation
    const messageEventData = {
      pubKey,
      timestamp: messageTimeStamp,
    };

    if (isPublic) {
      if (!publicSendData) {
        throw new window.textsecure.PublicChatError(
          'Missing public send data for public chat message'
        );
      }
      const res = await publicSendData.sendMessage(data, messageTimeStamp);
      if (res === false) {
        throw new window.textsecure.PublicChatError(
          'Failed to send public chat message'
        );
      }
      messageEventData.serverId = res;
      window.Whisper.events.trigger('publicMessageSent', messageEventData);
      return;
    }

    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');

    const timestamp = Date.now();
    const nonce = await calcNonce(
      messageEventData,
      window.getStoragePubKey(pubKey),
      data64,
      timestamp,
      ttl
    );
    // Using timestamp as a unique identifier
    const swarm = await lokiSnodeAPI.getSwarmNodesForPubKey(pubKey);
    this.sendingData[timestamp] = {
      swarm,
      hasFreshList: false,
    };
    if (this.sendingData[timestamp].swarm.length < numConnections) {
      await this.refreshSendingSwarm(pubKey, timestamp);
    }

    const params = {
      pubKey,
      ttl: ttl.toString(),
      nonce,
      timestamp: timestamp.toString(),
      data: data64,
    };
    const promises = [];
    let completedConnections = 0;
    for (let i = 0; i < numConnections; i += 1) {
      const connectionPromise = this.openSendConnection(params).finally(() => {
        completedConnections += 1;
        if (completedConnections >= numConnections) {
          delete this.sendingData[timestamp];
        }
      });
      promises.push(connectionPromise);
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
      success = await firstTrue(promises);
    } catch (e) {
      if (e instanceof textsecure.WrongDifficultyError) {
        // Force nonce recalculation
        // NOTE: Currently if there are snodes with conflicting difficulties we
        // will send the message twice (or more). Won't affect client side but snodes
        // could store the same message multiple times because they will have different
        // timestamps (and therefore nonces)
        await this.sendMessage(pubKey, data, messageTimeStamp, ttl, options);
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

  async refreshSendingSwarm(pubKey, timestamp) {
    const freshNodes = await lokiSnodeAPI.getFreshSwarmNodes(pubKey);
    await lokiSnodeAPI.updateSwarmNodes(pubKey, freshNodes);
    this.sendingData[timestamp].swarm = freshNodes;
    this.sendingData[timestamp].hasFreshList = true;
    return true;
  }

  async openSendConnection(params) {
    while (!_.isEmpty(this.sendingData[params.timestamp].swarm)) {
      const snode = this.sendingData[params.timestamp].swarm.shift();
      // TODO: Revert back to using snode address instead of IP
      const successfulSend = await this.sendToNode(
        snode.ip,
        snode.port,
        snode,
        params
      );
      if (successfulSend) {
        return true;
      }
    }

    if (!this.sendingData[params.timestamp].hasFreshList) {
      // Ensure that there is only a single refresh per outgoing message
      if (!this.sendingData[params.timestamp].refreshPromise) {
        this.sendingData[
          params.timestamp
        ].refreshPromise = this.refreshSendingSwarm(
          params.pubKey,
          params.timestamp
        );
      }
      await this.sendingData[params.timestamp].refreshPromise;
      // Retry with a fresh list again
      return this.openSendConnection(params);
    }
    return false;
  }

  async sendToNode(address, port, targetNode, params) {
    let successiveFailures = 0;
    while (successiveFailures < MAX_ACCEPTABLE_FAILURES) {
      await sleepFor(successiveFailures * 500);
      try {
        const result = await lokiRpc(
          `https://${address}`,
          port,
          'store',
          params,
          {},
          '/storage_rpc/v1',
          targetNode
        );

        // Make sure we aren't doing too much PoW
        const currentDifficulty = window.storage.get('PoWDifficulty', null);
        const newDifficulty = result.difficulty;
        if (newDifficulty != null && newDifficulty !== currentDifficulty) {
          window.storage.put('PoWDifficulty', newDifficulty);
        }
        return true;
      } catch (e) {
        log.warn(
          'Loki send message error:',
          e.code,
          e.message,
          `from ${address}`
        );
        if (e instanceof textsecure.WrongSwarmError) {
          const { newSwarm } = e;
          await lokiSnodeAPI.updateSwarmNodes(params.pubKey, newSwarm);
          this.sendingData[params.timestamp].swarm = newSwarm;
          this.sendingData[params.timestamp].hasFreshList = true;
          return false;
        } else if (e instanceof textsecure.WrongDifficultyError) {
          const { newDifficulty } = e;
          if (!Number.isNaN(newDifficulty)) {
            window.storage.put('PoWDifficulty', newDifficulty);
          }
          throw e;
        } else if (e instanceof textsecure.NotFoundError) {
          // TODO: Handle resolution error
        } else if (e instanceof textsecure.TimestampError) {
          log.warn('Timestamp is invalid');
          throw e;
        } else if (e instanceof textsecure.HTTPError) {
          // TODO: Handle working connection but error response
          const body = await e.response.text();
          log.warn('HTTPError body:', body);
        }
        successiveFailures += 1;
      }
    }
    log.error(`Failed to send to node: ${address}`);
    await lokiSnodeAPI.unreachableNode(params.pubKey, address);
    return false;
  }

  async openRetrieveConnection(stopPollingPromise, callback) {
    let stopPollingResult = false;
    // When message_receiver restarts from onoffline/ononline events it closes
    // http-resources, which will then resolve the stopPollingPromise with true. We then
    // want to cancel these polling connections because new ones will be created
    // eslint-disable-next-line more/no-then
    stopPollingPromise.then(result => {
      stopPollingResult = result;
    });

    while (!stopPollingResult && !_.isEmpty(this.ourSwarmNodes)) {
      const address = Object.keys(this.ourSwarmNodes)[0];
      const nodeData = this.ourSwarmNodes[address];
      delete this.ourSwarmNodes[address];
      let successiveFailures = 0;
      while (
        !stopPollingResult &&
        successiveFailures < MAX_ACCEPTABLE_FAILURES
      ) {
        await sleepFor(successiveFailures * 1000);

        try {
          // TODO: Revert back to using snode address instead of IP
          let messages = await this.retrieveNextMessages(nodeData.ip, nodeData);
          // this only tracks retrieval failures
          // won't include parsing failures...
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
          log.warn(
            'Loki retrieve messages error:',
            e.code,
            e.message,
            `on ${nodeData.ip}:${nodeData.port}`
          );
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
      if (successiveFailures >= MAX_ACCEPTABLE_FAILURES) {
        log.warn(
          `removing ${nodeData.ip}:${
            nodeData.port
          } from our swarm pool. We have ${
            Object.keys(this.ourSwarmNodes).length
          } usable swarm nodes left`
        );
        await lokiSnodeAPI.unreachableNode(this.ourKey, address);
      }
    }
    // if not stopPollingResult
    if (_.isEmpty(this.ourSwarmNodes)) {
      log.error(
        'We no longer have any swarm nodes available to try in pool, closing retrieve connection'
      );
      return false;
    }
    return true;
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

    const result = await lokiRpc(
      `https://${nodeUrl}`,
      nodeData.port,
      'retrieve',
      params,
      options,
      '/storage_rpc/v1',
      nodeData
    );
    return result.messages || [];
  }

  async startLongPolling(numConnections, stopPolling, callback) {
    log.info('startLongPolling for', numConnections, 'connections');
    this.ourSwarmNodes = {};
    let nodes = await lokiSnodeAPI.getSwarmNodesForPubKey(this.ourKey);
    log.info('swarmNodes', nodes.length, 'for', this.ourKey);
    Object.keys(nodes).forEach(j => {
      const node = nodes[j];
      log.info(`${j} ${node.ip}:${node.port}`);
    });
    if (nodes.length < numConnections) {
      log.warn(
        'Not enough SwarmNodes for our pubkey in local database, getting current list from blockchain'
      );
      nodes = await lokiSnodeAPI.refreshSwarmNodesForPubKey(this.ourKey);
      if (nodes.length < numConnections) {
        log.error(
          'Could not get enough SwarmNodes for our pubkey from blockchain'
        );
      }
    }
    log.info(
      `There are currently ${
        nodes.length
      } swarmNodes for pubKey in our local database`
    );

    for (let i = 0; i < nodes.length; i += 1) {
      const lastHash = await window.Signal.Data.getLastHashBySnode(
        nodes[i].address
      );
      this.ourSwarmNodes[nodes[i].address] = {
        ...nodes[i],
        lastHash,
      };
    }

    const promises = [];

    for (let i = 0; i < numConnections; i += 1) {
      promises.push(this.openRetrieveConnection(stopPolling, callback));
    }

    // blocks until numConnections snodes in our swarms have been removed from the list
    // less than numConnections being active is fine, only need to restart if none per Niels 20/02/13
    // or if there is network issues (ENOUTFOUND due to lokinet)
    await Promise.all(promises);
    log.error('All our long poll swarm connections have been removed');
    // should we just call ourself again?
    // no, our caller already handles this...
  }
}

module.exports = LokiMessageAPI;
