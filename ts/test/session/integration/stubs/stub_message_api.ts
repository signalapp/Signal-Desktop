import { StringUtils } from '../../../../session/utils';

import { default as insecureNodeFetch } from 'node-fetch';

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
    const post = {
      method: 'POST',
    };

    const data64 = StringUtils.decode(data, 'base64');
    // insecureNodeFetch but this is a stub

    await insecureNodeFetch(
      `${
        this.baseUrl
      }/messages?pubkey=${pubKey}&timestamp=${messageTimeStamp}&data=${encodeURIComponent(data64)}`,
      post
    );
  }
}

module.exports = StubMessageAPI;
