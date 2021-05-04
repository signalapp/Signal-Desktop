import { processMessage, SwarmPolling } from './swarmPolling';
import { default as insecureNodeFetch } from 'node-fetch';
import { PubKey } from '../types';

export class SwarmPollingStub extends SwarmPolling {
  private readonly baseUrl = 'http://localhost:3000';

  protected async pollOnceForKey(pubkey: PubKey, isGroup: boolean) {
    const pubkeyStr = pubkey.key ? pubkey.key : pubkey;

    const get = {
      method: 'GET',
    };

    // insecureNodeFetch but this is a stub
    const res = await insecureNodeFetch(`${this.baseUrl}/messages?pubkey=${pubkeyStr}`, get);

    try {
      const json = await res.json();

      const options = isGroup ? { conversationId: pubkeyStr } : {};

      json.messages.forEach((m: any) => {
        processMessage(m.data, options);
      });
    } catch (e) {
      window.log.error('invalid json: ', e);
    }
  }
}
