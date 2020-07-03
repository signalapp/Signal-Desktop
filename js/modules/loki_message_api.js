/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
/* global log, dcodeIO, window, callWorker, lokiSnodeAPI, textsecure */

const _ = require('lodash');
const primitives = require('./loki_primitives');

const DEFAULT_CONNECTIONS = 3;

const calcNonce = (messageEventData, pubKey, data64, timestamp, ttl) => {
  const difficulty = window.storage.get('PoWDifficulty', null);
  // Nonce is returned as a base64 string to include in header
  window.Whisper.events.trigger('calculatingPoW', messageEventData);
  return callWorker('calcPoW', timestamp, ttl, pubKey, data64, difficulty);
};

class LokiMessageAPI {
  constructor() {
    this.sendingData = {};
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
        `loki_message:::sendMessage - ${e.code} ${e.message} to ${pubKey} via ${snode.ip}:${snode.port}`
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
      `loki_message:::sendMessage - Successfully stored message to ${pubKey} via ${snode.ip}:${snode.port}`
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
      const successfulSend = await window.NewSnodeAPI.storeOnNode(
        snode,
        params
      );
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
}

// These files are expected to be in commonjs so we can't use es6 syntax :(
// If we move these to TS then we should be able to use es6
module.exports = LokiMessageAPI;
