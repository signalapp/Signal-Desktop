/* global clearTimeout, dcodeIO, Buffer, TextDecoder, process */
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
}

module.exports = StubMessageAPI;
