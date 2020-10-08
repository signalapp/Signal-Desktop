import { StringUtils } from '../../../../session/utils';

import fetch from 'node-fetch';

class StubMessageAPI {
  public ourKey: string;
  public baseUrl: string;
  constructor(ourKey: string) {
    this.ourKey = ourKey;
    this.baseUrl = 'http://localhost:3000';
  }

  // eslint-disable-next-line no-unused-vars
  public async sendMessage(
    pubKey: string,
    data: any,
    messageTimeStamp: number,
    ttl: number,
    options = {}
  ) {
    // console.warn('STUBBED message api ', pubKey, ttl);
    const post = {
      method: 'POST',
    };

    const data64 = StringUtils.decode(data, 'base64');
    await fetch(
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
