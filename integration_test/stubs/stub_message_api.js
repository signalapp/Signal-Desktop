/* global clearTimeout, dcodeIO, Buffer, TextDecoder, process, log */
const nodeFetch = require('node-fetch');

class StubMessageAPI {
  constructor(ourKey) {
    this.ourKey = ourKey;
    this.baseUrl = 'http://localhost:3000';
  }

  // eslint-disable-next-line no-unused-vars
  async sendMessage(pubKey, data, messageTimeStamp, ttl, options = {}) {
    // console.warn('STUBBED message api ', pubKey, ttl);
    const post = {
      method: 'POST',
    };

    const data64 = dcodeIO.ByteBuffer.wrap(data).toString('base64');

    await nodeFetch(
      `${
        this.baseUrl
      }/messages?pubkey=${pubKey}&timestamp=${messageTimeStamp}&data=${encodeURIComponent(
        data64
      )}`,
      post
    );
  }

  async pollForGroupId(groupId, onMessages) {
    const get = {
      method: 'GET',
    };
    const res = await nodeFetch(
      `${this.baseUrl}/messages?pubkey=${groupId}`,
      get
    );

    try {
      const json = await res.json();

      const modifiedMessages = json.messages.map(m => {
        // eslint-disable-next-line no-param-reassign
        m.conversationId = groupId;
        return m;
      });

      onMessages(modifiedMessages || []);
    } catch (e) {
      log.error('invalid json for GROUP', e);
      onMessages([]);
    }

    setTimeout(() => {
      this.pollForGroupId(groupId, onMessages);
    }, 1000);
  }

  async startLongPolling(numConnections, stopPolling, callback) {
    const ourPubkey = this.ourKey;

    const get = {
      method: 'GET',
    };
    const res = await nodeFetch(
      `${this.baseUrl}/messages?pubkey=${ourPubkey}`,
      get
    );

    try {
      const json = await res.json();
      callback(json.messages || []);
    } catch (e) {
      log.error('invalid json: ', e);
      callback([]);
    }
    // console.warn('STUBBED polling messages ', json.messages);
  }
}

module.exports = StubMessageAPI;
