/* global log */

class StubLokiSnodeAPI {
  // eslint-disable-next-line class-methods-use-this
  async refreshSwarmNodesForPubKey(pubKey) {
    log.info('refreshSwarmNodesForPubkey: ', pubKey);
  }
}

module.exports = StubLokiSnodeAPI;
