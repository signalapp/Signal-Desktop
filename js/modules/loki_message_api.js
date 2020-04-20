/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, lokiSnodeAPI, textsecure */

const _ = require('lodash');
const { lokiRpc } = require('./loki_rpc');
const primitives = require('./loki_primitives');

const DEFAULT_CONNECTIONS = 3;
const MAX_ACCEPTABLE_FAILURES = 10;

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

    // send parameters
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
      const connectionPromise = this._openSendConnection(params).finally(() => {
        completedConnections += 1;
        if (completedConnections >= numConnections) {
          delete this.sendingData[timestamp];
        }
      });
      promises.push(connectionPromise);
    }

    let snode;
    try {
      // eslint-disable-next-line more/no-then
      snode = await primitives.firstTrue(promises);
    } catch (e) {
      log.warn(
        `loki_message:::sendMessage - ${e.code} ${e.message} to ${pubKey} via ${
          snode.ip
        }:${snode.port}`
      );
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
    if (!snode) {
      throw new window.textsecure.EmptySwarmError(
        pubKey,
        'Ran out of swarm nodes to query'
      );
    }
    log.info(
      `loki_message:::sendMessage - Successfully stored message to ${pubKey} via ${
        snode.ip
      }:${snode.port}`
    );
  }

  async refreshSendingSwarm(pubKey, timestamp) {
    const freshNodes = await lokiSnodeAPI.refreshSwarmNodesForPubKey(pubKey);
    this.sendingData[timestamp].swarm = freshNodes;
    this.sendingData[timestamp].hasFreshList = true;
    return true;
  }

  async _openSendConnection(params) {
    // timestamp is likely the current second...

    while (!_.isEmpty(this.sendingData[params.timestamp].swarm)) {
      const snode = this.sendingData[params.timestamp].swarm.shift();
      // TODO: Revert back to using snode address instead of IP
      const successfulSend = await this._sendToNode(snode, params);
      if (successfulSend) {
        return snode;
      }
      // should we mark snode as bad if it can't store our message?
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
      return this._openSendConnection(params);
    }
    return false;
  }

  async _sendToNode(targetNode, params) {
    let successiveFailures = 0;
    while (successiveFailures < MAX_ACCEPTABLE_FAILURES) {
      // the higher this is, the longer the user delay is
      // we don't want to burn through all our retries quickly
      // we need to give the node a chance to heal
      // also failed the user quickly, just means they pound the retry faster
      // this favors a lot more retries and lower delays
      // but that may chew up the bandwidth...
      await primitives.sleepFor(successiveFailures * 500);
      try {
        const result = await lokiRpc(
          `https://${targetNode.ip}`,
          targetNode.port,
          'store',
          params,
          {},
          '/storage_rpc/v1',
          targetNode
        );
        // succcessful messages should look like
        // `{\"difficulty\":1}`
        // but so does invalid pow, so be careful!

        // do not return true if we get false here...
        if (result === false) {
          // this means the node we asked for is likely down
          log.warn(
            `loki_message:::_sendToNode - Try #${successiveFailures}/${MAX_ACCEPTABLE_FAILURES} ${
              targetNode.ip
            }:${targetNode.port} failed`
          );
          successiveFailures += 1;
          // eslint-disable-next-line no-continue
          continue;
        }

        // Make sure we aren't doing too much PoW
        const currentDifficulty = window.storage.get('PoWDifficulty', null);
        if (
          result &&
          result.difficulty &&
          result.difficulty !== currentDifficulty
        ) {
          window.storage.put('PoWDifficulty', result.difficulty);
          // should we return false?
        }
        return true;
      } catch (e) {
        log.warn(
          'loki_message:::_sendToNode - send error:',
          e.code,
          e.message,
          `destination ${targetNode.ip}:${targetNode.port}`
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
          log.warn('loki_message:::_sendToNode - Timestamp is invalid');
          throw e;
        } else if (e instanceof textsecure.HTTPError) {
          // TODO: Handle working connection but error response
          const body = await e.response.text();
          log.warn('loki_message:::_sendToNode - HTTPError body:', body);
        }
        successiveFailures += 1;
      }
    }
    const remainingSwarmSnodes = await lokiSnodeAPI.unreachableNode(
      params.pubKey,
      targetNode
    );
    log.error(
      `loki_message:::_sendToNode - Too many successive failures trying to send to node ${
        targetNode.ip
      }:${targetNode.port}, ${remainingSwarmSnodes.lengt} remaining swarm nodes`
    );
    return false;
  }

  async _openRetrieveConnection(pSwarmPool, stopPollingPromise, callback) {
    const swarmPool = pSwarmPool; // lint
    let stopPollingResult = false;

    // When message_receiver restarts from onoffline/ononline events it closes
    // http-resources, which will then resolve the stopPollingPromise with true. We then
    // want to cancel these polling connections because new ones will be created

    // eslint-disable-next-line more/no-then
    stopPollingPromise.then(result => {
      stopPollingResult = result;
    });

    while (!stopPollingResult && !_.isEmpty(swarmPool)) {
      const address = Object.keys(swarmPool)[0]; // X.snode hostname
      const nodeData = swarmPool[address];
      delete swarmPool[address];
      let successiveFailures = 0;
      while (
        !stopPollingResult &&
        successiveFailures < MAX_ACCEPTABLE_FAILURES
      ) {
        // TODO: Revert back to using snode address instead of IP
        try {
          // in general, I think we want exceptions to bubble up
          // so the user facing UI can report unhandled errors
          // except in this case of living inside http-resource pollServer
          // because it just restarts more connections...

          let messages = await this._retrieveNextMessages(nodeData);
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
            'loki_message:::_openRetrieveConnection - retrieve error:',
            e.code,
            e.message,
            `on ${nodeData.ip}:${nodeData.port}`
          );
          if (e instanceof textsecure.WrongSwarmError) {
            const { newSwarm } = e;
            await lokiSnodeAPI.updateSwarmNodes(this.ourKey, newSwarm);
            // FIXME: restart all openRetrieves when this happens...
            // FIXME: lokiSnode should handle this
            for (let i = 0; i < newSwarm.length; i += 1) {
              const lastHash = await window.Signal.Data.getLastHashBySnode(
                newSwarm[i]
              );
              swarmPool[newSwarm[i]] = {
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

        // Always wait a bit as we are no longer long-polling
        await primitives.sleepFor(Math.max(successiveFailures, 2) * 1000);
      }
      if (successiveFailures >= MAX_ACCEPTABLE_FAILURES) {
        const remainingSwarmSnodes = await lokiSnodeAPI.unreachableNode(
          this.ourKey,
          nodeData
        );
        log.warn(
          `loki_message:::_openRetrieveConnection - too many successive failures, removing ${
            nodeData.ip
          }:${nodeData.port} from our swarm pool. We have ${
            Object.keys(swarmPool).length
          } usable swarm nodes left for our connection (${
            remainingSwarmSnodes.length
          } in local db)`
        );
      }
    }
    // if not stopPollingResult
    if (_.isEmpty(swarmPool)) {
      log.error(
        'loki_message:::_openRetrieveConnection - We no longer have any swarm nodes available to try in pool, closing retrieve connection'
      );
      return false;
    }
    return true;
  }

  // we don't throw or catch here
  // mark private (_ prefix) since no error handling is done here...
  async _retrieveNextMessages(nodeData) {
    const params = {
      pubKey: this.ourKey,
      lastHash: nodeData.lastHash || '',
    };
    const options = {
      timeout: 40000,
      ourPubKey: this.ourKey,
    };

    // let exceptions bubble up
    const result = await lokiRpc(
      `https://${nodeData.ip}`,
      nodeData.port,
      'retrieve',
      params,
      options,
      '/storage_rpc/v1',
      nodeData
    );

    if (result === false) {
      // make a note of it because of caller doesn't care...
      log.warn(
        `loki_message:::_retrieveNextMessages - lokiRpc could not talk to ${
          nodeData.ip
        }:${nodeData.port}`
      );
    }

    return result.messages || [];
  }

  // we don't throw or catch here
  async startLongPolling(numConnections, stopPolling, callback) {
    // load from local DB
    let nodes = await lokiSnodeAPI.getSwarmNodesForPubKey(this.ourKey, {
      fetchHashes: true,
    });
    if (nodes.length < numConnections) {
      log.warn(
        'loki_message:::startLongPolling - Not enough SwarmNodes for our pubkey in local database, getting current list from blockchain'
      );
      // load from blockchain
      nodes = await lokiSnodeAPI.refreshSwarmNodesForPubKey(this.ourKey);
      if (nodes.length < numConnections) {
        log.error(
          'loki_message:::startLongPolling - Could not get enough SwarmNodes for our pubkey from blockchain'
        );
      }
    }
    log.info(
      'loki_message:::startLongPolling - start polling for',
      numConnections,
      'connections. We have swarmNodes',
      nodes.length,
      'for',
      this.ourKey
    );

    // ok now split up our swarm pool into numConnections number of pools
    // one for each retrieve connection

    // floor or ceil probably doesn't matter, since it's likely always uneven
    const poolSize = Math.floor(nodes.length / numConnections);
    const pools = [];
    while (nodes.length) {
      const poolList = nodes.splice(0, poolSize);
      const byAddressObj = poolList.reduce((result, node) => {
        // eslint-disable-next-line no-param-reassign
        result[node.address] = node;
        return result;
      }, {});
      pools.push(byAddressObj);
    }

    const promises = [];

    let unresolved = numConnections;
    for (let i = 0; i < numConnections; i += 1) {
      promises.push(
        // eslint-disable-next-line more/no-then
        this._openRetrieveConnection(pools[i], stopPolling, callback).then(
          stoppedPolling => {
            unresolved -= 1;
            log.info(
              `loki_message:::startLongPolling - There are ${unresolved}`,
              `open retrieve connections left. Stopped? ${stoppedPolling}`
            );
          }
        )
      );
    }

    // blocks until numConnections snodes in our swarms have been removed from the list
    // less than numConnections being active is fine, only need to restart if none per Niels 20/02/13
    // or if there is network issues (ENOUTFOUND due to lokinet)
    await Promise.all(promises);
    log.warn(
      'loki_message:::startLongPolling - All our long poll swarm connections have been removed'
    );
    // should we just call ourself again?
    // no, our caller already handles this...
  }
}

module.exports = LokiMessageAPI;
